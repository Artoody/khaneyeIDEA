import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUser } from "@/server/auth";

const KEY = /^[a-f0-9]{24}\.webm$/;

function voiceDir() {
  return path.join(process.cwd(), ".devdata", "voices");
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > 8_000_000) return NextResponse.json({ error: "bad" }, { status: 400 });
  const key = `${randomBytes(12).toString("hex")}.webm`;
  const dir = voiceDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ key });
}

/** Playback for a voice the signed-in teacher just uploaded. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!KEY.test(key)) return NextResponse.json({ error: "bad" }, { status: 400 });
  try {
    const buf = await readFile(path.join(voiceDir(), key));
    return new NextResponse(buf, {
      headers: {
        "content-type": "audio/webm",
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "missing" }, { status: 404 });
  }
}
