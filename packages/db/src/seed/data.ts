import type { Localized } from "../schema";

// Curated initial data. Source: docs/site-export (the old WordPress site).
// Everything here is editable in the admin panel afterwards.

const L = (fa: string, en: string): Localized => ({ fa, en });

export const DEPARTMENTS = [
  { slug: "robotics", title: L("رباتیک", "Robotics"), icon: "robot" },
  { slug: "programming-ai", title: L("برنامه‌نویسی و هوش مصنوعی", "Programming & AI"), icon: "code" },
  { slug: "web-design", title: L("طراحی سایت", "Web Design"), icon: "browser" },
  { slug: "electronics", title: L("آلتیوم دیزاین و آردوینو", "Altium Design & Arduino"), icon: "cpu" },
  { slug: "industrial-design", title: L("طراحی صنعتی و سالیدورکس", "Industrial Design & SolidWorks"), icon: "cube" },
  { slug: "invention", title: L("ایده تا اختراع و خلاقیت", "Ideas, Invention & Creativity"), icon: "lightbulb" },
  { slug: "game-dev", title: L("بازی‌سازی", "Game Development"), icon: "game-controller" },
] as const;

type Mode = "in_person" | "online" | "hybrid";
export type CourseSeed = {
  slug: string;
  dept: (typeof DEPARTMENTS)[number]["slug"] | null;
  title: Localized;
  legacyPath: string;
  modes: Mode[];
  published: boolean;
};

// Published: the 11 courses in the current site menu. Drafts: older pages kept for the admin to review.
export const COURSES: CourseSeed[] = [
  { slug: "robotics", dept: "robotics", title: L("رباتیک", "Robotics"), legacyPath: "/دوره-رباتیک/", modes: ["in_person", "online"], published: true },
  { slug: "python", dept: "programming-ai", title: L("برنامه‌نویسی پایتون", "Python Programming"), legacyPath: "/دوره-برنامه-نویسی-پایتون/", modes: [], published: true },
  { slug: "arduino", dept: "electronics", title: L("آردوینو", "Arduino"), legacyPath: "/دوره-آردوئینو/", modes: [], published: true },
  { slug: "solidworks", dept: "industrial-design", title: L("سالیدورکس", "SolidWorks"), legacyPath: "/آموزش-رباتیک-با-سالیدورکس/", modes: [], published: true },
  { slug: "ai", dept: "programming-ai", title: L("هوش مصنوعی", "Artificial Intelligence"), legacyPath: "/ai-course/", modes: ["in_person", "online"], published: true },
  { slug: "web-design", dept: "web-design", title: L("طراحی سایت", "Web Design"), legacyPath: "/دوره-طراحی-سایت/", modes: ["in_person", "online"], published: true },
  { slug: "creativity", dept: "invention", title: L("خلاقیت کودک و نوجوان", "Creativity for Kids & Teens"), legacyPath: "/دوره-خلاقیت-کودک-و-نوجوان/", modes: [], published: true },
  { slug: "3d-printing", dept: "industrial-design", title: L("کارگاه پرینتر سه‌بعدی", "3D Printing Workshop"), legacyPath: "/دوره-کارگاه-پرینتر-۳-بعدی/", modes: [], published: true },
  { slug: "altium", dept: "electronics", title: L("آلتیوم دیزاینر", "Altium Designer"), legacyPath: "/دوره-آلتیوم-دیزاینر/", modes: [], published: true },
  { slug: "game-dev", dept: "game-dev", title: L("بازی‌سازی", "Game Development"), legacyPath: "/دوره-بازی-سازی/", modes: ["online"], published: true },
  { slug: "idea-to-invention", dept: "invention", title: L("ایده تا اختراع", "From Idea to Invention"), legacyPath: "/دوره-ایده-تا-اختراع/", modes: ["online"], published: true },

  { slug: "robotics-intro", dept: "robotics", title: L("آموزش رباتیک", "Robotics Training"), legacyPath: "/دوره-آموزش-رباتیک/", modes: ["in_person", "online"], published: false },
  { slug: "mechatronics", dept: "robotics", title: L("مکاترونیک", "Mechatronics"), legacyPath: "/دوره-مکاترونیک/", modes: ["in_person", "online"], published: false },
  { slug: "cospace", dept: "robotics", title: L("کواسپیس", "CoSpace"), legacyPath: "/دوره-کواسپیس/", modes: ["in_person", "online"], published: false },
  { slug: "programming", dept: "programming-ai", title: L("برنامه‌نویسی", "Programming"), legacyPath: "/دوره-برنامه-نویسی/", modes: ["in_person", "online"], published: false },
  { slug: "game-making", dept: "game-dev", title: L("بازی‌سازی (صفحه‌ی قدیمی)", "Game Making (legacy page)"), legacyPath: "/دوره-بازیسازی/", modes: ["in_person", "online"], published: false },
  { slug: "architecture", dept: "industrial-design", title: L("معماری", "Architecture"), legacyPath: "/دوره-معماری/", modes: ["in_person", "online"], published: false },
  { slug: "dreaming", dept: "invention", title: L("رویاپردازی", "Imagination Lab"), legacyPath: "/دوره-رویاپردازی/", modes: ["in_person", "online"], published: false },
  { slug: "kids-creativity", dept: "invention", title: L("خلاقیت کودک", "Kids' Creativity"), legacyPath: "/خلاقیت-کودک/", modes: ["in_person", "online"], published: false },
  { slug: "idea-to-invention-legacy", dept: "invention", title: L("از ایده تا اختراع (صفحه‌ی قدیمی)", "Idea to Invention (legacy page)"), legacyPath: "/از-ایده-تا-اختراع/", modes: ["in_person", "online"], published: false },
  { slug: "idea-to-execution", dept: "invention", title: L("از ایده تا اجرا", "From Idea to Execution"), legacyPath: "/از-ایده-تا-اجرا/", modes: [], published: false },
  { slug: "creative-writing", dept: "invention", title: L("نویسندگی خلاق", "Creative Writing"), legacyPath: "/دوره-نویسندگی-خلاق/", modes: [], published: false },
  { slug: "nano", dept: null, title: L("نانو", "Nanotechnology"), legacyPath: "/دوره-نانو/", modes: [], published: false },
  { slug: "teen-biologist", dept: null, title: L("زیست‌شناس نوجوان", "Teen Biologist"), legacyPath: "/دوره-زیست-شناس-نوجوان/", modes: [], published: false },
];

