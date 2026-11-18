# SangSafar · product truth (v1)

**The job:** "I'm travelling home. Find me a college student going the same way."

Students post a trip (from, to, date, departure window, mode: train, bus,
flight or cab). They see ranked students from their own campus on the same route
that day, send a connect request, and on mutual accept get a chat plus each
other's private trip details. Cab is just a trip mode: no pools, groups,
capacity, fares or booking.

## What v1 does

| Area | Behaviour | Where |
|---|---|---|
| Access | Anyone browses demand counts. Posting and connecting need a verified college email. | `demand_strip`, `requireViewer` |
| Signup | Email + OTP. College from the email domain. **Unlisted domains get in provisionally** (owner decision, below). Webmail (Gmail, Outlook, Yahoo…) and rejected domains are refused, even through the Auth API directly (trigger fails closed). Email changes are blocked. | `app/actions/auth.ts`, `app.college_for_domain` |
| Trips | draft (hidden) → live → archived after the date. Optional train/flight no., meetup, notes are private. Never PNR, seat or ticket. Overnight windows are rejected; post two trips instead. | `create_trip`, `update_trip`, `set_trip_status`, `delete_trip` |
| Matching | Hard gates in SQL (`app.pair_eligible`): different owners, same campus, same date (campus timezone), same from/to hubs, both upcoming, both active, no block, women-only rules. Ranking in `lib/matching.ts`: route 100/60, time `max(0, 40 − 10·gap_h)`, +30 same vehicle, +20 same college. | `match_candidates`, `rankCandidates` |
| Cards | First name, college, year, badges, mode, window. Reason in words ("Leaves within your window"), never a score, never same-train inference. | `app/trips/[id]` |
| Requests | Bind two trips. Unique per unordered trip pair. 10/day. Expire at 48h or when the earlier window closes. Declined pairs never resurface. Sending is consent (copy shown before send). | `send_connect_request`, `respond_to_request`, `cancel_request` |
| Edits | Any real change cancels pending requests and closes chats on that trip, so changed details are never shared without renewed consent. The edit form says this before saving. | `update_trip` |
| Chat | Realtime, only inside an accepted, unblocked match of two active users. Idempotency key per message. A failed send keeps its text with Retry. | `messages` RLS, `app.can_chat` |
| Safety | Report + block on every card and chat. Block revokes instantly. Reports dedupe per (reporter, user, context), 5/day. Auto-suspend at 3 distinct open reporters, pending review. | `block_user`, `report_user` |
| Women-only | See below. | |
| Trust | "Travelled together" needs both sides to confirm, on or after the travel day. | `confirm_travelled` |
| Share links | `/s/<token>`. Logged out: route, date, mode only (page, metadata, everything). Verified same-college viewer: card too. Women-only trips: unavailable to anyone ineligible. | `share_card` |
| Demand | Distinct eligible students per route-day. Under 5, including zero, shows "Low demand". Women-only trips and suspended users never count. Only fixed 7-day windows on one exact route, so no slice can be subtracted. Computed live, so deleted users stop counting immediately. | `demand_strip` |
| Deletion | Real: ordered purge of messages, confirmations, matches (anonymised to "Deleted user", closed), reports, blocks, trips + details, profiles, then the Auth user via the admin API. Retains nothing. Retry-safe. | `purge_user`, `deleteMyData` |
| Admin | Report queue (no reporter identities), suspend/restore, requested colleges, ID check recorded as checked + date with no documents. Every function re-checks the admin role in the database. | `/admin`, `admin_*` |
| Email | Match found, request received, request accepted. Plain text, no names or routes. Skipped without `RESEND_API_KEY`. | `lib/notify.ts` |
| Analytics | Server-side PostHog events (signup, trip_posted, match_shown, request_sent, request_accepted, travel_confirmed) with an opaque user id only. No client SDK, so no session recording. | `lib/notify.ts` |
| Errors | Sentry with no user info, cookies, headers, bodies, query params or breadcrumbs. | `lib/sentry-scrub.ts` |

### Women-only comfort filter

- The toggle exists only for users who self-declare as women in the optional,
  private gender field. They then opt in explicitly in their profile.
- Bidirectional: if either trip is women-only, both owners must be
  self-declared women who opted in. Women-only trips never reach anyone else
  through matches, requests, share links or demand counts.
- Ordinary matching is untouched for everyone. Not opting in never hides anyone.
- Copy everywhere: it filters who you match with, relies on self-declared
  data, doesn't verify gender, and isn't a safety feature.

### Provisional colleges (owner decision, 18 Nov 2026)

When a student signs up with a domain that isn't in the registry:

