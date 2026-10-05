import { config } from "dotenv";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { closeDb, getDb } from "./index";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

await migrate(getDb(), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
console.log("migrations applied");
await closeDb();
