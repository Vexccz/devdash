import Stripe from 'stripe';
import { User } from '../models/User.js';
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
          const user = await User.findOneAndUpdate(
            { stripeCustomerId: customerId },
            { stripeSubscriptionId: subscriptionId, plan: 'pro', subscriptionStatus: 'active' },
            { new: true }
          );
          if (user) void sendPaymentSuccessEmail(user);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const status = sub.status;
        await User.findOneAndUpdate(
          { stripeCustomerId: sub.customer },
          {
            subscriptionStatus: status,
            plan: status === 'active' || status === 'trialing' ? 'pro' : 'free',
          }
        );
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
