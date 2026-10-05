import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export type Channel = "bale" | "telegram";

export type BotConfig = { channel: Channel; token: string; apiRoot: string; agent?: HttpsProxyAgent<string> | SocksProxyAgent };

/**
 * Bot settings from .env (never from code or chat). Bale's Bot API is Telegram-compatible at tapi.bale.ai.
 * Telegram is blocked from Iran: set TELEGRAM_PROXY_URL (http://, https:// or socks5:// e.g. a local v2ray
 * socks at socks5://127.0.0.1:10808) or TELEGRAM_API_ROOT (a relay server outside Iran).
 */
export function botConfigs(): BotConfig[] {
  const out: BotConfig[] = [];
  const bale = process.env.BALE_BOT_TOKEN?.trim();
  if (bale) out.push({ channel: "bale", token: bale, apiRoot: process.env.BALE_API_ROOT?.trim() || "https://tapi.bale.ai" });
  const tg = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (tg) {
    const proxy = process.env.TELEGRAM_PROXY_URL?.trim();
    const agent = !proxy ? undefined : proxy.startsWith("socks") ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy);
    out.push({ channel: "telegram", token: tg, apiRoot: process.env.TELEGRAM_API_ROOT?.trim() || "https://api.telegram.org", agent });
  }
  return out;
}

/** Public site address used in links (bots refuse localhost links in buttons, so those are sent as text). */
export const SITE_URL = (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
export const SITE_IS_PUBLIC = /^https:\/\/(?!localhost|127\.)/.test(SITE_URL);
