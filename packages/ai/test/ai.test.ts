import { describe, expect, it } from "vitest";
import { AiUnavailable, geminiProvider, scrubNames } from "../src";

describe("name scrubbing", () => {
  it("replaces student names and restores them", () => {
    const { text, restore } = scrubNames("امروز سارا و علی ربات ساختند. سارا سریع بود.", ["سارا", "علی"]);
    expect(text).not.toMatch(/سارا|علی/);
    expect(text).toMatch(/دانش‌آموز 1/);
    expect(restore("دانش‌آموز 1 عالی بود")).toBe("سارا عالی بود");
  });

  it("ignores one-letter tokens", () => {
    expect(scrubNames("الف", ["ا"]).text).toBe("الف");
  });
});

describe("gemini provider", () => {
  it("sends the proxy key and falls back on 502", async () => {
    const seen: { url: string; key: string | null }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), key: new Headers(init?.headers).get("x-goog-api-key") });
      return new Response("no", { status: 502 });
    }) as typeof fetch;
    const ai = geminiProvider({ AI_BASE_URL: "https://fallback.example", AI_API_KEY: "proxy-key", AI_MODEL: "gemini-2.5-flash" }, fetchImpl);
    await expect(ai.generate({ prompt: "سلام" })).rejects.toBeInstanceOf(AiUnavailable);
    expect(seen[0]?.key).toBe("proxy-key");
    expect(seen[0]?.url).toContain("/v1beta/models/gemini-2.5-flash:generateContent");
  });
});
