import { Resend } from 'resend';

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = () => process.env.EMAIL_FROM || 'onboarding@resend.dev';
const APP_NAME = () => process.env.APP_NAME || '{{DISPLAY_NAME}}';

export async function sendEmail({ to, subject, html }) {
  const client = getClient();
  if (!client) {
    console.log(`[email:skipped] ${subject} -> ${to}`);
    return { skipped: true };
  }
  try {
    const res = await client.emails.send({ from: FROM(), to, subject, html });
    return { ok: true, id: res.data?.id };
  } catch (err) {
    console.error('Email send failed:', err);
    return { ok: false, error: err.message };
  }
}

export async function sendWelcomeEmail(user) {
  const loginUrl = `${process.env.FRONTEND_URL}/login`;
  return sendEmail({
    to: user.email,
    subject: `Welcome to ${APP_NAME()}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px; color: #0f172a;">Welcome${user.name ? ', ' + user.name : ''} 👋</h1>
        <p style="color: #475569; line-height: 1.6;">Your ${APP_NAME()} account is ready. Sign in and explore your dashboard.</p>
        <p><a href="${loginUrl}" style="display: inline-block; background: #10b981; color: #0f172a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Open dashboard</a></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 40px;">If you didn't sign up, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(user, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  return sendEmail({
    to: user.email,
    subject: `Reset your ${APP_NAME()} password`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px; color: #0f172a;">Password reset</h1>
        <p style="color: #475569; line-height: 1.6;">Click below to set a new password. The link expires in 30 minutes.</p>
        <p><a href="${resetUrl}" style="display: inline-block; background: #10b981; color: #0f172a; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">Reset password</a></p>
        <p style="color: #94a3b8; font-size: 12px;">Or paste this URL: <br/><code>${resetUrl}</code></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 40px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPaymentSuccessEmail(user) {
  return sendEmail({
    to: user.email,
    subject: `You're on ${APP_NAME()} Pro 🎉`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px; color: #0f172a;">Welcome to Pro</h1>
        <p style="color: #475569; line-height: 1.6;">Your subscription is active. Thanks for supporting ${APP_NAME()}.</p>
        <p style="color: #94a3b8; font-size: 12px;">Manage or cancel any time from your dashboard.</p>
      </div>
    `,
  });
}
