import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// The project's single .env lives at the repository root (shared with the bot and the db scripts), but Next only
// reads .env files from apps/web. Load the root one here so a fresh checkout works without a symlink or a copy.
// Variables already set in the environment (or in apps/web/.env) win.
for (const dir of [process.cwd(), path.resolve(process.cwd(), "../.."), path.resolve(import.meta.dirname ?? ".", "../..")]) {
  const file = path.join(dir, ".env");
  if (fs.existsSync(file) && path.resolve(file) !== path.resolve(process.cwd(), ".env")) {
    try {
      process.loadEnvFile(file);
    } catch {}
    break;
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@khaneyeidea/db", "@khaneyeidea/core"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
