// Role based access control. Checked on the server for every request and action.

export const ROLES = ["owner", "admin", "content_manager", "teacher", "parent", "student"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "content.edit", // site content: courses, branches, teachers, achievements, settings
  "users.manage", // create staff, assign roles
  "schedule.view_all",
  "schedule.manage", // classes, sessions, cancellations, announcements
  "students.manage",
  "finance.view",
  "notifications.configure_own",
  "session.report_own", // teacher: attendance and reports for own classes
  "children.view_own", // parent: own children only
  "self.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const GRANTS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    "content.edit",
    "schedule.view_all",
    "schedule.manage",
    "students.manage",
    "finance.view",
    "notifications.configure_own",
  ],
  content_manager: ["content.edit", "notifications.configure_own"],
  teacher: ["session.report_own", "notifications.configure_own"],
  parent: ["children.view_own", "notifications.configure_own"],
  student: ["self.view"],
};

export type RoleAssignment = { role: Role; branchId: string | null };
export type Principal = { userId: string; tenantId: string; roles: RoleAssignment[] };

/**
 * True if any of the principal's roles grants the permission.
 * When a branchId is given, branch-scoped roles only count for that branch; roles with branchId=null count everywhere.
 */
export function can(p: Principal | null, perm: Permission, scope?: { branchId?: string | null }): boolean {
  if (!p) return false;
  return p.roles.some((r) => {
    if (!GRANTS[r.role].includes(perm)) return false;
    if (r.branchId === null) return true;
    if (!scope || scope.branchId === undefined) return false;
    return scope.branchId === r.branchId;
  });
}

/** Where to send a user after login, by their strongest role. */
export function homeFor(p: Principal): "/app/admin" | "/app/teacher" | "/app/parent" | "/app" {
  const roles = new Set(p.roles.map((r) => r.role));
  if (roles.has("owner") || roles.has("admin") || roles.has("content_manager")) return "/app/admin";
  if (roles.has("teacher")) return "/app/teacher";
  if (roles.has("parent")) return "/app/parent";
  return "/app";
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Forbidden: missing permission ${permission}`);
  }
}
