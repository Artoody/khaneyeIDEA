# Project status (handover for people and AI agents)

Last updated: 2026-10-15, branch `claude/fervent-gauss-cdro10` (includes the Cursor teacher PWA work).
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
- `app/[lang]/app/admin/…` — admin panel. `app/[lang]/teacher` (the coach app; `/app/teacher` redirects to it), `app/[lang]/app/parent` — the other panels.
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
| Booking | Done. Appointment types, public `/book` flow with phone code, admin list. **Booking calendar** (`/app/admin/booking/calendar`): the admin paints the open hours on a weekly grid (30 minute cells, drag with the mouse or tap; tap a weekday or an hour to flip a whole column or row), picks slot length and seats, and everything not painted stays closed. A second tab is a Jalali month calendar with free and booked counts per day; a day shows who booked each slot (confirm or cancel from there), can be closed or reopened, and can get extra hours for that date only. Saving never deletes a window that has upcoming bookings (it is switched off for new bookings instead). Public flow: Jalali month calendar of days that have free times, a one-tap "soonest free time", then the hour chips. Hand-made weekly templates and closed days still exist under "advanced". **New booking notices:** the bot job tells every admin in Bale and Telegram (and by web push) within a minute, with Confirm and Cancel buttons; a booking is claimed before sending, retried while nobody can be reached, and never announced when older than a day. |
| Desktop menu | The side menu collapses to an icon rail (button at its bottom; remembered per browser, restored before first paint). Class cards are compact (time block, name, course, coach and place, a ring for seats). The timetable gives busy days wider columns and shows coach and title for up to five classes at the same hour. |
| Class timeline and quick panel | On a desktop the weekday view is a timeline: one row per day, each class as wide as its hours, overlapping classes in their own lanes, coach name on top, a "now" line on today. Clicking a class (any view) opens a side panel to change its coach, day and time (clash warning, future sessions follow) and its students (remove, search and add) without leaving the list; Ctrl/Cmd-click still opens the full class page. The panel is kept in the address (`?open=`). Items rise in one after another, the view switch has an animated pill, the loading state is a shimmering skeleton with a progress bar (all respect reduced motion). |
| UI sounds | Short synthesized sounds (tick, pop, open, close, success, error, remove) on choices, saves and errors; a speaker button in the header turns them off (remembered). |
| Phone navigation | A bottom tab bar (dashboard, session board, classes, students) plus a menu button, instead of a floating button. |
| Auth and permissions | Done. OTP login (fixed code `OTP_DEV_CODE` in development, no rate limit then; first sign-in becomes owner when no owner exists, development only), roles, every page and action checks permission on the server. A signed-in account without permission lands on `/app/no-access` (friendly page), never a bare 404. |
| Admin dashboard | Done. Today's sessions, unanswered sessions, teachers' cancellation requests (approve with editable notice, or decline), upcoming bookings, quick actions, bot connection card, site content health. Navigation has icons and a badge on the session board. |
| Classes | Done. One page, four views (weekday, coach, branch, weekly timetable), search, in-person/online filter, and a coach strip to see one coach at a time (banner with that coach's classes, enrolments and hours, plus "new class for this coach"). The view and coach are kept in the address. Timetable on desktop, agenda on phones. New class form in blocks with chips (coach, weekday, length 45/60/90/120 that sets the end time), 24h time pickers, an automatic name when left empty, rooms, clash warning for coach or room, invite links. Class page: roster picker (search, tick several), a new student with one parent added right there, groups and links (bot connection code `/link CODE`), upcoming sessions, extra or makeup session, delete a class that has no history. Rooms page per branch. Each enrollment is a 6- or 7-session package with its own term start; roster and student pages show progress (`۳ / ۷`) and let you edit the package. Academy `terms` stay as season labels on the class only. |
| Session board | Done. Week view, filters, summary bar, drawer: attendance, report, homework, not held with makeup, cancel ahead with parent notice, restore, move one session (day chips, 24h time, clash warning, optional notice), makeup session, delete an extra session. |
| Coaches | The four coaches (Alireza Alizadeh Rad, Milad Moradi, Bidhendi, Amirhossein Pourghasem) are in the seed and in `pnpm --filter @khaneyeidea/db team`; profiles start hidden on the public site until a photo and bio are added. The coaches list shows each coach's classes and students; a coach with no classes can be deleted. `pnpm db:demo` gives each coach three classes and 24 students, and teacher logins 09120000101 to 09120000104 in the same order. |
| Teacher app | Phone-first PWA at `/teacher` (texts in `tp` of `ops-i18n`, fa and en), own username and password (set in the teacher form in admin; first login forces a change). Three tabs: **Today** (a hero card for the class in session or the next one with the one button that matters, the report form right under it, reports still owed, today's list), **Week** (day chips, one day's classes), **Profile** (photo, default class link, notifications, bot connection, password). Tapping a class opens a bottom sheet (attendance, report, cancellation request). The report form has big present/absent toggles, 0-5 activity and 0-3 homework chips, a note per student (the group only sees counts), text or voice for report and homework, and a sticky send bar. Per-class AI switch. Installable with Web Push. Layout: `components/teacher/*`. |
| Reports | Text or voice. AI on rewrites via `packages/ai` and the fallback proxy; AI off keeps a plain template. Trial default: admin approves in `/app/admin/reports` or with Bale buttons before the group post. |
| Bots | Done and tested against a fake API (`pnpm bot:test`). Public menu, `/start CODE` links a chat, `/link CODE` links a class group, `/groups` lists classes with no group. Post-class conversation (first channel wins), group report without names, absent parents told privately, reminder after 2 hours, admin told after 21:00, evening-before "class is on" notice with the class link, and a daily reminder when a teacher was asked in the group and did not answer. Never run against the real Bale/Telegram servers from this environment: do it once with real tokens. |
| Parent portal | Done. Own children only: classes, next session, reports, homework, own child's attendance, own bookings, connect card. |

Logic lives in `packages/core` (`session-work.ts`, `followup.ts`, `linking.ts`, `classes.ts`) with DB tests (`pnpm test`). Timed jobs run inside the bot process every minute (`apps/bot/src/jobs.ts`); every step claims its row first, so a restart or a second process never sends twice.

## 5. Known gaps (what is still missing)

1. **Real OTP delivery** (Bale OTP or SMS). Until then development uses the fixed code. The teacher app uses a username and password instead.
2. **Admins are not told in the messenger when a teacher files a cancellation request.** They see it on the dashboard and on the board. A pending class report does reach them in Bale and as a web push.
3. **Notification center** (PROPOSAL 4.13): per-admin choice of events, instant or digest, quiet hours. Only the `notification_prefs` table and an "off" check exist. Teacher and admin web push is separate and is on when the browser is subscribed.
4. **Per-student notes** after a class (step 5 of the conversation) and the parent's "request a makeup" button.
5. **No drag and drop, Ctrl+K search or undo** (PROPOSAL 4.4). The week board, dashboard and drawer cover daily work. The teacher app does show the class that is on now.
6. **Payments, entry assessment, SaaS tenant onboarding.**
7. **Media** still served from `public/media`; voice notes sit in `.devdata/voices`. Moving to MinIO is open.
8. **Real-user testing** with 2 admins and 3 teachers, as PROPOSAL section 6 asks.
9. Class and session times are picked on a 5-minute grid; the booking template form still uses the browser's time input.
10. **Bale must be a group admin** to see ordinary messages (the question reminder depends on that). iOS web push needs Add to Home Screen and iOS 16.4+.

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
