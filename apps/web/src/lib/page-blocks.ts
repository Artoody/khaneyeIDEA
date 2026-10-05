/** Editable text slots of the fixed site sections. Layout stays in code; only these words come from the database. */
export const PAGE_BLOCK_KEYS = ["home.hero.title", "home.hero.subtitle", "home.hero.cta", "home.portal.title", "home.portal.body"] as const;
export type PageBlockKey = (typeof PAGE_BLOCK_KEYS)[number];
export const MULTILINE_BLOCKS: ReadonlySet<string> = new Set(["home.hero.subtitle", "home.portal.body"]);
