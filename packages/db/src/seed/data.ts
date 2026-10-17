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
  "about.hero": L("درباره‌ی خانه ایده", "About Idea House"),
  "about.lead": L(
    "آموزشگاه بین‌المللی رباتیک خانه ایده؛ جایی که دانش‌آموز از صفر تا صد طراحی، ساخت و برنامه‌نویسی را خودش تجربه می‌کند.",
    "Idea House International Robotics Academy — where students design, build and program from scratch.",
  ),
  "about.body": L(
    "ما در خانه ایده با تیمی از مدرسان باتجربه در برنامه‌نویسی و ساخت ربات گرد هم آمده‌ایم تا به فرزندان شما در مسیر رشد در رباتیک، برنامه‌نویسی و هوش مصنوعی کمک کنیم.\n\nدر خانه ایده خبری از پک‌های آماده و ربات‌های کنترلی ساده نیست. یادگیری واقعی وقتی است که دانش‌آموز طراحی، ساخت و برنامه‌نویسی را خودش انجام دهد و ربات منحصر به فرد خودش را بسازد.\n\nبه‌جای پروژه‌های تکراری، دانش‌آموزان با نرم‌افزارها، زبان‌های برنامه‌نویسی و مباحث روز آشنا می‌شوند و مهارت‌هایی مثل خلاقیت، کار تیمی و حل مسئله را تمرین می‌کنند.",
    "At Idea House, experienced coaches in programming and robot building help children grow in robotics, coding and AI.\n\nWe do not use ready-made kits or simple remote-control robots. Real learning happens when a student designs, builds and programs their own unique robot.\n\nInstead of repetitive projects, students work with modern tools and languages and practise creativity, teamwork and problem-solving.",
  ),
  "about.whyTitle": L("چرا خانه ایده؟", "Why Idea House?"),
  "about.faqTitle": L("سؤالات متداول", "Frequently asked questions"),
  "home.reviews.title": L("بازخورد همراهان", "What families say"),
  "home.reviews.subtitle": L(
    "نظر والدین و دانش‌آموزانی که با خانه ایده همراه بوده‌اند.",
    "Notes from parents and students who have worked with Idea House.",
  ),
  "home.reviews.formTitle": L("نظر خود را بنویسید", "Share your feedback"),
  "home.reviews.formHint": L(
    "پس از بررسی تیم خانه ایده، نظر شما در سایت نمایش داده می‌شود.",
    "After our team reviews it, your note can appear on the site.",
  ),
  "home.partners.title": L(
    "برخی از ارگان‌ها و مؤسسات طرف قرارداد با خانه ایده",
    "Some of the organizations we work with",
  ),
  "tinkercad.hero": L("تینکرکد در کلاس؛ با ClassBridge", "Tinkercad in class, with ClassBridge"),
  "tinkercad.lead": L(
    "دانش‌آموز فقط به سرویس‌های مجاز Autodesk / Tinkercad دسترسی پیدا می‌کند — بدون VPN کامل.",
    "Students reach only allowlisted Autodesk / Tinkercad hosts — not a full VPN.",
  ),
  "tinkercad.body": L(
    "ClassBridge یک پل دسترسی آموزشی برای کلاس‌های تینکرکد خانه ایده است. معلم کد فعال‌سازی می‌سازد؛ دانش‌آموز روی ویندوز اپ را باز می‌کند، کد پیکربندی و کد کلاس را وارد می‌کند و فقط در زمان کلاس تینکرکد در دسترس است.",
    "ClassBridge is Idea House's classroom access bridge for Tinkercad. Teachers issue activation codes; students paste a configuration code and class code on Windows, then reach Tinkercad only during the session.",
  ),
  "tinkercad.stepsTitle": L("چطور شروع کنیم؟", "How to start"),
  "tinkercad.step1": L("اپ ClassBridge را برای ویندوز ۱۰/۱۱ دانلود کنید (نصب لازم نیست).", "Download ClassBridge for Windows 10/11 (no installer)."),
  "tinkercad.step2": L("کد پیکربندی را که معلم می‌دهد یک‌بار وارد کنید.", "Paste the Configuration Code from your teacher once."),
  "tinkercad.step3": L("کد کلاس (مثل CB-XXXX-XXXX) را بزنید، کلاس را شروع کنید و تینکرکد را باز کنید.", "Enter the class code (CB-XXXX-XXXX), start class, open Tinkercad."),
  "tinkercad.downloadLabel": L("دانلود ClassBridge برای ویندوز", "Download ClassBridge for Windows"),
  "tinkercad.downloadUrl": L(
    "https://github.com/Artoody/ClassBridge/releases/download/v1.0.0/ClassBridge.exe",
    "https://github.com/Artoody/ClassBridge/releases/download/v1.0.0/ClassBridge.exe",
  ),
  "tinkercad.teacherNote": L(
    "معلمان و اپراتورها: راهنمای استقرار و صدور کد در مخزن ClassBridge است.",
    "Teachers and operators: deploy notes and code issuing live in the ClassBridge repository.",
  ),
};

