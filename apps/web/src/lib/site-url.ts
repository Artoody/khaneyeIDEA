/** The public origin (no trailing slash). Production default is the academy's domain. */
export const siteUrl = () => (process.env.SITE_URL?.trim() || "https://khaneyeide.ir").replace(/\/$/, "");
