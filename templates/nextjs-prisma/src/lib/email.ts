import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'onboarding@example.com';
const APP_NAME = process.env.APP_NAME || '{{DISPLAY_NAME}}';

const resend = apiKey ? new Resend(apiKey) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[email:skipped] ${subject} -> ${to}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email:error]', err);
  }
}

export function sendWelcomeEmail(to: string, name?: string | null) {
  return send(
    to,
    `Welcome to ${APP_NAME}`,
    `<h1>Welcome${name ? ', ' + name : ''}!</h1><p>Thanks for joining ${APP_NAME}.</p>`
  );
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return send(
    to,
    `Reset your ${APP_NAME} password`,
    `<p>Click the link below to reset your password. This link expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`
  );
}

export function sendPaymentSuccessEmail(to: string, amount: number) {
  return send(
    to,
    `${APP_NAME} payment successful`,
    `<p>We received your payment of $${(amount / 100).toFixed(2)}. Thanks for supporting ${APP_NAME}!</p>`
  );
}
