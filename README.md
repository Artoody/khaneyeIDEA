# khaneyeIDEA

Platform for Idea House Academy (خانه ایده): public site (fa/en), admin panel, booking, and Bale/Telegram bots.
Project rules: `CLAUDE.md`. Product and specs: `docs/`.

## Run locally

Needs Node 22+, pnpm 10, and Docker (or a local Postgres 16 + Redis 7).

```bash
docker compose up -d          # Postgres, Redis, MinIO
pnpm install
cp .env.example .env          # then set SESSION_SECRET to a long random value
pnpm db:migrate               # create / update tables (safe to run any time)
pnpm db:seed                  # FIRST TIME ONLY: loads the old site's content (it replaces site content)
pnpm --filter @khaneyeidea/db grant-role 09xxxxxxxxx owner "Your name"
pnpm dev                      # site on http://localhost:3000, panel at /app/admin
```

Sign-in codes are printed in the terminal while `OTP_PROVIDER=console`.

## Bots (Bale and Telegram)

1. Put the tokens in `.env` (never in code, never in chat): `BALE_BOT_TOKEN=...`, `TELEGRAM_BOT_TOKEN=...`
2. Telegram is blocked from Iran: set `TELEGRAM_PROXY_URL` (e.g. `socks5://127.0.0.1:10808` from v2ray) or `TELEGRAM_API_ROOT` (a relay outside Iran).
3. `pnpm bot:check` verifies each token (prints the bot's username).
4. `pnpm bot:dev` runs both bots. Send `/start` to the bot in Bale/Telegram.

What the bots do besides the public menu:

- **Connect your own chat.** In the panel (dashboard for admins, teacher panel, parent portal) press "Create connection code", then send `/start CODE` to the bot in a private chat.
- **Connect a class group.** On the class page, "Groups and links" gives `/link CODE`; add the bot to the class's Bale or Telegram group and send that in the group.
- **After each class** (10 minutes after it ends) the bot asks the teacher in every connected messenger: held or not, attendance, report, homework, preview, send. The first messenger to answer wins; the other prompt is deleted or edited. The report goes to the class group (never with student names) and absent children's parents are told privately. An unanswered session gets a reminder after 2 hours and the admin is told after 21:00.
- **Notices** approved in the panel (cancellations, moved sessions) are sent at their time to the class group.
- `pnpm bot:test` runs the real bot against a local fake of the bot API (no tokens needed) and plays this whole flow.

Links in bot messages point to `SITE_URL`; while it is `localhost` they are sent as text (bots refuse localhost buttons).

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test
```
