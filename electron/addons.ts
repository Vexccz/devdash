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
  // MESSAGING
  { id: 'email-resend', name: 'Resend Email', description: 'Transactional emails via Resend', category: 'messaging', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['resend'] }, envVars: ['RESEND_API_KEY'], difficulty: 'easy', estimatedTime: '15min', recommended: NODE_TEMPLATES },
  { id: 'email-sendgrid', name: 'SendGrid Email', description: 'Email delivery via SendGrid', category: 'messaging', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['@sendgrid/mail'] }, envVars: ['SENDGRID_API_KEY'], difficulty: 'easy', estimatedTime: '15min' },
  { id: 'sms-twilio', name: 'Twilio SMS', description: 'SMS messaging via Twilio', category: 'messaging', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['twilio'] }, envVars: ['TWILIO_SID', 'TWILIO_TOKEN', 'TWILIO_PHONE'], difficulty: 'medium', estimatedTime: '1h' },
  { id: 'push-fcm', name: 'Firebase Push Notifications', description: 'Push notifications via FCM', category: 'messaging', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['firebase-admin'] }, envVars: ['FCM_PROJECT_ID', 'FCM_PRIVATE_KEY'], difficulty: 'medium', estimatedTime: '1h' },
  { id: 'websocket', name: 'Socket.io Real-time', description: 'WebSocket real-time communication', category: 'messaging', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['socket.io'], frontend: ['socket.io-client'] }, difficulty: 'medium', estimatedTime: '1h', recommended: NODE_TEMPLATES },
  { id: 'slack-notify', name: 'Slack Notifications', description: 'Send notifications to Slack channels', category: 'messaging', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['@slack/web-api'] }, envVars: ['SLACK_TOKEN', 'SLACK_CHANNEL'], difficulty: 'easy', estimatedTime: '30min' },
  { id: 'discord-notify', name: 'Discord Notifications', description: 'Send notifications to Discord', category: 'messaging', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['discord.js'] }, envVars: ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'], difficulty: 'easy', estimatedTime: '30min' },
  { id: 'whatsapp', name: 'WhatsApp via Twilio', description: 'WhatsApp messaging via Twilio API', category: 'messaging', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['twilio'] }, envVars: ['TWILIO_SID', 'TWILIO_TOKEN', 'WHATSAPP_FROM'], difficulty: 'medium', estimatedTime: '1h' },
  // ANALYTICS
  { id: 'posthog', name: 'PostHog Analytics', description: 'Product analytics and feature flags', category: 'analytics', compatibleTemplates: REACT_TEMPLATES, packages: { backend: ['posthog-node'], frontend: ['posthog-js'] }, envVars: ['POSTHOG_KEY', 'POSTHOG_HOST'], difficulty: 'easy', estimatedTime: '15min', recommended: ['nextjs-app-router', 'nextjs-prisma'] },
  { id: 'ga4', name: 'Google Analytics 4', description: 'Web analytics via GA4', category: 'analytics', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['@analytics/google-analytics'] }, envVars: ['GA_MEASUREMENT_ID'], difficulty: 'easy', estimatedTime: '15min' },
  { id: 'mixpanel', name: 'Mixpanel', description: 'Event-based product analytics', category: 'analytics', compatibleTemplates: REACT_TEMPLATES, packages: { backend: ['mixpanel'], frontend: ['mixpanel-browser'] }, envVars: ['MIXPANEL_TOKEN'], difficulty: 'easy', estimatedTime: '15min' },
  { id: 'plausible', name: 'Plausible Analytics', description: 'Privacy-friendly web analytics', category: 'analytics', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['plausible-tracker'] }, envVars: ['PLAUSIBLE_DOMAIN'], difficulty: 'easy', estimatedTime: '15min' },
  { id: 'hotjar', name: 'Hotjar', description: 'Heatmaps and session recordings', category: 'analytics', compatibleTemplates: REACT_TEMPLATES, packages: {}, envVars: ['HOTJAR_ID'], difficulty: 'easy', estimatedTime: '10min' },
  // SECURITY
  { id: 'rate-limiting', name: 'Rate Limiting', description: 'API rate limiting with express-rate-limit', category: 'security', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['express-rate-limit'] }, difficulty: 'easy', estimatedTime: '15min', recommended: NODE_TEMPLATES },
  { id: 'cors-config', name: 'CORS Configuration', description: 'Cross-origin resource sharing setup', category: 'security', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['cors'] }, difficulty: 'easy', estimatedTime: '10min' },
  { id: 'helmet', name: 'Helmet.js', description: 'Secure HTTP headers', category: 'security', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['helmet'] }, difficulty: 'easy', estimatedTime: '10min', recommended: NODE_TEMPLATES },
  { id: 'csrf', name: 'CSRF Protection', description: 'Cross-site request forgery protection', category: 'security', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['csrf-csrf'] }, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'input-sanitize', name: 'Input Sanitization', description: 'Validate and sanitize user input', category: 'security', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['express-validator'], frontend: ['dompurify'] }, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'csp', name: 'Content Security Policy', description: 'CSP headers via Helmet', category: 'security', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['helmet'] }, difficulty: 'easy', estimatedTime: '15min' },
  // DEVOPS
  { id: 'docker', name: 'Docker + Compose', description: 'Containerize with Docker and docker-compose', category: 'devops', compatibleTemplates: ALL_TEMPLATES, packages: {}, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'github-actions', name: 'GitHub Actions CI/CD', description: 'Automated testing and deployment pipeline', category: 'devops', compatibleTemplates: ALL_TEMPLATES, packages: {}, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'husky', name: 'Husky + lint-staged', description: 'Git hooks for pre-commit linting', category: 'devops', compatibleTemplates: REACT_TEMPLATES, packages: { backend: ['husky', 'lint-staged'] }, difficulty: 'easy', estimatedTime: '15min', recommended: NODE_TEMPLATES },
  { id: 'prettier-eslint', name: 'Prettier + ESLint', description: 'Code formatting and linting', category: 'devops', compatibleTemplates: REACT_TEMPLATES, packages: { backend: ['prettier', 'eslint'] }, difficulty: 'easy', estimatedTime: '15min' },
  { id: 'sentry', name: 'Sentry Error Tracking', description: 'Real-time error monitoring', category: 'devops', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['@sentry/node'], frontend: ['@sentry/react'] }, envVars: ['SENTRY_DSN'], difficulty: 'easy', estimatedTime: '30min', recommended: NODE_TEMPLATES },
  { id: 'healthcheck', name: 'Health Check Endpoint', description: 'API health check for monitoring', category: 'devops', compatibleTemplates: ALL_TEMPLATES, packages: {}, difficulty: 'easy', estimatedTime: '10min' },
  // UI
  { id: 'dark-mode', name: 'Dark/Light Toggle', description: 'Theme switching with Tailwind dark mode', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: {}, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'toasts', name: 'Toast Notifications', description: 'Lightweight toast notifications', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['react-hot-toast'] }, difficulty: 'easy', estimatedTime: '15min', recommended: REACT_TEMPLATES },
  { id: 'skeletons', name: 'Loading Skeletons', description: 'Skeleton loading placeholders', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: {}, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'infinite-scroll', name: 'Infinite Scroll', description: 'Infinite scrolling with intersection observer', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['react-intersection-observer'] }, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'file-upload', name: 'File Upload', description: 'File upload with multer + S3', category: 'ui', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['multer', '@aws-sdk/client-s3'] }, envVars: ['S3_BUCKET', 'S3_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], difficulty: 'medium', estimatedTime: '1h' },
  { id: 'rich-text', name: 'Rich Text Editor', description: 'TipTap rich text editor', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['@tiptap/react', '@tiptap/starter-kit'] }, difficulty: 'medium', estimatedTime: '2h' },
  { id: 'data-tables', name: 'Data Tables', description: 'Sortable, filterable data tables', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['@tanstack/react-table'] }, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'charts', name: 'Charts (Recharts)', description: 'Data visualization with Recharts', category: 'ui', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['recharts'] }, difficulty: 'easy', estimatedTime: '30min', recommended: REACT_TEMPLATES },
  { id: 'pdf-gen', name: 'PDF Generation', description: 'Generate PDFs with Puppeteer', category: 'ui', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['puppeteer'] }, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'image-opt', name: 'Image Optimization', description: 'Image processing with Sharp', category: 'ui', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['sharp'] }, difficulty: 'easy', estimatedTime: '30min' },
  // API
  { id: 'openapi', name: 'OpenAPI/Swagger Docs', description: 'Auto-generated API documentation', category: 'api', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['swagger-ui-express', 'swagger-jsdoc'] }, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'graphql', name: 'GraphQL (Apollo)', description: 'GraphQL API with Apollo Server', category: 'api', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['@apollo/server', 'graphql'], frontend: ['@apollo/client'] }, difficulty: 'hard', estimatedTime: '3h' },
  { id: 'trpc', name: 'tRPC', description: 'End-to-end typesafe APIs', category: 'api', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['@trpc/server'], frontend: ['@trpc/client', '@trpc/react-query'] }, difficulty: 'hard', estimatedTime: '3h' },
  { id: 'api-versioning', name: 'API Versioning', description: 'Version your API routes (v1, v2)', category: 'api', compatibleTemplates: NODE_TEMPLATES, packages: {}, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'webhooks', name: 'Webhook System', description: 'Send and receive webhooks', category: 'api', compatibleTemplates: NODE_TEMPLATES, packages: {}, difficulty: 'medium', estimatedTime: '2h' },
  // STORAGE
  { id: 's3', name: 'AWS S3 Upload', description: 'File storage with AWS S3', category: 'storage', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['@aws-sdk/client-s3'] }, envVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_REGION'], difficulty: 'medium', estimatedTime: '1h' },
  { id: 'r2', name: 'Cloudflare R2', description: 'S3-compatible storage via Cloudflare R2', category: 'storage', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['@aws-sdk/client-s3'] }, envVars: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY', 'R2_SECRET_KEY', 'R2_BUCKET'], difficulty: 'medium', estimatedTime: '1h' },
  { id: 'local-storage', name: 'Local File Storage', description: 'Local disk file storage with multer', category: 'storage', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['multer'] }, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'cloudinary', name: 'Cloudinary CDN', description: 'Image/video CDN and transformations', category: 'storage', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['cloudinary'] }, envVars: ['CLOUDINARY_URL'], difficulty: 'easy', estimatedTime: '30min' },
  // AI
  { id: 'openai-integration', name: 'OpenAI Integration', description: 'GPT/ChatGPT API integration', category: 'ai', compatibleTemplates: ALL_TEMPLATES, packages: { backend: ['openai'] }, envVars: ['OPENAI_API_KEY'], difficulty: 'easy', estimatedTime: '30min' },
  { id: 'ollama-local', name: 'Ollama Local LLM', description: 'Local LLM inference via Ollama', category: 'ai', compatibleTemplates: ALL_TEMPLATES, packages: {}, envVars: ['OLLAMA_BASE_URL'], difficulty: 'easy', estimatedTime: '30min' },
  { id: 'rag', name: 'RAG (Vector Search)', description: 'Retrieval-augmented generation with embeddings', category: 'ai', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['langchain', '@pinecone-database/pinecone'] }, envVars: ['PINECONE_API_KEY', 'PINECONE_INDEX', 'OPENAI_API_KEY'], difficulty: 'hard', estimatedTime: '4h' },
  { id: 'ai-chatbot', name: 'AI Chatbot Widget', description: 'Embeddable AI chat widget', category: 'ai', compatibleTemplates: REACT_TEMPLATES, packages: { backend: ['openai'], frontend: ['ai'] }, envVars: ['OPENAI_API_KEY'], difficulty: 'medium', estimatedTime: '2h' },
  // TESTING
  { id: 'jest', name: 'Jest Unit Tests', description: 'Unit testing with Jest', category: 'testing', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['jest', '@types/jest', 'ts-jest'] }, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'playwright-e2e', name: 'Playwright E2E', description: 'End-to-end testing with Playwright', category: 'testing', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['@playwright/test'] }, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'vitest', name: 'Vitest', description: 'Fast unit testing for Vite projects', category: 'testing', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['vitest'] }, difficulty: 'easy', estimatedTime: '15min', recommended: REACT_TEMPLATES },
  { id: 'supertest', name: 'Supertest API Tests', description: 'HTTP assertion testing for APIs', category: 'testing', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['supertest', '@types/supertest'] }, difficulty: 'easy', estimatedTime: '30min' },
  { id: 'k6', name: 'k6 Load Testing', description: 'Performance and load testing', category: 'testing', compatibleTemplates: ALL_TEMPLATES, packages: {}, difficulty: 'medium', estimatedTime: '1h' },
  // MONITORING
  { id: 'uptime-monitor', name: 'Uptime Monitoring', description: 'Self-hosted uptime checks', category: 'monitoring', compatibleTemplates: ALL_TEMPLATES, packages: {}, difficulty: 'medium', estimatedTime: '1h' },
  { id: 'winston-logtail', name: 'Winston + Logtail', description: 'Structured logging with cloud aggregation', category: 'monitoring', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['winston', '@logtail/node'] }, envVars: ['LOGTAIL_TOKEN'], difficulty: 'easy', estimatedTime: '30min' },
  { id: 'apm', name: 'APM (Elastic)', description: 'Application performance monitoring', category: 'monitoring', compatibleTemplates: NODE_TEMPLATES, packages: { backend: ['elastic-apm-node'] }, envVars: ['ELASTIC_APM_SERVER', 'ELASTIC_APM_TOKEN'], difficulty: 'medium', estimatedTime: '1h' },
  { id: 'error-boundary', name: 'React Error Boundary', description: 'Graceful error handling in React', category: 'monitoring', compatibleTemplates: REACT_TEMPLATES, packages: { frontend: ['react-error-boundary'] }, difficulty: 'easy', estimatedTime: '15min', recommended: REACT_TEMPLATES },
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