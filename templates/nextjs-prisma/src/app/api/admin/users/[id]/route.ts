import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (r) {
    return r as Response;
  }
  const body = await req.json();
  const data: { role?: 'USER' | 'ADMIN'; plan?: 'FREE' | 'PRO'; name?: string } = {};
  if (body.role && ['USER', 'ADMIN'].includes(String(body.role).toUpperCase())) data.role = String(body.role).toUpperCase() as 'USER' | 'ADMIN';
  if (body.plan && ['FREE', 'PRO'].includes(String(body.plan).toUpperCase())) data.plan = String(body.plan).toUpperCase() as 'FREE' | 'PRO';
  if (typeof body.name === 'string') data.name = body.name;
  const user = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ user });
}
