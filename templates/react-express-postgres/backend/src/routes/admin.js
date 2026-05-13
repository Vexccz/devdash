import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const where = q
    ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }
    : {};
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      createdAt: true,
      subscriptionStatus: true,
    },
  });
  res.json({ users });
});

router.patch('/users/:id', async (req, res) => {
  const allowed = {};
  if (req.body.role && ['user', 'admin'].includes(String(req.body.role).toLowerCase())) {
    allowed.role = String(req.body.role).toUpperCase();
  }
  if (req.body.plan && ['free', 'pro'].includes(String(req.body.plan).toLowerCase())) {
    allowed.plan = String(req.body.plan).toUpperCase();
  }
  if (typeof req.body.name === 'string') allowed.name = req.body.name.slice(0, 80);
  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'Nothing to update' });
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: allowed });
    res.json({ user });
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

router.get('/stats', async (_req, res) => {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [total, pro, admins, last24h] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: 'PRO' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
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
