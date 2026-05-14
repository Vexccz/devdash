import fs from 'node:fs';
import path from 'node:path';

export interface Addon {
  id: string;
  name: string;
  description: string;
  category: 'auth' | 'payments' | 'database' | 'messaging' | 'analytics' | 'security' | 'devops' | 'ui' | 'api' | 'storage' | 'ai' | 'testing' | 'monitoring';
  compatibleTemplates: string[];
  packages: { backend?: string[]; frontend?: string[] };
  envVars?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  recommended?: string[];
}

export interface ApplyResult {
  ok: boolean;
  installed: string[];
  envVarsAdded: string[];
  setupFile?: string;
  error?: string;
}

const ALL_TEMPLATES = [
  'react-express-mongo',
  'react-express-postgres',
  'nextjs-prisma',
  'nextjs-app-router',
  'vue-fastapi',
  'svelte-supabase',
  'flutter-firebase',
  'expo-node',
  'astro-static',
];

const NODE_TEMPLATES = [
  'react-express-mongo',
  'react-express-postgres',
  'nextjs-prisma',
  'nextjs-app-router',
];

const REACT_TEMPLATES = [
  'react-express-mongo',
  'react-express-postgres',
  'nextjs-prisma',
  'nextjs-app-router',
  'vue-fastapi',
  'svelte-supabase',
  'expo-node',
  'astro-static',
];

