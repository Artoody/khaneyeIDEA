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
- **Demo logins.** Make yourself owner with `pnpm --filter @khaneyeidea/db grant-role 09xxxxxxxxx owner "Your name"`. Teachers: `09120000101`–`09120000104`. Parents: `09350000001` and up.
- **E2E scripts.** They live in `apps/web/e2e/*.e2e.mjs` and run with playwright-core against a running dev server. Each file's header says how to run it.

## 4. What is done

| Area | State |
|---|---|
| Public site | Done. Home with intro video, scroll backdrop, department scenes. Catalog with filters, course pages with in-person and online, achievements by collapsible year, blog (10 old articles), light/dark theme, FA/EN switch. |
| SEO | Done. Old titles and descriptions carried over, 308 redirects for all 68 old URLs, sitemap with hreflang, robots, JSON-LD, OG image. |
| Admin CMS | Done. Settings and contacts, branches, departments, courses (prices with show/hide), teachers, achievements, page texts, blog posts. All with audit log. |
| Booking | Done. Appointment types, weekly time templates, closed days, public `/book` flow with phone code, admin list. |
| Auth and permissions | Done. OTP login, roles (owner, admin, content_manager, teacher, parent, student), every page and action checks permission on the server (`packages/core/src/permissions.ts`). |
| Classes and sessions | Done (web only, see §5). Details in §5. |
| Teacher panel | Done (web only). Today, this week, "needs your answer", records attendance, report and homework for own sessions only. Can ask to cancel a future session (creates a request, does not cancel). |
| Parent panel | Done. Only own children: classes, next session, reports, homework, own child's attendance, own bookings. |
| Bots | Partly done. Token check and a first menu. No post-class flow yet. |

## 5. The class admin's panel (operations)

This is the person who sets up classes and runs the week (role `admin` or `owner`, permission `schedule.manage`). The proposal calls the panel the most important UX in the product: few clicks, smart defaults, no page hopping, works on the phone (PROPOSAL §4.4 and §6, SESSION-LIFECYCLE §4).

### Built

- **Classes** (`/app/admin/classes`). One form: title, course, teacher, in-person/online/hybrid, branch, weekday, start and end time, capacity, Jalali start and end date, online link.
  - Defaults: 17:00–18:30, capacity 8.
  - Saving creates the future sessions automatically. Editing the schedule adds or removes future untouched sessions and reports how many changed. Past or recorded sessions are never touched (`packages/core/src/classes.ts`).
  - The class page shows the roster and "seats n of c", adds a student from a list and changes an enrollment's status.
- **Students** (`/app/admin/students`). Search by name or parent phone. Adding a guardian creates or reuses the parent's login. Children's data is kept minimal (first name, last name, birth year).
- **Staff** (`/app/admin/staff`). Give or remove roles by phone.
- **Session board** (`/app/admin/sessions`). The heart of the panel.
  - Week view with "this week / next week / two weeks" buttons and arrows.
  - Status-coloured cards.
  - A summary bar whose counts filter the board.
  - Teacher and branch filters.
  - On phones, day columns swipe sideways.
  - Clicking a card opens a side panel without leaving the page. From there the admin can:
    - record attendance (everyone present by default), the report and homework (or "no homework");
    - mark "not held" with a reason and "needs makeup";
    - cancel a future session with a parent notice, which can be edited and is sent at 08:00 that morning or now;
    - restore a cancelled session.
  - A past session nobody answered shows as "awaiting teacher".

### Missing or weaker than the spec

These are listed in the order they matter for daily ease of use:

1. **Teacher cancellation requests are not shown to the admin.** They are stored in `cancellation_requests`, but there is no inbox and no badge on the card. A teacher's request is therefore invisible until this is built (SESSION-LIFECYCLE §3 and §4).
2. **Scheduled notices are not sent.** `scheduled_announcements` rows are created, but there is no BullMQ worker or bot sender yet.
3. **No post-class bot follow-up.** The teacher must open the web panel. The Bale/Telegram flow in SESSION-LIFECYCLE §2 is the intended main path for teachers.
4. **No per-session actions beyond cancel.** These are all missing: reschedule a single session, create a makeup session, message the class parents, "remind the teacher again".
5. **No conflict check.** Nothing warns when a teacher or room is double-booked. Rooms exist in the schema (`rooms`) but are not used in the class form.
6. **Board filters are incomplete.** Teacher and branch exist. Course, online/in-person and status (except via the summary bar) are missing.
7. **No day "control room".** PROPOSAL §4.4 asks for columns per teacher or room, drag-and-drop to move a class, a live "what is happening now" view and Ctrl+K global search. None of that exists yet. The week board covers the basic need.
8. **No undo.** Only "restore" for cancellations. Other changes save immediately, without a confirmation step or undo. The audit log records them.
9. **Thin dashboard.** The admin dashboard shows content health only, not today's sessions, unanswered sessions or new bookings.
10. **No group linking.** Class group linking to Bale/Telegram (`chat_links`) has no UI.
11. **Missing roster tools.** No student transfer, payment status or attendance history on the roster.
12. **Not yet tested with real users.** The proposal asks for testing with 2 admins and 3 teachers before calling this easy to use.

### Suggested next steps for the class admin

1. Cancellation-request inbox and card badges.
2. Today's sessions and unanswered sessions on the admin dashboard.
3. Reschedule and makeup for a single session.
4. Teacher/room conflict warnings in the class form.
5. The scheduled-notice sender and the post-class bot flow.

## 6. Other open work

- Real OTP delivery (Bale OTP or SMS).
- The notification center (PROPOSAL §4.13).
- Payments.
- Entry assessment.
- AI features. They must follow `docs/specs/AI-PROVIDER.md`: no child-identifying data goes to providers, and a human approves every output.
- Moving media to MinIO.
- Committing `public/media/legacy` after running `pnpm --filter @khaneyeidea/db legacy-media` on a machine that has the old export images.

## 7. Conventions that bite

- **Request data inside Suspense.** In Next.js 16 with cacheComponents, `params`, `searchParams` and `usePathname` must be read inside `<Suspense>`. The pattern used everywhere is `params.then(...)` inside Suspense.
- **Server action files.** Every export of a `"use server"` file is a public endpoint. Check permission inside each action and never export helpers from these files.
- **Hidden routes stay in the DOM.** React Activity keeps previous routes mounted, so e2e selectors need `:visible`.
- **Time and calendar.** All time logic is in `Asia/Tehran`, with the week starting on Saturday (weekday 0 = Saturday). Use `lib/jalali.ts` and `packages/core` helpers, not ad-hoc `Date` math.
- **Schema changes.** Every table has `tenantId`. Change `packages/db/src/schema`, then run `pnpm db:generate` and `pnpm db:migrate`. Never edit an applied migration.
- **No hardcoding.** Nothing business-related is hardcoded: texts, prices, contacts and numbers come from the database.
