/** Icon keys a department can use. Rendered by the public site and the admin picker. */
export const DEPT_ICON_KEYS = ["robot", "code", "browser", "cpu", "cube", "lightbulb", "game-controller"] as const;
export type DeptIconKey = (typeof DEPT_ICON_KEYS)[number];
