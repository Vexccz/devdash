import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'token';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}

export async function setAuthCookie(userId: string) {
  const token = signToken(userId);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAuthCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function currentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
  };
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Response('Unauthorized', { status: 401 });
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'ADMIN') throw new Response('Forbidden', { status: 403 });
  return u;
}