export const ADDONS: Addon[] = [
  // ─── AUTH (8) ───────────────────────────────────────────────────────────────
  {
    id: 'google-oauth',
    name: 'Google OAuth',
    description: 'Sign in with Google using OAuth 2.0 flow',
    category: 'auth',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['passport', 'passport-google-oauth20'], frontend: ['@react-oauth/google'] },
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'],
    difficulty: 'medium',
    estimatedTime: '30min',
  },
  {
    id: 'github-oauth',
    name: 'GitHub OAuth',
    description: 'Sign in with GitHub for developer-facing apps',
    category: 'auth',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['passport', 'passport-github2'] },
    envVars: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL'],
    difficulty: 'medium',
    estimatedTime: '25min',
  },
  {
    id: 'magic-link',
    name: 'Magic Link Auth',
    description: 'Passwordless email magic link authentication',
    category: 'auth',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['nodemailer', 'jsonwebtoken'] },
    envVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'JWT_SECRET'],
    difficulty: 'medium',
    estimatedTime: '45min',
  },
  {
    id: 'two-factor',
    name: '2FA / TOTP',
    description: 'Two-factor authentication with authenticator apps',
    category: 'auth',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['otplib', 'qrcode'] },
    envVars: ['TOTP_ISSUER'],
    difficulty: 'hard',
    estimatedTime: '1h',
  },
  {
    id: 'phone-otp',
    name: 'Phone OTP',
    description: 'SMS-based one-time password verification',
    category: 'auth',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['twilio'] },
    envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    difficulty: 'medium',
    estimatedTime: '30min',
  },
  {
    id: 'apple-signin',
    name: 'Apple Sign In',
    description: 'Sign in with Apple for iOS and web apps',
    category: 'auth',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['apple-signin-auth'] },
    envVars: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
    difficulty: 'hard',
    estimatedTime: '1h',
  },
  {
    id: 'discord-oauth',
    name: 'Discord OAuth',
    description: 'Sign in with Discord for community apps',
    category: 'auth',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['passport', 'passport-discord'] },
    envVars: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_CALLBACK_URL'],
    difficulty: 'medium',
    estimatedTime: '25min',
  },
  {
    id: 'ldap-auth',
    name: 'LDAP / Active Directory',
    description: 'Enterprise LDAP authentication for internal tools',
    category: 'auth',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['passport', 'passport-ldapauth'] },
    envVars: ['LDAP_URL', 'LDAP_BIND_DN', 'LDAP_BIND_CREDENTIALS', 'LDAP_SEARCH_BASE'],
    difficulty: 'hard',
    estimatedTime: '1.5h',
  },
  // ─── PAYMENTS (6) ──────────────────────────────────────────────────────────
  {
    id: 'stripe-subscriptions',
    name: 'Stripe Subscriptions',
    description: 'Recurring billing with Stripe Checkout and webhooks',
    category: 'payments',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['stripe'], frontend: ['@stripe/stripe-js', '@stripe/react-stripe-js'] },
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    difficulty: 'hard',
    estimatedTime: '2h',
    recommended: ['nextjs-prisma', 'nextjs-app-router'],
  },
  {
    id: 'stripe-onetime',
    name: 'Stripe One-Time Payments',
    description: 'Single charge payments with Stripe Checkout',
    category: 'payments',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['stripe'], frontend: ['@stripe/stripe-js'] },
    envVars: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
    difficulty: 'medium',
    estimatedTime: '1h',
  },
  {
    id: 'paypal',
    name: 'PayPal Checkout',
    description: 'PayPal payment integration with orders API',
    category: 'payments',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['@paypal/checkout-server-sdk'], frontend: ['@paypal/react-paypal-js'] },
    envVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_MODE'],
    difficulty: 'medium',
    estimatedTime: '1.5h',
  },
  {
    id: 'lemonsqueezy',
    name: 'Lemon Squeezy',
    description: 'Simple payment and subscription management',
    category: 'payments',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['@lemonsqueezy/lemonsqueezy.js'] },
    envVars: ['LEMONSQUEEZY_API_KEY', 'LEMONSQUEEZY_STORE_ID', 'LEMONSQUEEZY_WEBHOOK_SECRET'],
    difficulty: 'easy',
    estimatedTime: '45min',
  },
  {
    id: 'paddle',
    name: 'Paddle',
    description: 'Merchant of record with global tax handling',
    category: 'payments',
    compatibleTemplates: ALL_TEMPLATES,
    packages: { backend: ['@paddle/paddle-node-sdk'], frontend: ['@paddle/paddle-js'] },
    envVars: ['PADDLE_API_KEY', 'PADDLE_WEBHOOK_SECRET', 'PADDLE_ENVIRONMENT'],
    difficulty: 'medium',
    estimatedTime: '1.5h',
  },
  {
    id: 'fpx-duitnow',
    name: 'FPX / DuitNow',
    description: 'Malaysian online banking and DuitNow QR payments',
    category: 'payments',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['billplz'] },
    envVars: ['BILLPLZ_API_KEY', 'BILLPLZ_COLLECTION_ID', 'BILLPLZ_SIGNATURE_KEY'],
    difficulty: 'medium',
    estimatedTime: '1h',
  },

  // ─── DATABASE (6) ──────────────────────────────────────────────────────────
  {
    id: 'redis',
    name: 'Redis Cache',
    description: 'In-memory caching and session store with Redis',
    category: 'database',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['ioredis'] },
    envVars: ['REDIS_URL'],
    difficulty: 'easy',
    estimatedTime: '20min',
    recommended: ['react-express-mongo', 'react-express-postgres'],
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    description: 'Full-text search engine for complex queries',
    category: 'database',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['@elastic/elasticsearch'] },
    envVars: ['ELASTICSEARCH_URL', 'ELASTICSEARCH_API_KEY'],
    difficulty: 'hard',
    estimatedTime: '2h',
  },
  {
    id: 'mongo-search',
    name: 'MongoDB Atlas Search',
    description: 'Full-text search using MongoDB Atlas Search indexes',
    category: 'database',
    compatibleTemplates: ['react-express-mongo'],
    packages: { backend: ['mongoose'] },
    envVars: [],
    difficulty: 'medium',
    estimatedTime: '45min',
  },
  {
    id: 'pg-search',
    name: 'PostgreSQL Full-Text Search',
    description: 'Native Postgres tsvector full-text search',
    category: 'database',
    compatibleTemplates: ['react-express-postgres', 'nextjs-prisma'],
    packages: { backend: ['pg'] },
    envVars: [],
    difficulty: 'medium',
    estimatedTime: '45min',
  },
  {
    id: 'db-seeding',
    name: 'Database Seeding',
    description: 'Seed scripts with faker for development data',
    category: 'database',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['@faker-js/faker'] },
    envVars: [],
    difficulty: 'easy',
    estimatedTime: '30min',
  },
  {
    id: 'db-backup',
    name: 'Database Backup',
    description: 'Automated database backup to S3-compatible storage',
    category: 'database',
    compatibleTemplates: NODE_TEMPLATES,
    packages: { backend: ['@aws-sdk/client-s3', 'cron'] },
    envVars: ['BACKUP_S3_BUCKET', 'BACKUP_S3_REGION', 'BACKUP_CRON'],
    difficulty: 'medium',
    estimatedTime: '1h',
  },
];

