// Reads the old WordPress site's export (docs/site-export/content/*.md) so SEO-bearing text carries over:
// Yoast titles and meta descriptions, publish dates, and the page body as Markdown.
import fs from "node:fs";
import path from "node:path";

export const EXPORT_DIR = path.resolve(import.meta.dirname, "../../../../docs/site-export");
const LEGACY_MEDIA = path.resolve(import.meta.dirname, "../../../../apps/web/public/media/legacy");

/** Old-site image links point to the local copy once `pnpm --filter @khaneyeidea/db legacy-media` has run. */
export function preferLocalMedia(text: string): string {
  return text.replace(/https?:\/\/(?:www\.)?khaneyeide\.ir\/wp-content\/uploads\/([^\s)"']+)/g, (url, rel: string) => {
    const decoded = decodeURI(rel);
    return fs.existsSync(path.join(LEGACY_MEDIA, decoded)) ? `/media/legacy/${decoded.split("/").map(encodeURIComponent).join("/")}` : url;
  });
}

export type LegacyPage = {
  file: string;
  title: string | null;
  description: string | null;
  publishedAt: Date | null;
  modifiedAt: Date | null;
  image: string | null;
  body: string;
};

const field = (md: string, name: string) => {
  const m = new RegExp(`^- ${name}: (.*)$`, "m").exec(md);
  const v = m?.[1]?.trim();
  return !v || v === "null" ? null : v;
};

/** Site chrome that the crawler captured inside the content area (footer logo, WP table of contents...). */
const CUT_MARKERS = [
  /^!\[[^\]]*\]\(https:\/\/khaneyeide\.ir\/wp-content\/uploads\/2025\/05\/logo\.webp\)/m,
  /^## آنچه در این مطلب خوانده اید/m,
  /^### خانه ایده\s*$/m,
];
/** Old lead forms inside pages (booking now happens on /book): from the form's heading to its submit line. */
const FORM_BLOCKS = [
  /^#+ (?:ثبت نام دوره|همکاران ما در اسرع وقت|برای اطلاع از جزئیات|فرم اولیه)[^\n]*\n[\s\S]*?^ارسال\s*$/gm,
];

function cleanBody(raw: string, kind: "article" | "course"): string {
  let lines = raw.split("\n");
  // The page H1 repeats the title (often split over several lines): drop it up to the first section heading.
  if (lines.find((l) => l.trim())?.startsWith("# ")) {
    const i = lines.findIndex((l) => l.startsWith("## "));
    if (i > 0) lines = lines.slice(i);
  }
  // Headline fragments above the first section heading (e.g. "### اهمیت کسب / مهارت") are dropped too.
  const firstH2 = lines.findIndex((l) => l.startsWith("## "));
  if (firstH2 > 0 && (kind === "course" || firstH2 <= 8)) lines = lines.slice(firstH2);
  // Course hero: "## دوره / <name> / خانه‌ی ایده" before the real text.
  if (kind === "course" && /^## دوره\s*$/.test(lines[0] ?? "")) {
    lines = lines.slice(1);
    while (lines.length && lines[0]!.trim().length < 30 && !lines[0]!.startsWith("#")) lines.shift();
  }
  let text = lines.join("\n");
  for (const f of FORM_BLOCKS) text = text.replace(f, "");
  for (const m of CUT_MARKERS) {
    const hit = m.exec(text);
    if (hit) text = text.slice(0, hit.index);
  }
  return text
    .replace(/^\s*ثبت نام\s*$/gm, "")
    .replace(/\(جا برای لینک داخلی:[^)]*\)/g, "") // editor's placeholder notes left in the old text
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function readLegacyPage(name: string, kind: "article" | "course"): LegacyPage | null {
  const file = path.join(EXPORT_DIR, "content", `${name}.md`);
  if (!fs.existsSync(file)) return null;
  const md = fs.readFileSync(file, "utf8");
  const content = /^## Content\s*$([\s\S]*?)^## Internal links\s*$/m.exec(md)?.[1] ?? "";
  const date = (v: string | null) => (v ? new Date(v) : null);
  return {
    file,
    title: field(md, "Title"),
    description: field(md, "Meta description"),
    publishedAt: date(field(md, "article:published_time")),
    modifiedAt: date(field(md, "article:modified_time")),
    image: (() => {
      const img = field(md, "og:image");
      return img ? preferLocalMedia(img) : null;
    })(),
    body: preferLocalMedia(cleanBody(content, kind)),
  };
}

