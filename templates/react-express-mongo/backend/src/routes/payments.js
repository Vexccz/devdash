import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'disabled') return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

router.get('/status', (_req, res) => {
  res.json({ enabled: !!getStripe(), priceId: process.env.STRIPE_PRICE_ID || null });
});

router.post('/checkout', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  if (!process.env.STRIPE_PRICE_ID) return res.status(500).json({ error: 'STRIPE_PRICE_ID missing' });

  let customerId = req.user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      metadata: { userId: String(req.user._id) },
    });
    customerId = customer.id;
    await User.findByIdAndUpdate(req.user._id, { stripeCustomerId: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing?checkout=cancel`,
  });

  res.json({ url: session.url });
});

router.post('/portal', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  if (!req.user.stripeCustomerId) return res.status(400).json({ error: 'No Stripe customer' });
  const portal = await stripe.billingPortal.sessions.create({
    customer: req.user.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });
  res.json({ url: portal.url });
});

export default router;
