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

Links in bot messages point to `SITE_URL`; while it is `localhost` they are sent as text (bots refuse localhost buttons).

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test
```
