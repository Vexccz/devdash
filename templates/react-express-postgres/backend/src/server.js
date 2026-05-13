import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import paymentsRouter from './routes/payments.js';
import adminRouter from './routes/admin.js';
import { stripeWebhook } from './routes/stripeWebhook.js';
import { prisma } from './lib/prisma.js';

const app = express();

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: '{{PROJECT_SLUG}}' }));

app.use('/api/auth', authRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

const PORT = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing in .env');
    process.exit(1);
  }
  try {
    await prisma.$connect();
    console.log('[{{PROJECT_SLUG}}] Postgres connected');
  } catch (err) {
    console.error('Postgres connect failed:', err.message);
    console.error('Did you run `npm run prisma:migrate`?');
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`[{{PROJECT_SLUG}}] listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
