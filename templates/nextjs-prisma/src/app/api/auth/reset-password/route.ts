import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({ token: z.string().min(10), password: z.string().min(6) });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      resetToken: parsed.data.token,
      resetTokenExpiresAt: { gt: new Date() },
    },
  });
  if (!user) return NextResponse.json({ error: 'Token invalid or expired' }, { status: 400 });

  const hash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash, resetToken: null, resetTokenExpiresAt: null },
  });
  return NextResponse.json({ ok: true });
}
