import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const [totalUsers, proUsers, adminUsers, newLast24h] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { plan: 'PRO' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  const conversionRate = totalUsers > 0 ? Number(((proUsers / totalUsers) * 100).toFixed(1)) : 0;
  return NextResponse.json({ totalUsers, proUsers, adminUsers, newLast24h, conversionRate });
}
