import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

type Db = ReturnType<typeof drizzle<typeof schema>>;

// One pool per process; survives Next.js dev hot reloads.
const g = globalThis as unknown as { __khaneyeDb?: Db; __khaneyeSql?: postgres.Sql };

export function getDb(): Db {
  if (!g.__khaneyeDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__khaneyeSql = postgres(url, { max: 10, prepare: false });
    g.__khaneyeDb = drizzle(g.__khaneyeSql, { schema, casing: "snake_case" });
  }
  return g.__khaneyeDb;
}

export async function closeDb() {
  await g.__khaneyeSql?.end();
  g.__khaneyeDb = undefined;
  g.__khaneyeSql = undefined;
}
