import "server-only";
import { asc, sql } from "drizzle-orm";
import { teachers } from "@khaneyeidea/db";

/** Admin and public lists: coaches ordered by Persian name, not a manual sort field. */
export const byTeacherName = asc(sql`lower((${teachers.name})->>'fa')`);