export function listAddons(): Addon[] {
  return ADDONS;
}

export function getAddonsForTemplate(templateId: string): Addon[] {
  return ADDONS.filter(a => a.compatibleTemplates.includes(templateId));
}

export function getRecommendedAddons(templateId: string): Addon[] {
  return ADDONS.filter(
    a => a.compatibleTemplates.includes(templateId) && a.recommended && a.recommended.includes(templateId)
  );
}

export async function applyAddons(targetDir: string, addonIds: string[]): Promise<ApplyResult> {
  const selected = ADDONS.filter(a => addonIds.includes(a.id));
  if (selected.length === 0) return { ok: false, installed: [], envVarsAdded: [], error: 'No valid addons selected' };

  const installed: string[] = [];
  const envVarsAdded: string[] = [];

  try {
    // Collect all packages
    const backendPkgs: string[] = [];
    const frontendPkgs: string[] = [];
    for (const addon of selected) {
      if (addon.packages.backend) backendPkgs.push(...addon.packages.backend);
      if (addon.packages.frontend) frontendPkgs.push(...addon.packages.frontend);
      if (addon.envVars) envVarsAdded.push(...addon.envVars);
    }

    // Install backend packages
    if (backendPkgs.length > 0) {
      const backendDir = fs.existsSync(path.join(targetDir, 'backend')) ? path.join(targetDir, 'backend') : targetDir;
      const pkgJsonPath = path.join(backendDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (!pkg.dependencies) pkg.dependencies = {};
        for (const p of backendPkgs) {
          pkg.dependencies[p] = '*';
          installed.push(p);
        }
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
      }
    }

    // Install frontend packages
    if (frontendPkgs.length > 0) {
      const frontendDir = fs.existsSync(path.join(targetDir, 'frontend')) ? path.join(targetDir, 'frontend') : targetDir;
      const pkgJsonPath = path.join(frontendDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (!pkg.dependencies) pkg.dependencies = {};
        for (const p of frontendPkgs) {
          pkg.dependencies[p] = '*';
          installed.push(p);
        }
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2));
      }
    }

    // Append env vars to .env.example
    if (envVarsAdded.length > 0) {
      const envPath = path.join(targetDir, '.env.example');
      const lines = envVarsAdded.map(k => `${k}=`);
      const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
      fs.writeFileSync(envPath, existing + (existing.endsWith('\n') ? '' : '\n') + '# Addon env vars\n' + lines.join('\n') + '\n');
    }

    // Write setup instructions
    const setupFile = path.join(targetDir, 'ADDON_SETUP.md');
    const setupLines = selected.map(a => `## ${a.name}\n\n${a.description}\n\nPackages: ${[...(a.packages.backend || []), ...(a.packages.frontend || [])].join(', ')}\n${a.envVars ? 'Env vars: ' + a.envVars.join(', ') : ''}\n`);
    fs.writeFileSync(setupFile, `# Addon Setup Guide\n\n${setupLines.join('\n')}`);

    return { ok: true, installed, envVarsAdded, setupFile };
  } catch (err: any) {
    return { ok: false, installed, envVarsAdded, error: err?.message || 'Unknown error' };
  }
}