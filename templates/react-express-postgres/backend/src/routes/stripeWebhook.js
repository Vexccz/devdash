import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { sendPaymentSuccessEmail } from '../lib/email.js';

export async function stripeWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'disabled') {
    return res.status(503).end();
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (customerId) {
          const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
          if (user) {
            const updated = await prisma.user.update({
              where: { id: user.id },
              data: { stripeSubscriptionId: subscriptionId, plan: 'PRO', subscriptionStatus: 'active' },
            });
            void sendPaymentSuccessEmail(updated);
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const status = sub.status;
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: status,
              plan: status === 'active' || status === 'trialing' ? 'PRO' : 'FREE',
            },
          });
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).end();
  }
}
