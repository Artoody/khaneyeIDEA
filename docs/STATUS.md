# Project status (handover for people and AI agents)

Last updated: 2026-10-05, branch `claude/fervent-gauss-cdro10`.
Read `CLAUDE.md` first (rules), then this file (what exists and what is missing), then the spec for the area you touch.

## 1. What the project is

**Idea House (خانه ایده)** is a robotics, programming and AI academy for kids and teens in Tehran with several branches. This repo is its platform (product name in the proposal: «ایده‌یار»):

- the public website (replaces the old WordPress site, keeps its SEO);
- admin, teacher and parent panels;
- Bale and Telegram bots;
- booking for consultations and trial classes;
- running classes: sessions, attendance, reports, homework, cancellations;
- later: entry assessment, payments, AI helpers, SaaS for other academies.

Source documents:

| File | What it is |
|---|---|
| `docs/BRIEF.md` | one-page summary (Persian) |
| `docs/PROPOSAL.md` | full product proposal (Persian). §4.4 admin control room, §4.5 teacher panel, §4.13 notification center, §6 UX rules, §9 roadmap |
| `docs/specs/SITE-CONTENT.md` | everything business-related is editable in admin |
| `docs/specs/SESSION-LIFECYCLE.md` | session statuses, post-class bot flow, cancellations, the weekly session board |
| `docs/specs/AI-PROVIDER.md` | AI is optional, behind one interface, always human-approved |
| `docs/site-export/`, `docs/SITE-INVENTORY.md` | content and URLs exported from the old site |

## 2. Repo map

```
apps/web        Next.js 16 (App Router, cacheComponents) — public site + /app panels. Read apps/web/AGENTS.md: this Next.js differs from older versions.
apps/bot        grammY bots for Bale (https://tapi.bale.ai) and Telegram (proxy or relay API root)
packages/db     Drizzle schema (src/schema/*), SQL migrations (migrations/), seed from the old site (src/seed)
packages/core   framework-free logic with unit tests: auth/OTP/sessions, permissions, booking slots, class schedules, users
```

Main web paths (`apps/web/src`):

- `app/[lang]/…` — public pages: home, courses, course page, achievements, blog, book, login. `fa` is the default, `/en` is a full second locale.
- `app/[lang]/app/admin/…` — admin panel. `app/[lang]/app/teacher`, `app/[lang]/app/parent` — the other panels.
- `server/` — server-only helpers: `auth.ts` (session, `requirePermissionPage`), `content.ts` (cached readers), `sessions.ts` (week board queries), `admin.ts` (form parsing, `audit`).
- `lib/*-i18n.ts` — UI strings per area (`admin-i18n`, `ops-i18n`, …). `lib/jalali.ts` — Jalali dates, Tehran time.
- `proxy.ts` — locale routing and 308 redirects from old URLs (stored in the `redirects` table).

## 3. Running it

```
pnpm install
bash scripts/dev-services.sh      # Postgres, Redis, MinIO
pnpm db:migrate                    # applies packages/db/migrations
pnpm db:seed                       # base content from the old site (empty database only)
pnpm db:demo                       # development only: sample classes "(نمونه)", students, teacher and parent logins
pnpm dev                           # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm bot:check && pnpm bot:dev     # needs BALE_BOT_TOKEN / TELEGRAM_BOT_TOKEN in .env
```

- **Login.** Phone + 4-digit code. While no SMS or Bale OTP delivery exists, `OTP_DEV_CODE=1234` in `.env` makes `1234` work in development only.
- **Sessions.** They last 180 days and slide: they are renewed at most once a day.
- **Demo logins.** In development the first number that signs in becomes the owner when none exists yet. Or make a number owner with `pnpm --filter @khaneyeidea/db grant-role 09xxxxxxxxx owner "Your name"`. Teachers: `09120000101`–`09120000104`. Parents: `09350000001` and up.
- **E2E scripts.** They live in `apps/web/e2e/*.e2e.mjs` and run with playwright-core against a running dev server. Each file's header says how to run it.

## 4. What is done

