import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
export const stripe = key && key !== 'disabled' ? new Stripe(key, { apiVersion: '2024-06-20' }) : null;
export const stripeEnabled = Boolean(stripe);
export const priceId = process.env.STRIPE_PRICE_ID || null;
