import { InlineKeyboard, Keyboard, type Bot, type Context } from "grammy";
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

export function registerHandlers(bot: Bot, channel: Channel) {
  const src = `src=${channel}`;
  // In groups the bot stays quiet unless addressed with a command (children's privacy, no noise in class groups).
  const privateOnly = (ctx: Context) => ctx.chat?.type === "private";

  bot.command("start", async (ctx) => {
    const s = await getSettings();
    await ctx.reply(`سلام! به ${s.name.fa} خوش آمدید.\n${s.tagline.fa}\n\nاز منوی پایین انتخاب کنید.`, { reply_markup: privateOnly(ctx) ? menu() : undefined });
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

  // Anything else in a private chat: point back to the menu. (Answering free questions comes with the AI/FAQ work.)
  bot.on("message:text", async (ctx) => {
    if (!privateOnly(ctx)) return;
    await ctx.reply("پیامتان رسید. برای جواب سریع از منو استفاده کنید یا با شماره‌های بخش «تماس با ما» در ارتباط باشید.", { reply_markup: menu() });
  });

  bot.catch((err) => console.error(`[${channel}] handler error`, err.error));
}
