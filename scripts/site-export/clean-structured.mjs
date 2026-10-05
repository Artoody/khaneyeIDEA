/**
 * Corrects structured.json using the already saved crawl.
 * Does not fetch the website.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/site-export");

const pages = JSON.parse(fs.readFileSync(path.join(OUT, "pages.json"), "utf8"));
const structured = JSON.parse(fs.readFileSync(path.join(OUT, "structured.json"), "utf8"));

const ARTICLE_PATHS = [
  "/why-should-you-learn-robotics-online/",
  "/why-you-need-to-learn-ai/",
  "/steam-method/",
  "/futures-of-jobs-with-ai/",
  "/what-is-robotic/",
  "/what-is-the-importance-of-acquiring/",
  "/patent-of-idea/",
  "/kharazmi-festival/",
];

function pathname(url) {
  return new URL(url).pathname;
}

const seen = new Set();
const uniquePages = [];
for (const page of pages) {
  if (seen.has(page.url_decoded)) continue;
  seen.add(page.url_decoded);
  const pathName = pathname(page.url_decoded);
  if (ARTICLE_PATHS.some((p) => decodeURIComponent(pathName) === p || pathName === p)) page.page_type = "article";
  if (/دورههای-خانهی-ایده|دوره‌های-خانه‌ی-ایده/.test(decodeURIComponent(pathName))) page.page_type = "course_index";
  uniquePages.push(page);
}

const courseUrls = new Set(uniquePages.filter((p) => p.page_type === "course").map((p) => p.url_decoded));
const courseSeen = new Set();
structured.courses = structured.courses
  .filter((course) => courseUrls.has(course.page_url))
  .filter((course) => {
    if (courseSeen.has(course.page_url)) return false;
    courseSeen.add(course.page_url);
    return true;
  })
  .map((course) => {
    const department = course.department && course.department !== "ها" && course.department.length > 3 ? course.department : null;
    return {
      ...course,
      name: course.name ? course.name.replace(/\s+/g, " ").trim() : null,
      department,
    };
  });

const person = /^[\u0600-\u06FF\s]{5,40}$/;
structured.teachers = structured.teachers.filter((teacher) => {
  const name = (teacher.name || "").replace(/\s+/g, " ").trim();
  teacher.name = name;
  if (!person.test(name)) return false;
  if (/هوشمند|دستگاه|چتر|ربات|سطح|پروژه|عنوان/.test(name)) return false;
  return true;
});
const teacherSeen = new Set();
structured.teachers = structured.teachers.filter((teacher) => {
  const key = teacher.name.replace(/\s/g, "");
  if (teacherSeen.has(key)) return false;
  teacherSeen.add(key);
  return true;
});

structured.student_projects = structured.student_projects.map((project) => {
  const match = structured.achievements.find((award) => award.title.includes(project.title) && /مدال|مقام|رتبه/.test(award.title));
  return {
    title: project.title,
    team: null,
    description: match ? match.title.replace(/\s+/g, " ").trim() : null,
    media: null,
    page_url: project.page_url,
  };
});

structured.achievements = structured.achievements.filter((award) => !/رتبه های بین المللی\s+خانه ایده/.test(award.title));

structured.contact.addresses = [
  "تهران، قلهک، پارک علم و فناوری دانشگاه آزاد (مراجعه فقط با هماهنگی)",
  "تهران، قلهک، پارک علم و فناوری دانشگاه آزاد، واحد 503",
];
structured.contact.branches = structured.contact.branches
  .map((line) => line.replace(/\s+/g, " ").trim())
  .filter((line) => /شعبه\s+(مرکزی|شرق|پاسداران|زعفرانیه|شمال)/.test(line) || /:/.test(line));
structured.contact.social.bale = [];
structured.contact.social.telegram = structured.contact.social.telegram.filter((url) => !/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url));
structured.contact.notes = {
  bale: "No Bale profile URL was found. web.bale.ai appeared only as an emoji image host, and l.ble.ir appeared only as a link wrapper inside an article.",
  telegram: "The public href is a web.telegram.org deep link, not a t.me channel.",
  addresses: "Addresses are the two wordings published on the contact page.",
  second_phone: "09913535191 is on the contact page. 09391084882 is a tel: link on department pages.",
};

const formSeen = new Map();
for (const form of structured.forms) {
  const key = JSON.stringify({ action: form.action, fields: form.fields.map((f) => [f.name, f.label, f.type]) });
  if (!formSeen.has(key)) formSeen.set(key, { ...form, pages: [form.page] });
  else formSeen.get(key).pages.push(form.page);
}
structured.forms = [...formSeen.values()].map((form) => {
  const pagesUnique = [...new Set(form.pages)];
  return {
    pages: pagesUnique,
    page: pagesUnique[0] || form.page,
    action: form.action,
    method: form.method,
    id: form.id,
    fields: form.fields,
  };
});

fs.writeFileSync(path.join(OUT, "structured.json"), JSON.stringify(structured, null, 2), "utf8");
fs.writeFileSync(path.join(OUT, "pages.json"), JSON.stringify(uniquePages, null, 2), "utf8");

function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const csv = ["\ufeffold_url,title,page_type,notes"];
for (const page of uniquePages) {
  const notes = [
    page.wp_type ? `wp:${page.wp_type}` : null,
    page.wp_id ? `id:${page.wp_id}` : null,
    page.status !== 200 ? `status:${page.status}` : null,
    page.may_show_children ? "may show children; names omitted from structured.json" : null,
  ]
    .filter(Boolean)
    .join("; ");
  csv.push([csvCell(page.url_encoded), csvCell(page.title), csvCell(page.page_type), csvCell(notes || null)].join(","));
}
fs.writeFileSync(path.join(OUT, "redirect-seed.csv"), csv.join("\n") + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      pages: uniquePages.length,
      courses: structured.courses.length,
      teachers: structured.teachers.map((t) => t.name),
      projects: structured.student_projects.length,
      forms: structured.forms.length,
      bale: structured.contact.social.bale,
      telegram: structured.contact.social.telegram,
    },
    null,
    2
  )
);