/** Old articles worth keeping, by export file name -> new blog slug. */
export const LEGACY_ARTICLES: Record<string, string> = {
  "what-is-robotic": "what-is-robotic",
  "مسابقات-روبوکاپ": "robocup-competitions",
  "مسابقات-آیروکاپ": "airocup-competitions",
  "kharazmi-festival": "kharazmi-festival",
  "why-should-you-learn-robotics-online": "why-learn-robotics-online",
  "why-you-need-to-learn-ai": "why-learn-ai",
  "futures-of-jobs-with-ai": "future-of-jobs-with-ai",
  "steam-method": "steam-method",
  "patent-of-idea": "patent-of-idea",
  "what-is-the-importance-of-acquiring": "importance-of-skills",
};

/** Other old pages and where they now live (paths are the decoded old URL paths). */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/دپارتمان-رباتیک/": "/courses?d=robotics",
  "/دپارتمان-برنامه-نویسی/": "/courses?d=programming-ai",
  "/دپارتمان-برنامهنویسی-و-بازیسازی/": "/courses?d=programming-ai",
  "/دپارتمان-طراحی-سایت/": "/courses?d=web-design",
  "/دپارتمان-آلتیوم-دیزاین-و-آردوئینو/": "/courses?d=electronics",
  "/دپارتمان-طراحی-صنعتی-و-سالیدورکس/": "/courses?d=industrial-design",
  "/دپارتمان-ایده-تا-اختراع-و-خلاقیت/": "/courses?d=invention",
  "/دپارتمان-ایده-و-اختراع/": "/courses?d=invention",
  "/دپارتمان-خلاقیت-کودک-و-نوجوان/": "/courses?d=invention",
  "/دپارتمان-خلاقیت-در-هنر/": "/courses?d=invention",
  "/دپارتمان-بازی-سازی/": "/courses?d=game-dev",
  "/دپارتمان-روانشناسی-کودک-و-نوجوان/": "/courses",
  "/دپارتمان-معماری/": "/courses",
  "/دپارتمان-نانو-زیست-نوجوان/": "/courses",
  "/دپارتمانهای-خانهی-ایده/": "/courses",
  "/دورههای-خانهی-ایده/": "/courses",
  "/روانشناسی-کودک-و-نوجوان/": "/courses",
  "/افتخارات-خانهی-ایده/": "/achievements",
  "/پروژههای-دانشپژوهان/": "/achievements",
  "/تماس-با-ما/": "/#contact",
  "/مراحل-ثبت-نام/": "/book",
  "/ثبت-نام/": "/book",
  "/مجله-خانهی-ایده/": "/blog",
  "/مجله-خانه-ایده/": "/blog",
  "/لینکدونی/": "/blog",
  "/سلام-دنیا/": "/blog",
  "/category/articles/": "/blog",
  "/category/دستهبندی-نشده/": "/blog",
  "/author/khaneyeide/": "/blog",
  "/2025/08/18/": "/blog",
  "/shop/": "/",
  "/evercompare/": "/",
  "/برگه-404/": "/",
};

/** Where old pages of courses we keep as drafts should send visitors (closest published course). */
export const DRAFT_REDIRECT: Record<string, string> = {
  "robotics-intro": "/courses/robotics",
  mechatronics: "/courses/robotics",
  cospace: "/courses/robotics",
  programming: "/courses/python",
  "game-making": "/courses/game-dev",
  architecture: "/courses?d=industrial-design",
  dreaming: "/courses/creativity",
  "kids-creativity": "/courses/creativity",
  "idea-to-invention-legacy": "/courses/idea-to-invention",
  "idea-to-execution": "/courses/idea-to-invention",
  "creative-writing": "/courses/creativity",
};

/** A published course whose best old text lives on another old page. */
export const CONTENT_FROM: Record<string, string> = {
  robotics: "/دوره-آموزش-رباتیک/",
};