export const BRANCHES = [
  {
    slug: "gholhak",
    name: L("شعبه مرکزی، قلهک", "Main branch, Gholhak"),
    address: L("تهران، قلهک، پارک علم و فناوری دانشگاه آزاد، واحد ۵۰۳", "Science & Technology Park of Azad University, Unit 503, Gholhak, Tehran"),
    district: L("قلهک", "Gholhak"),
    appointmentOnly: true,
  },
  {
    slug: "east",
    name: L("شعبه شرق", "East branch"),
    address: L("تهران، دانشگاه علم و صنعت", "Iran University of Science and Technology, Tehran"),
    district: L("نارمک", "Narmak"),
    appointmentOnly: false,
  },
  {
    slug: "pasdaran",
    name: L("شعبه پاسداران", "Pasdaran branch"),
    address: L("تهران، دروس، پاسداران، خیابان صالح حسینی", "Saleh Hosseini St., Darrous, Pasdaran, Tehran"),
    district: L("دروس", "Darrous"),
    appointmentOnly: false,
  },
  {
    slug: "zafaranieh",
    name: L("شعبه زعفرانیه", "Zafaranieh branch"),
    address: L("تهران، زعفرانیه، خیابان افراز", "Afraz St., Zafaranieh, Tehran"),
    district: L("زعفرانیه", "Zafaranieh"),
    appointmentOnly: false,
  },
];

