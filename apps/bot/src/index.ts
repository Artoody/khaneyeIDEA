// Runs the Bale and Telegram bots (long polling; a webhook mode comes with deployment): `pnpm bot:dev`.
import { botConfigs } from "./config";
import { createBot, explain } from "./bots";
import { registerHandlers } from "./handlers";

const configs = botConfigs();
if (!configs.length) {
  console.log("[bot] no BALE_BOT_TOKEN / TELEGRAM_BOT_TOKEN in .env; bots not started.");
  process.exit(0);
}

const running: { stop: () => Promise<void> }[] = [];
for (const c of configs) {
  const bot = createBot(c);
  registerHandlers(bot, c.channel);
  try {
    const me = await bot.api.getMe();
    await bot.api.setMyCommands([
      { command: "start", description: "منوی اصلی" },
      { command: "id", description: "شناسه‌ی این گفت‌وگو" },
    ]).catch(() => {}); // Bale may not support every method
    void bot.start({ drop_pending_updates: true, onStart: () => console.log(`[${c.channel}] @${me.username} is running`) });
    running.push(bot);
  } catch (e) {
    console.error(`[${c.channel}] not started: ${explain(c, e)}`);
  }
}

const stop = async () => {
  await Promise.all(running.map((b) => b.stop()));
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
