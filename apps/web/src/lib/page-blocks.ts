/** Editable text slots of the fixed site sections. Layout stays in code; only these words come from the database. */
export const PAGE_BLOCK_KEYS = [
  "home.hero.title",
  "home.hero.subtitle",
  "home.hero.cta",
  "home.portal.title",
  "home.portal.body",
  "courses.title",
  "courses.subtitle",
  "achievements.title",
  "achievements.subtitle",
] as const;
export type PageBlockKey = (typeof PAGE_BLOCK_KEYS)[number];
export const MULTILINE_BLOCKS: ReadonlySet<string> = new Set(["home.hero.subtitle", "home.portal.body", "courses.subtitle", "achievements.subtitle"]);
/** Admin form groups, in display order. */
export const PAGE_BLOCK_GROUPS = [
  { id: "home", prefix: "home.hero" },
  { id: "portal", prefix: "home.portal" },
  { id: "courses", prefix: "courses." },
  { id: "achievements", prefix: "achievements." },
] as const;
