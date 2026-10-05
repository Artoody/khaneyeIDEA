// Verifies each configured token with getMe without starting the bots: `pnpm bot:check`.
import { botConfigs } from "./config";
import { createBot, explain } from "./bots";

const configs = botConfigs();
if (!configs.length) {
  console.log("No bot tokens in .env. Add BALE_BOT_TOKEN and/or TELEGRAM_BOT_TOKEN, then run again.");
  process.exit(1);
}
let failed = 0;
for (const c of configs) {
  try {
    const me = await Promise.race([
      createBot(c).api.getMe(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout after 15s")), 15_000)),
    ]);
    console.log(`✔ ${c.channel}: @${me.username} (${me.first_name}) via ${c.apiRoot}${c.agent ? " + proxy" : ""}`);
  } catch (e) {
    failed++;
    console.log(`✘ ${c.channel}: ${explain(c, e)}`);
  }
}
process.exit(failed ? 1 : 0);
