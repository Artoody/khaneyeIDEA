import { InlineKeyboard, type Bot } from "grammy";
import type { Button, Messenger } from "@khaneyeidea/core";
import type { Channel } from "./config";

const keyboard = (rows?: Button[][]) => {
  const kb = new InlineKeyboard();
  rows?.forEach((row, i) => {
    row.forEach((b) => kb.text(b.text, b.data));
    if (i < rows.length - 1) kb.row();
  });
  return kb;
};

/** The channel-neutral Messenger the follow-up code uses, over a grammY bot (Bale and Telegram share the API shape). */
export function messengerFor(bot: Bot, channel: Channel): Messenger {
  return {
    channel,
    async send(chatId, text, buttons) {
      const m = await bot.api.sendMessage(chatId, text, buttons?.length ? { reply_markup: keyboard(buttons) } : undefined);
      return String(m.message_id);
    },
    async edit(chatId, messageId, text, buttons) {
      await bot.api.editMessageText(chatId, Number(messageId), text, { reply_markup: keyboard(buttons) });
    },
    async remove(chatId, messageId) {
      try {
        await bot.api.deleteMessage(chatId, Number(messageId));
        return true;
      } catch {
        return false;
      }
    },
  };
}
