import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../lib/email.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(80).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { email, password, name } = parsed.data;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: 'Email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, name: name || '' });
  void sendWelcomeEmail(user);
  const token = signToken(user);
  res.status(201).json({
    token,
    user: { id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role },
  });
});

router.post('/login', async (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, email: user.email, name: user.name, plan: user.plan, role: user.role },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      plan: req.user.plan,
      role: req.user.role,
      subscriptionStatus: req.user.subscriptionStatus,
    },
  });
});

router.post('/forgot-password', async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email' });
  const user = await User.findOne({ email: parsed.data.email });
  // Always return ok to prevent email enumeration
  if (!user) return res.json({ ok: true });
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await User.findByIdAndUpdate(user._id, { resetToken: token, resetTokenExpiresAt: expiresAt });
  void sendPasswordResetEmail(user, token);
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    password: z.string().min(6).max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { token, password } = parsed.data;
  const user = await User.findOne({ resetToken: token });
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return res.status(400).json({ error: 'Token invalid or expired' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await User.findByIdAndUpdate(user._id, {
    passwordHash,
    resetToken: null,
    resetTokenExpiresAt: null,
  });
  res.json({ ok: true });
});

export default router;
