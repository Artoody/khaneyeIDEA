import { Bot } from "grammy";
import type { BotConfig } from "./config";

export function createBot(c: BotConfig) {
  return new Bot(c.token, {
    client: {
      apiRoot: c.apiRoot,
      ...(c.agent ? { baseFetchConfig: { agent: c.agent, compress: true } } : {}),
    },
  });
}

/** Explains the usual failures in plain words (wrong token, Telegram blocked without a proxy). */
export function explain(c: BotConfig, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/401|Unauthorized|not found/i.test(msg)) return "token rejected: check the token in .env (copy it again from BotFather / Bale's BotFather)";
  if (c.channel === "telegram" && /ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|fetch failed|timeout|network/i.test(msg))
    return "cannot reach Telegram. From Iran set TELEGRAM_PROXY_URL (e.g. socks5://127.0.0.1:10808) or TELEGRAM_API_ROOT in .env";
  return msg;
}
