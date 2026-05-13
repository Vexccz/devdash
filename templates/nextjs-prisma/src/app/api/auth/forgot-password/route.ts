import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true }); // don't leak

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiresAt: expires },
    });
    const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    void sendPasswordResetEmail(user.email, `${base}/reset-password?token=${token}`);
  }
  return NextResponse.json({ ok: true });
}
