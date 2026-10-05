# Idea House (خانه ایده) platform: project rules

Read this before any work. These rules apply to every contributor and every AI agent (Claude, Cursor).

## Product
Platform for Idea House Academy (robotics, programming, AI for kids and teens, Tehran): public website, admin / teacher / parent panels, Bale and Telegram bots, booking, session follow-up, entry assessment.
Specs live in `docs/`: `PROPOSAL.md` (product), `specs/*.md` (implementation contracts), `site-export/` (data from the old WordPress site).

## Non-negotiables
1. **Top-tier, professional quality.** The public site must feel premium and modern: minimal, fast, purposeful motion, flawless on mobile. No template look, no placeholder-looking UI shipped. Follow `anthropic-skills:taste-skill` for marketing pages.
2. **Everything is admin-editable. Nothing business-related is hardcoded.** Courses, departments, branches, teachers, contacts, phone numbers, social links, achievements, projects, FAQs, page texts, SEO fields, prices (with show/hide) all come from the database and are edited in the admin panel. New branches can be added at any time. See `docs/specs/SITE-CONTENT.md`.
3. **Persian first, RTL first, Jalali calendar, `Asia/Tehran`.** English is a full second locale (`/en`), not an afterthought.
4. **Security and children's privacy.** Authorization is always checked on the server. Children's personal data is minimized, never posted in groups, never sent to AI providers with identifying details. Photos of children only with recorded parental consent.
5. **Multi-tenant ready** (`tenantId` on every table) for a future SaaS version.
6. **AI is optional and replaceable.** Every AI feature has a non-AI path and a human approval step. Providers sit behind one interface. See `docs/specs/AI-PROVIDER.md`.
7. **No fake numbers.** Counts and stats shown on the site come from real data.

## Brand
- Logo: circuit house, amber `#FFB347`. Official Instagram: `khane_ide_academy`.
- Motion reference: `design/motion/intro/`.

## Stack (decided)
TypeScript monorepo (pnpm + Turborepo): Next.js App Router, Tailwind v4, shadcn/ui (customized), Phosphor icons, Motion; PostgreSQL + Drizzle ORM (SQL migrations in packages/db/migrations); Redis + BullMQ; MinIO; grammY bots for Bale (`https://tapi.bale.ai`) and Telegram; Python service only for speech-to-text.

## Model use (Cursor)
Pick Opus 5.5 manually for auth, permissions, payments, migrations, bots, scheduling. Sonnet 5.5 for UI and CRUD. Auto only for trivial edits.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
