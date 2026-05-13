# {{DISPLAY_NAME}}

SaaS starter generated with create-saas-starter (Next.js 14 App Router + Prisma).

Stack:
- Frontend + backend: Next.js 14 (App Router, server components, route handlers)
- Database: Postgres + Prisma 5
- Auth: bcrypt + JWT in HTTP-only cookies
- Payments: Stripe Checkout + portal + webhook
- Admin: user management + stats
- Email: Resend (with console fallback)

## Setup

```bash
cp .env.example .env.local
# fill DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

npm run prisma:migrate     # create User table
npm run dev                # http://localhost:3000
```

Promote your first admin:
```bash
npm run make-admin you@example.com                  # promote existing user
npm run make-admin you@example.com yourpassword     # create + promote
```

## Deploy

- **Vercel:** push to GitHub, import the repo. Add all env vars from `.env.example`.
- **Database:** Neon / Supabase / Render Postgres / Railway.
- Run `npm run prisma:deploy` on first boot to apply migrations.

## License

MIT
