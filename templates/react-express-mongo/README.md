# {{DISPLAY_NAME}}

SaaS starter generated with `create-saas-starter` (React + Express + MongoDB variant).

Stack:
- Frontend: React + Vite + Tailwind
- Backend: Express + Mongoose + JWT + Stripe
- Auth: bcrypt + jsonwebtoken + password reset + welcome email
- Payments: Stripe Checkout + webhook + payment-success email
- Admin: user list, role/plan controls, revenue stats

## Setup

```bash
cp backend/.env.example backend/.env
# fill MONGODB_URI, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

cd backend && npm run dev       # http://localhost:5000
cd frontend && npm run dev      # http://localhost:5173
```

Promote your first admin:
```bash
cd backend
npm run make-admin you@example.com                  # promote existing user
npm run make-admin you@example.com yourpassword     # create + promote
```

## Deploy

- **Frontend:** Vercel (auto-detects Vite). Set `VITE_API_URL` to your backend URL.
- **Backend:** Render / Railway / Fly.
- **Database:** MongoDB Atlas free tier works.

## License

MIT
