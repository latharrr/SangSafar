# SangSafar

Your route, your people. A college-email-verified web app where students find
other students making the same journey and choose to travel together.
Not a booking app: no tickets, payments or PNRs.

- Product truth, privacy model and open decisions: [PRODUCT.md](PRODUCT.md)
- Visual system: [DESIGN.md](DESIGN.md)
- Screenshots from the verification pass: [docs/screenshots](docs/screenshots)

## Stack

Next.js 16 (App Router) + Tailwind 4, installable PWA · Supabase Postgres, Auth
(email OTP), Realtime (chat) · Resend (email) · Sentry · PostHog · Vercel.

## Local setup

Needs Node 24+ and Docker running.

```bash
npm install
npx supabase start          # local Postgres/Auth/Realtime, applies migrations + seed
npx supabase status -o env  # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY into .env.local
cp .env.example .env.local  # then paste the three values above
npm run dev                 # http://localhost:3000
```

This project uses ports **55320–55329** (not Supabase's defaults) so it can run
next to another local Supabase project.

**Sign in locally:** use any seeded student, e.g. `aarav@example.edu`. The OTP
email lands in Mailpit at http://127.0.0.1:55324. `kavya@example.edu` is the
demo moderator (`/admin`). All seed people and data are fictional
([supabase/seed.sql](supabase/seed.sql)), and dates are relative to today so the
demo never goes stale.

That local stack is the isolated demo: real OTP, real RLS, fictional data, no
external services. There is no fake-auth mode, so a deployment without
credentials fails closed instead of pretending to be secure.

## Commands

| | |
|---|---|
| `npm run db:reset` | Rebuild the database from migrations + seed |
| `npm test` | Unit, integration and end-to-end tests (needs the local stack) |
| `npm run lint` / `npm run typecheck` | Static checks |
| `node scripts/screenshots.mjs` | Visual pass: signs in through the real OTP form and screenshots every screen at 390 and 1280px (needs `npm run dev` and local Chrome) |

Run `npm run db:reset` before `npm test` or the screenshot script for
predictable data. Tests create their own fictional users, and the screenshot
script posts one trip.

## Colleges

**Live:** Lovely Professional University (`@lpu.in`). Students on any other
non-webmail domain get in provisionally and appear in `/admin` for approval
(see PRODUCT.md, "Provisional colleges").

To add one directly, it's one registry row, no code change:

```sql
insert into public.colleges (name, code, email_domains, city, hubs, timezone, status)
values ('Example College', 'EXC', '{example-college.ac.in}', 'City',
        '{Example Campus,Delhi,Chandigarh,City Airport}', 'Asia/Kolkata', 'active');
```

`hubs` are the places students pick as From/To (campus first). Domains are
lowercase, exact match. Moderators can also activate a requested domain from
`/admin`. Rollout is one campus at a time.

## Tunables

`public.app_settings` (one row): `connect_daily_limit` (10),
`report_daily_limit` (5), `suspend_threshold` (3 distinct reporters),
`request_expiry_hours` (48). The product name lives in `lib/config.ts`
(`NEXT_PUBLIC_APP_NAME`).

## Layout

```
app/                 routes; app/actions/* are the server actions
components/          route line, time ruler, demand stepper, forms, nav
lib/matching.ts      scorer + trip validation (pure, unit-tested)
lib/session.ts       viewer / auth helpers
lib/notify.ts        Resend email + PostHog events (both optional)
supabase/migrations  schema, RLS, every RPC
supabase/seed.sql    fictional demo data
tests/               privacy sweep, safety, end-to-end (against local Supabase)
```

## Deploying (not done; needs owner approval)

Create a Supabase project, run `npx supabase link` then `npx supabase db push`,
and set the same env vars on Vercel. Also set `CRON_SECRET`, which Vercel Cron
sends to `/api/cron` daily. In the hosted project: turn on custom SMTP, set
`otp_length` to match `NEXT_PUBLIC_OTP_LENGTH`, and configure the OTP email
template as in `supabase/templates/otp.html`.

## License

TBD (see PRODUCT.md, OPEN).
