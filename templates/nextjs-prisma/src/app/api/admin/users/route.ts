import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { name: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      subscriptionStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ users });
}
