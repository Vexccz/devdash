# {{DISPLAY_NAME}}

SaaS starter generated with `create-saas-starter` (Postgres + Prisma variant).

Stack:
- Frontend: React + Vite + Tailwind
- Backend: Express + Prisma + Postgres + JWT + Stripe
- Auth: bcrypt + jsonwebtoken + password reset + welcome email
- Payments: Stripe Checkout + webhook + payment-success email
- Admin: user list, role/plan controls, revenue stats

## Setup

```bash
cp backend/.env.example backend/.env
# fill DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

cd backend
npm run prisma:generate
npm run prisma:migrate       # creates the User table
npm run dev                  # http://localhost:5000

cd ../frontend && npm run dev  # http://localhost:5173
```

Promote your first admin:
```bash
cd backend
npm run make-admin you@example.com                  # promote existing user
npm run make-admin you@example.com yourpassword     # create + promote
```

## Deploy

- **Frontend:** Vercel (auto-detects Vite). Set `VITE_API_URL` to your backend URL.
- **Backend:** Render / Railway / Fly. Run `npm run prisma:migrate deploy` on first boot.
- **Database:** Any managed Postgres (Render, Neon, Supabase, Railway).

## License

MIT
