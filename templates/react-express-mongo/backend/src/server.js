import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRouter from './routes/auth.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';
import { stripeWebhook } from './routes/stripeWebhook.js';

const app = express();

// Stripe webhook must mount before express.json (needs raw body)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: '{{PROJECT_SLUG}}' }));

app.use('/api/auth', authRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('[{{PROJECT_SLUG}}] Mongo connected');
  app.listen(PORT, () => console.log(`[{{PROJECT_SLUG}}] listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