| Area | State |
|---|---|
| Public site | Done. Home with intro video, scroll backdrop, department scenes. Catalog with filters, course pages with in-person and online, achievements by collapsible year, blog (10 old articles), light/dark theme, FA/EN switch. |
| SEO | Done. Old titles and descriptions carried over, 308 redirects for all 68 old URLs, sitemap with hreflang, robots, JSON-LD, OG image. |
| Admin CMS | Done. Settings and contacts, branches, departments, courses (prices with show/hide), teachers, achievements, page texts, blog posts. All with audit log. |
| Booking | Done. Appointment types, weekly time templates, closed days, public `/book` flow with phone code, admin list. |
| Auth and permissions | Done. OTP login (fixed code `OTP_DEV_CODE` in development, no rate limit then; first sign-in becomes owner when no owner exists, development only), roles, every page and action checks permission on the server. A signed-in account without permission lands on `/app/no-access` (friendly page), never a bare 404. |
| Admin dashboard | Done. Today's sessions, unanswered sessions, teachers' cancellation requests (approve with editable notice, or decline), upcoming bookings, quick actions, bot connection card, site content health. Navigation has icons and a badge on the session board. |
| Classes | Done. Weekday cards with filters, one form (course, teacher, room, mode, schedule, invite links), clash warning for teacher or room, class page with roster picker (search, tick several), groups and links card (bot connection code `/link CODE`, invite links, online room), upcoming sessions, extra or makeup session. Rooms page per branch. |
| Session board | Done. Week view, filters, summary bar, drawer: attendance, report, homework, not held with makeup, cancel ahead with parent notice, restore, move one session (day chips, 24h time, clash warning, optional notice), makeup session, delete an extra session. |
| Teacher panel | Done. Week by day with expandable class cards (students, group links), waiting-for-report list across three weeks, record or request cancellation, connect card for the bots. Own sessions only. |
| Parent portal | Done. Own children only: classes, next session, reports, homework, own child's attendance, own bookings, connect card. |
| Bots | Done and tested against a fake API (`pnpm bot:test`). Public menu, `/start CODE` links a chat, `/link CODE` links a class group, post-class conversation (first channel wins), group report without names, absent parents told privately, reminder after 2 hours, admin told after 21:00, timed notices sent. Never run against the real Bale/Telegram servers from this environment: do it once with real tokens. |

Logic lives in `packages/core` (`session-work.ts`, `followup.ts`, `linking.ts`, `classes.ts`) with DB tests (`pnpm test`). Timed jobs run inside the bot process every minute (`apps/bot/src/jobs.ts`); every step claims its row first, so a restart or a second process never sends twice.

## 5. Known gaps (what is still missing)

1. **Real OTP delivery** (Bale OTP or SMS). Until then development uses the fixed code.
2. **Admins are not told in the messenger when a teacher files a cancellation request.** They see it on the dashboard and on the board.
3. **Notification center** (PROPOSAL 4.13): per-admin choice of events, instant or digest, quiet hours. Only the `notification_prefs` table and an "off" check exist.
4. **Voice reports** (speech to text) are not supported; the bot asks for text.
5. **Per-student notes** after a class (step 5 of the conversation) and the parent's "request a makeup" button.
6. **No drag and drop, live "what is happening now" view, Ctrl+K search or undo** (PROPOSAL 4.4). The week board, dashboard and drawer cover daily work.
7. **Payments, entry assessment, AI features, SaaS tenant onboarding.**
8. **Media** still served from `public/media`; moving to MinIO is open. Run `pnpm --filter @khaneyeidea/db legacy-media` on a machine that has the old export images and commit `public/media/legacy`.
9. **Real-user testing** with 2 admins and 3 teachers, as PROPOSAL section 6 asks.
10. Class and session times are picked on a 5-minute grid; the booking template form still uses the browser's time input.

## 6. Tests

| Suite | Run |
|---|---|
| Core logic and DB (73) | `pnpm test` |
| Bot against a fake API | `pnpm bot:test` |
| Browser (playwright-core, dev server on :3000, `pnpm db:demo`, `OTP_DEV_CODE=1234`) | `node apps/web/e2e/<name>.e2e.mjs <dir>`: `ops` and `ops2` (panels), `admin-content`, `admin-branches`, `public-catalog`, `booking`, `auth` |

## 7. Conventions that bite

- **Request data inside Suspense.** In Next.js 16 with cacheComponents, `params`, `searchParams` and `usePathname` must be read inside `<Suspense>`. The pattern used everywhere is `params.then(...)` inside Suspense.
- **Server action files.** Every export of a `"use server"` file is a public endpoint. Check permission inside each action and never export helpers from these files.
- **Hidden routes stay in the DOM.** React Activity keeps previous routes mounted, so e2e selectors need `:visible`.
- **Time and calendar.** All time logic is in `Asia/Tehran`, with the week starting on Saturday (weekday 0 = Saturday). Use `lib/jalali.ts` and `packages/core` helpers, not ad-hoc `Date` math.
- **Schema changes.** Every table has `tenantId`. Change `packages/db/src/schema`, then run `pnpm db:generate` and `pnpm db:migrate`. Never edit an applied migration.
- **No hardcoding.** Nothing business-related is hardcoded: texts, prices, contacts and numbers come from the database.