1. The domain is queued in `/admin` ("Colleges awaiting approval", with a count
   of verified students), and the student still proves inbox control with the OTP.
2. They're admitted straight away and told plainly: "We don't have <domain> on
   SangSafar yet… we'll verify your college as soon as possible". A banner stays
   until review.
3. Until then they match only with students on the same domain (same-campus
   rule), use a generic hub list, and their badge reads "Email verified ·
   college under review", never "College email verified".
4. **Approve** sets the real name, code, city and hubs, and the campus becomes
   normal. **Reject** switches every account on the domain off (matching,
   chat, share links, demand) and blocks new signups from it.

Webmail never qualifies. This replaces the brief's "no access before the
approved verification flow"; the trade-off is accepted by the owner.

## Privacy architecture

RLS filters rows; it can't hide columns. So:

- Every base table is owner-only (or participant-only) under RLS. Private
  fields live in separate tables (`private_profiles`, `private_trip_details`).
- anon and authenticated start with **no** table grants. Only owner reads and
  a few owner-editable columns are granted back. Badges, suspension, email and
  college are never user-writable.
- Every cross-user read is a `security definer` RPC that checks match, block,
  suspension and women-only state first. Internal helpers live in schema
  `app`, which the Data API doesn't expose.
- `match_candidates`, `purge_user` and `run_housekeeping` are service-role
  only. The service key is server-only.
- Tested (`tests/privacy.test.ts`): with the browser's anon key, and as a
  signed-in student, a direct `select` on every base table never returns
  anyone else's email, name, gender, vehicle number, notes, meetup point, chat
  or reports.
- No caching of authenticated HTML: the proxy sets `Cache-Control: private,
  no-store`, and the service worker caches only hashed static assets.

## Deliberate deviations from the brief (flagged, not silent)

1. **PostGIS not used.** Route compatibility uses each college's hub registry
   (exact from/to hub, with pickup/drop spots for the 100 vs 60 tier). Geo
   points would need a geocoder, an external service not in v1. Add when
   cross-hub or distance matching is designed.
2. **Separate `trips` table rather than a `public_trip_cards` table.** Same
   guarantee: the base table is owner-only and cards come only from checked
   RPCs. Private fields are in `private_trip_details` as specified.
3. **No `score` column on `matches`.** The rank is recomputed each view. A
   stored score would be either client-supplied (untrusted) or a second copy
   of the scorer in SQL.
4. **Profile photo not built.** The brief allows it as optional, but no v1
   screen may show it (cards are name, college, year and badges only), so
   storage, uploads and the deletion of files are deferred. Storage is disabled
   in `supabase/config.toml`.
5. **Background jobs:** notifications run after the response via `after()`,
   and a daily Vercel Cron (`/api/cron`) archives trips and expires requests.
   No separate queue service. Correctness never depends on the cron, because
   every read re-checks dates.
6. **End-to-end tests are API-level** (the same calls the actions and browser
   make, as two real signed-in users), not browser-driven. The browser path is
   exercised by `scripts/screenshots.mjs`, which signs in through the real OTP
   form.
7. **Women-only filter chip** narrows matches to trips whose owners chose
   women-only. It never filters by anyone's declared gender.

## Out of scope for v1 (roadmap, not omissions)

AI trip parsing · cross-college matching · cab pools, grouping and fare
splitting (`cab_pools` is a stub table only) · trip groups · web push · trust
scores · live location and SOS · any payments or booking.

## OPEN: owner decisions (placeholders in place)

- ~~First launch campus~~ **Decided:** Lovely Professional University
  (`@lpu.in`), live via migration `20261118010000`. Its hubs (LPU Campus,
  Phagwara, Jalandhar, Ludhiana, Amritsar, Chandigarh, Delhi and the three
  airports) are a first guess; edit the `colleges` row to change them. Local dev
  still has the fictional `CAMPUS1` / `example.edu` seed for testing.
- **Moderation owner and response standard:** tooling exists, the human
  process doesn't.
- **Name clearance:** "SangSafar" has no domain or trademark check yet. The
  name is `NEXT_PUBLIC_APP_NAME` in one place.
- **Open-source license:** TBD, so there is no LICENSE file.
- **OTP deliverability on real college domains:** untested. The manual
  requested-college queue stays. Hosted Supabase needs custom SMTP.
- **Privacy policy:** retention is nothing by default. Any abuse-prevention
  retention needs an approved policy first. Supabase backup purge timing must
  be documented from the chosen plan, and the deletion copy doesn't promise
  instant backup erasure.
- **Font license files:** copy the OFL texts into `public/fonts/` before
  launch.
