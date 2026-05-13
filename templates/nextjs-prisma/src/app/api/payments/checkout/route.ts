import { NextResponse } from 'next/server';
import { stripe, stripeEnabled, priceId } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request) {
  if (!stripeEnabled || !stripe || !priceId) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  let user;
  try {
    user = await requireUser();
  } catch (r) {
    return r as Response;
  }
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let customerId = dbUser.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: dbUser.email, metadata: { userId: dbUser.id } });
    customerId = customer.id;
    await prisma.user.update({ where: { id: dbUser.id }, data: { stripeCustomerId: customerId } });
  }
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const body = await req.json().catch(() => ({}));
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: body.priceId || priceId, quantity: 1 }],
    success_url: `${base}/dashboard?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancel`,
  });
  return NextResponse.json({ url: session.url });
}
