import { NextResponse } from 'next/server';
import { stripe, stripeEnabled } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendPaymentSuccessEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!stripeEnabled || !stripe) return NextResponse.json({ error: 'disabled' }, { status: 503 });
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) return NextResponse.json({ error: 'no webhook secret' }, { status: 500 });

  const sig = req.headers.get('stripe-signature') || '';
  const raw = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    return NextResponse.json({ error: `invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;
      if (customerId) {
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { plan: 'PRO', subscriptionStatus: 'active', stripeSubscriptionId: subscriptionId ?? user.stripeSubscriptionId },
          });
          if (session.amount_total) void sendPaymentSuccessEmail(user.email, session.amount_total);
        }
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as any;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer } });
      if (user) {
        const active = sub.status === 'active' || sub.status === 'trialing';
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: active ? 'PRO' : 'FREE', subscriptionStatus: sub.status },
        });
      }
    }
  } catch (err) {
    console.error('[webhook handler]', err);
  }

  return NextResponse.json({ received: true });
}
