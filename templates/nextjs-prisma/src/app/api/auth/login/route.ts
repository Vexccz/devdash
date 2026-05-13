import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setAuthCookie } from '@/lib/auth';

const schema = z.object({ email: z.string().email(), password: z.string() });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const ok = await bcrypt.compare(parsed.data.password, user.password);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  await setAuthCookie(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan } });
}
