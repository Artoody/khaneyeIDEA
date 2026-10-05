import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";
import { getDb } from "@khaneyeidea/db";
import { handleCallback, handleText, redeemClassCode, redeemUserCode, type Messengers } from "@khaneyeidea/core";
import type { Channel } from "./config";
import { SITE_IS_PUBLIC, SITE_URL } from "./config";
import { getBranches, getCourses, getSettings } from "./content";

// Persian-first menu. Bale and Telegram get the same behaviour; links carry ?src= so bookings show their channel.

const MENU = { courses: "📚 دوره‌ها", book: "🗓 رزرو کلاس آزمایشی", branches: "📍 شعبه‌ها و آدرس", contact: "☎️ تماس با ما" } as const;
const faDigits = (s: string | number) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
const menu = () => new Keyboard().text(MENU.courses).text(MENU.book).row().text(MENU.branches).text(MENU.contact).resized().persistent();

/** A link as a button when the site is public; bots refuse localhost URLs in buttons, so then it is plain text. */
async function replyWithLink(ctx: Context, text: string, label: string, url: string) {
  if (SITE_IS_PUBLIC) return ctx.reply(text, { reply_markup: new InlineKeyboard().url(label, url) });
  return ctx.reply(`${text}\n\n${label}: ${url}`);
}

export function registerHandlers(bot: Bot, channel: Channel, ms: Messengers) {
  const src = `src=${channel}`;
  // In groups the bot stays quiet unless addressed with a command (children's privacy, no noise in class groups).
  const privateOnly = (ctx: Context) => ctx.chat?.type === "private";

  // /start CODE (private chat): links this chat to the staff or parent account that created the code on the website.
  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim();
    if (code && privateOnly(ctx)) {
      const r = await redeemUserCode(getDb(), { code, channel, chatId: String(ctx.chat.id), username: ctx.from?.username ?? null });
      return ctx.reply(r.ok ? `حساب شما وصل شد${r.name ? `، ${r.name}` : ""}. از این پس پیام‌های آموزشگاه را همین‌جا می‌گیرید.` : "این کد معتبر نیست یا منقضی شده. در سایت یک کد تازه بسازید.", { reply_markup: menu() });
    }
    const s = await getSettings();
    await ctx.reply(`سلام! به ${s.name.fa} خوش آمدید.\n${s.tagline.fa}\n\nاز منوی پایین انتخاب کنید.`, { reply_markup: privateOnly(ctx) ? menu() : undefined });
  });

  // /link CODE (in a class group): attaches the group to the class that created the code in the admin panel.
  bot.command("link", async (ctx) => {
    if (privateOnly(ctx)) return ctx.reply("این دستور را داخل گروه کلاس بفرستید.");
    const code = ctx.match?.trim();
    if (!code) return ctx.reply("کد را بعد از دستور بنویسید: /link 123456");
    const r = await redeemClassCode(getDb(), { code, channel, chatId: String(ctx.chat.id) });
    return ctx.reply(r.ok ? `این گروه به کلاس «${r.title}» وصل شد. گزارش و خبرهای کلاس اینجا منتشر می‌شود.` : "این کد معتبر نیست یا منقضی شده. در پنل مدیریت یک کد تازه بسازید.");
  });

  // Buttons of the post-class conversation. Who may press is checked on the server, by the linked chat.
  bot.on("callback_query:data", async (ctx) => {
    try {
      const chatId = ctx.chat?.id ?? ctx.from.id;
      const messageId = ctx.callbackQuery.message?.message_id;
      const r = messageId ? await handleCallback(getDb(), ms, { channel, chatId: String(chatId), messageId: String(messageId), data: ctx.callbackQuery.data }) : {};
      await ctx.answerCallbackQuery(r.toast ? { text: r.toast } : undefined);
    } catch (e) {
      console.error(`[${channel}] callback failed`, e);
      await ctx.answerCallbackQuery({ text: "خطایی رخ داد. دوباره تلاش کنید." }).catch(() => {});
    }
  });

  // Shows the chat id: the admin uses it to connect a class group or a staff account later.
  bot.command("id", (ctx) => ctx.reply(`chat id: ${ctx.chat.id}\ntype: ${ctx.chat.type}`));

  bot.hears(MENU.courses, async (ctx) => {
    const list = await getCourses();
    const lines: string[] = [];
    let dept: string | null | undefined;
    for (const c of list) {
      const d = c.dept?.fa ?? null;
      if (d !== dept) {
        lines.push(`\n▪️ ${d ?? "سایر"}`);
        dept = d;
      }
      const ages = c.ageMin != null && c.ageMax != null ? ` (${faDigits(c.ageMin)} تا ${faDigits(c.ageMax)} سال)` : "";
      lines.push(`• ${c.title.fa}${ages}`);
    }
    await replyWithLink(ctx, `دوره‌های خانه ایده:${lines.join("\n")}`, "دیدن همه‌ی دوره‌ها", `${SITE_URL}/courses?${src}`);
  });

  bot.hears(MENU.book, (ctx) =>
    replyWithLink(ctx, "برای رزرو کلاس آزمایشی، سن فرزندتان و زمان مناسب را در صفحه‌ی رزرو انتخاب کنید. یک کد تأیید به موبایلتان می‌آید.", "رزرو وقت", `${SITE_URL}/book?${src}`),
  );

  bot.hears(MENU.branches, async (ctx) => {
    const list = await getBranches();
    const text = list
      .map((b) => [`📍 ${b.name.fa}${b.appointmentOnly ? " (با هماهنگی قبلی)" : ""}`, b.address?.fa, b.phone ? `☎️ ${faDigits(b.phone)}` : null].filter(Boolean).join("\n"))
      .join("\n\n");
    await ctx.reply(text || "اطلاعات شعبه‌ها به‌زودی اضافه می‌شود.");
  });

  bot.hears(MENU.contact, async (ctx) => {
    const s = await getSettings();
    const phones = s.phones.map((p) => `☎️ ${faDigits(p.number)}${p.label.fa ? ` (${p.label.fa})` : ""}`);
    const socials = s.socials.filter((x) => x.enabled && x.url).map((x) => `${x.kind}: ${x.url}`);
    await ctx.reply([...phones, s.email ?? "", ...socials].filter(Boolean).join("\n"));
  });

  bot.on(["message:voice", "message:audio"], async (ctx) => {
    if (privateOnly(ctx)) await ctx.reply("فعلاً پیام صوتی پشتیبانی نمی‌شود. گزارش را به‌صورت متن بنویسید.");
  });

  // Anything else in a private chat: point back to the menu. (Answering free questions comes with the AI/FAQ work.)
  bot.on("message:text", async (ctx) => {
    if (!privateOnly(ctx)) return;
    // A teacher's report or homework, when the post-class conversation is waiting for it.
    if (await handleText(getDb(), ms, { channel, chatId: String(ctx.chat.id), text: ctx.message.text })) return;
    await ctx.reply("پیامتان رسید. برای جواب سریع از منو استفاده کنید یا با شماره‌های بخش «تماس با ما» در ارتباط باشید.", { reply_markup: menu() });
  });

  bot.catch((err) => console.error(`[${channel}] handler error`, err.error));
}
