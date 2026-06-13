# SplitFair — Shared Expenses App

A full-stack shared expenses app for flatmates, built for the Spreetail internship assignment.

**AI used:** Cursor (Claude)

## Features

- Email/password login (NextAuth)
- Groups with join/leave membership dates
- Expenses with equal, unequal, percentage, and share splits
- USD → INR conversion with configurable rate
- Balance summary + minimal settlement suggestions (Aisha)
- Per-expense breakdown per member (Rohan)
- CSV import with anomaly detection and approval workflow (Meera)
- Settlement recording

## Quick start

```bash
npm install
cp .env.example .env
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo login:** `aisha@flat.test` / `password123`

## Import the CSV

1. Register or sign in
2. Create a group (or use the pre-seeded flatmates group)
3. Go to **Import** tab → upload `expenses_export.csv`
4. Review the import report and approve/reject pending items

## Tech stack

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** SQLite (local dev) — relational; switch to PostgreSQL for production (see `docker-compose.yml`)
- **ORM:** Prisma
- **Auth:** NextAuth.js (credentials)

## Production deployment

1. Create a PostgreSQL database (Neon, Supabase, or `docker compose up -d`)
2. Change `provider` in `prisma/schema.prisma` to `postgresql` and restore enum/Json types
3. Set env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `USD_TO_INR_RATE`
4. Deploy to Vercel/Railway: `npm run build && npm start`

## Project structure

```
src/lib/import/importer.ts   — CSV parser + anomaly detection
src/lib/balances.ts          — Split math, balances, settlements
src/lib/utils.ts             — Date/amount parsing, name normalization
prisma/schema.prisma         — Database schema
expenses_export.csv          — Original assignment CSV (unchanged)
```

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npx tsx scripts/test-import.ts   # Run import and print report
npx tsx prisma/seed.ts           # Seed demo user
```