/** FAQ rows from the old khaneyeide.ir home (fa) with short English. */
export const SITE_FAQS: { question: Localized; answer: Localized }[] = [
  {
    question: L(
      "آیا خانه ایده هم مانند باقی آموزشگاه‌های رباتیک از پک‌های آماده استفاده می‌کند؟",
      "Does Idea House use ready-made robotics kits like other academies?",
    ),
    answer: L(
      "خیر. آموزشگاه بین‌المللی خانه ایده به هیچ وجه از پک‌های آماده استفاده نمی‌کند.",
      "No. Idea House does not use ready-made kits.",
    ),
  },
  {
    question: L(
      "آیا آموزشگاه رباتیک خانه ایده از ربات‌های کنترلی آماده استفاده می‌کند؟",
      "Does Idea House use ready-made remote-control robots?",
    ),
    answer: L(
      "خانه ایده از ربات کنترلی آماده استفاده نمی‌کند؛ دانش‌آموزان صفر تا صد طراحی را خودشان انجام می‌دهند و ربات خودشان را می‌سازند.",
      "No. Students design and build their own robots from scratch.",
    ),
  },
  {
    question: L(
      "در خانه ایده از چه نرم‌افزارهایی برای آموزش رباتیک استفاده می‌کنید؟",
      "Which software do you use for robotics classes?",
    ),
    answer: L(
      "دانش‌آموزان نرم‌افزارها، زبان‌های برنامه‌نویسی و مباحث آموزشی روز را یاد می‌گیرند و وقتشان را با ساختن ربات‌های کنترلی و پک‌های آماده تلف نمی‌کنند.",
      "Students learn current software, programming languages and topics — not kit-based remote-control toys.",
    ),
  },
  {
    question: L(
      "آیا تاکنون دانش‌آموزان خانه ایده موفق به کسب عنوان قهرمانی شده‌اند؟",
      "Have Idea House students won championships?",
    ),
    answer: L(
      "بله. افتخارات ثبت‌شده در سایت از داده‌ی واقعی مسابقات ملی و جهانی آمده است.",
      "Yes. Recorded achievements on the site come from real national and world competitions.",
    ),
  },
  {
    question: L(
      "مجموعه خانه ایده در کدام مسابقات رباتیک شرکت می‌کند؟",
      "Which robotics competitions does Idea House enter?",
    ),
    answer: L(
      "خانه ایده در مسابقات معتبر رباتیک مثل ربوکاپ شرکت می‌کند.",
      "Idea House competes in recognised events such as RoboCup.",
    ),
  },
  {
    question: L(
      "خانه ایده در کدام مسابقات ثبت اختراع شرکت می‌کند؟",
      "Which invention contests does Idea House enter?",
    ),
    answer: L(
      "خانه ایده در مسابقات معتبر اختراعات جهانی که مورد تأیید سازمان‌های معتبر اختراع هستند شرکت می‌کند.",
      "Idea House enters recognised international invention contests.",
    ),
  },
];

