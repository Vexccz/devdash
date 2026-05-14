# {{DISPLAY_NAME}}

Next.js 15 App Router + Tailwind CSS + Auth.js + Prisma + Stripe

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your env vars

# Set up database
npx prisma migrate dev

# Run dev server
npm run dev
```

## Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS 4
- **Auth:** Auth.js (NextAuth v5)
- **Database:** PostgreSQL + Prisma
- **Payments:** Stripe (Checkout + Webhooks)
- **Deployment:** Vercel-ready

## Project Structure

```
src/
├── app/
│   ├── (auth)/        # Login, register, forgot password
│   ├── (dashboard)/   # Protected routes
│   ├── api/           # API routes
│   └── layout.tsx     # Root layout
├── components/        # Shared components
├── lib/               # Utilities (db, auth, stripe)
└── prisma/            # Schema + migrations
```

## Environment Variables

See `.env.example` for all required variables.

## Deployment

Push to GitHub and connect to Vercel. Prisma migrations run automatically via `postbuild`.