/** Placeholder profiles. isSample=true: shown with a "sample" badge in the panel and hidden on the production site. */
export const SAMPLE_TEACHERS = [
  { name: L("نیلوفر احمدی", "Niloofar Ahmadi"), role: L("مربی رباتیک", "Robotics coach"), specialties: [L("رباتیک", "Robotics"), L("آردوینو", "Arduino")] },
  { name: L("آرش کریمی", "Arash Karimi"), role: L("مربی برنامه‌نویسی و هوش مصنوعی", "Programming & AI coach"), specialties: [L("پایتون", "Python"), L("یادگیری ماشین", "Machine learning")] },
  { name: L("سارا موسوی", "Sara Mousavi"), role: L("مربی طراحی صنعتی", "Industrial design coach"), specialties: [L("سالیدورکس", "SolidWorks"), L("پرینت سه‌بعدی", "3D printing")] },
  { name: L("حامد رضایی", "Hamed Rezaei"), role: L("مربی ایده تا اختراع", "Invention coach"), specialties: [L("خلاقیت", "Creativity"), L("مسابقات", "Competitions")] },
];

export const PAGE_BLOCKS: Record<string, Localized> = {
  "home.hero.title": L("ایده‌ها اینجا ربات می‌شوند.", "Where ideas become robots."),
  "home.hero.subtitle": L(
    "رباتیک، برنامه‌نویسی و هوش مصنوعی برای کودکان و نوجوانان؛ از اولین ایده تا مسابقات جهانی.",
    "Robotics, coding and AI for kids and teens, from a first idea to world championships.",
  ),
  "home.hero.cta": L("رزرو کلاس آزمایشی", "Book a trial class"),
  "home.portal.title": L("همه‌چیز درباره‌ی فرزندتان، در یک جا", "Everything about your child, in one place"),
  "home.portal.body": L(
    "برنامه‌ی کلاس، گزارش هر جلسه، تکلیف‌ها و پیشرفت فرزندتان را از پرتال والدین یا داخل بله ببینید.",
    "See your child's schedule, session reports, homework and progress in the parent portal or right inside Bale.",
  ),
  "courses.title": L("دوره‌ای که به سن و علاقه‌ی فرزندتان می‌خورد", "A course that fits your child's age and interests"),
  "courses.subtitle": L(
    "سن فرزندتان و حوزه‌ای را که دوست دارد انتخاب کنید تا دوره‌های مناسب را ببینید.",
    "Pick your child's age and an area they enjoy to see the courses that fit.",
  ),
  "achievements.title": L("افتخارات شاگردان خانه ایده", "What our students have won"),
  "achievements.subtitle": L(
    "مسابقه‌های جهانی، آسیایی و کشوری. هر مورد با سال و رتبه ثبت شده است.",
    "World, Asian and national competitions, each recorded with its year and placing.",
  ),
};

export const APPOINTMENT_TYPES = [
  {
    kind: "trial_class" as const,
    place: "in_person" as const,
    title: L("کلاس آزمایشی", "Trial class"),
    description: L("یک جلسه‌ی واقعی کنار بچه‌های هم‌سن، تا فرزندتان فضای کلاس را از نزدیک ببیند.", "A real session with children of the same age, so your child can try the class first-hand."),
  },
  {
    kind: "consultation" as const,
    place: "in_person" as const,
    title: L("مشاوره‌ی حضوری", "In-person consultation"),
    description: L("گفت‌وگو با مشاور آموزشی در شعبه برای انتخاب مسیر مناسب.", "Talk with an advisor at a branch to choose the right path."),
  },
  {
    kind: "consultation" as const,
    place: "phone" as const,
    title: L("مشاوره‌ی تلفنی", "Phone consultation"),
    description: L("در زمانی که انتخاب می‌کنید با شما تماس می‌گیریم.", "We call you at the time you pick."),
  },
  {
    kind: "placement" as const,
    place: "in_person" as const,
    title: L("تعیین سطح", "Placement session"),
    description: L("برای بچه‌هایی که تجربه‌ی قبلی دارند، تا از سطح درست شروع کنند.", "For children with prior experience, so they start at the right level."),
  },
  {
    kind: "visit" as const,
    place: "in_person" as const,
    title: L("بازدید از آموزشگاه", "Visit the academy"),
    description: L("کارگاه‌ها و پروژه‌های بچه‌ها را از نزدیک ببینید.", "See the workshops and the children's projects up close."),
  },
];