/** Published testimonials from the old home (“بازخورد همراهان”). */
export const SITE_REVIEWS: { authorName: Localized; body: Localized }[] = [
  {
    authorName: L("هانیه احمدزاده", "Hanieh Ahmadzadeh"),
    body: L(
      "مهمترین ویژگی خانه ایده برای من و دخترم اینه که از پک‌های آماده استفاده نمی‌کنه و بچه‌ها خودشون صفر تا صد طراحی‌ها رو انجام می‌دن و تسلط پیدا می‌کنن. پیروز باشید",
      "The best part for me and my daughter is that Idea House does not use ready-made kits — children design everything from scratch and really learn.",
    ),
  },
  {
    authorName: L("پارسا جعفرزاده", "Parsa Jafarzadeh"),
    body: L(
      "اولش فکر نمی‌کردم یه دانش‌آموز هشت ساله بتونه این نرم‌افزارهای تخصصی رو یاد بگیره. اما دیدم داره با اشتیاق کار می‌کنه و یاد می‌گیره. ممنون برای ایجاد انگیزه",
      "I did not think an eight-year-old could learn these specialist tools. Watching the enthusiasm and progress changed my mind — thank you for the motivation.",
    ),
  },
  {
    authorName: L("نیما فراهانی", "Nima Farahani"),
    body: L(
      "من دوره‌های رباتیک خانه ایده را برای پسرم ثبت‌نام کردم و واقعاً از کیفیت آموزش و محیط دوست‌داشتنی آن راضی هستیم. مربی‌ها حرفه‌ای و صبور هستند و بچه‌ها با اشتیاق زیادی یاد می‌گیرند. توصیه می‌کنم!",
      "I enrolled my son in Idea House robotics. The teaching quality and warm environment are excellent — patient coaches, eager learners. Highly recommended.",
    ),
  },
];

/** Partner logos (static files under apps/web/public/partners). */
export const SITE_PARTNERS: { name: Localized; logoUrl: string; url?: string }[] = [
  { name: L("پارک علم و فناوری دانشگاه آزاد اسلامی", "IAU Science & Technology Park"), logoUrl: "/partners/azad-park.png" },
  { name: L("دانشگاه علم و صنعت", "Iran University of Science and Technology"), logoUrl: "/partners/iust.webp" },
  { name: L("مدارس مهرآیین", "Mehraeen Schools"), logoUrl: "/partners/mehraeen.webp" },
  { name: L("ویپو", "WIPO"), logoUrl: "/partners/wipo.webp" },
  { name: L("کانون پرورش فکری کودکان و نوجوانان", "Institute for the Intellectual Development of Children"), logoUrl: "/partners/kanoon.webp" },
  { name: L("مدارس سلام", "Salam Schools"), logoUrl: "/partners/salam.webp" },
  { name: L("دانشگاه تهران", "University of Tehran"), logoUrl: "/partners/ut.webp" },
  { name: L("پارک فناوری", "Technology Park"), logoUrl: "/partners/tech-park.webp" },
  { name: L("آیروکاپ", "AiroCup"), logoUrl: "/partners/airocup.webp" },
  { name: L("دانشگاه شریف", "Sharif University of Technology"), logoUrl: "/partners/sharif.webp" },
  { name: L("روبوکاپ", "RoboCup"), logoUrl: "/partners/robocup.webp" },
  { name: L("معاونت علمی و فناوری", "Vice-Presidency for Science and Technology"), logoUrl: "/partners/isti.webp" },
  { name: L("بانک صادرات", "Bank Saderat"), logoUrl: "/partners/bank-saderat.webp" },
];

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

/** Extra paths a course is listed under, by department slug -> course slugs. */
export const ALSO_IN: Record<string, string[]> = {
  robotics: ["python", "arduino", "ai", "altium", "solidworks", "idea-to-invention"],
};
