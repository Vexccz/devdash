import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = q
    ? { $or: [{ email: { $regex: q, $options: 'i' } }, { name: { $regex: q, $options: 'i' } }] }
    : {};
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .select('-passwordHash -resetToken -resetTokenExpiresAt')
    .lean();
  res.json({ users });
});

router.patch('/users/:id', async (req, res) => {
  const allowed = {};
  if (req.body.role && ['user', 'admin'].includes(req.body.role)) allowed.role = req.body.role;
  if (req.body.plan && ['free', 'pro'].includes(req.body.plan)) allowed.plan = req.body.plan;
  if (typeof req.body.name === 'string') allowed.name = req.body.name.slice(0, 80);
  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true })
    .select('-passwordHash -resetToken -resetTokenExpiresAt')
    .lean();
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user });
});

router.get('/stats', async (_req, res) => {
  const [total, pro, admins, last24h] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ plan: 'pro' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000) } }),
  ]);
  res.json({
    totalUsers: total,
    proUsers: pro,
    adminUsers: admins,
    newLast24h: last24h,
    conversionRate: total ? Math.round((pro / total) * 1000) / 10 : 0,
  });
});

export default router;
