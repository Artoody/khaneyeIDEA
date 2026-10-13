export type GenerateReq = { system?: string; prompt: string; maxTokens?: number };
export type AiProvider = {
  name: "gemini-compatible" | "none";
  generate(req: GenerateReq): Promise<{ text: string }>;
  transcribe?(audio: Buffer, mime: string): Promise<{ text: string }>;
};

export class AiUnavailable extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiUnavailable";
  }
}

const none: AiProvider = {
  name: "none",
  async generate() {
    throw new AiUnavailable("AI_PROVIDER=none", 0);
  },
};

type Env = {
  AI_PROVIDER?: string;
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_TIMEOUT_MS?: string;
};

/** Gemini-compatible proxy (Artoody/fallback). Voice is sent as inline_data; the proxy forwards the JSON. */
export function geminiProvider(env: Env, fetchImpl: typeof fetch = fetch): AiProvider {
  const base = (env.AI_BASE_URL ?? "").replace(/\/$/, "");
  const key = env.AI_API_KEY ?? "";
  const model = env.AI_MODEL || "gemini-2.5-flash";
  const timeout = Number(env.AI_TIMEOUT_MS) || 45_000;

  async function call(parts: unknown[]): Promise<string> {
    if (!base || !key) throw new AiUnavailable("AI is not configured", 0);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res: Response;
    try {
      res = await fetchImpl(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts }] }),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new AiUnavailable(e instanceof Error ? e.message : "AI request failed", 502);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 429 || res.status >= 500) {
      throw new AiUnavailable(`AI ${res.status}`, res.status);
    }
    if (!res.ok) throw new AiUnavailable(`AI ${res.status}`, res.status);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
    if (!text) throw new AiUnavailable("empty AI response", 502);
    return text;
  }

  return {
    name: "gemini-compatible",
    generate: (req) => call([{ text: [req.system, req.prompt].filter(Boolean).join("\n\n") }]).then((text) => ({ text })),
    transcribe: (audio, mime) =>
      call([
        { text: "این فایل صوتی فارسی را دقیق رونویسی کن. فقط متن گفته‌شده را برگردان، بدون توضیح." },
        { inline_data: { mime_type: mime || "audio/webm", data: audio.toString("base64") } },
      ]).then((text) => ({ text })),
  };
}

export function createAiProvider(env?: Env, fetchImpl?: typeof fetch): AiProvider {
  const resolved: Env = env ?? {
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_BASE_URL: process.env.AI_BASE_URL,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS,
  };
  const kind = (resolved.AI_PROVIDER ?? "none").toLowerCase();
  if (kind === "gemini-compatible" || kind === "openai-compatible") return geminiProvider(resolved, fetchImpl);
  return none;
}
