// Small interface sounds, synthesised with the Web Audio API (no sound files). They are quiet, short and can be
// switched off with the speaker button in the panel header; the choice is remembered per browser.

const KEY = "ui-sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const last = new Map<string, number>();

export type Sfx = "tick" | "pop" | "open" | "close" | "success" | "error" | "swoosh" | "remove";

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  window.dispatchEvent(new Event("ui-sound-change"));
  if (on) playSfx("pop");
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Tone = { from: number; to?: number; dur: number; type?: OscillatorType; gain: number; at?: number };

function tone(c: AudioContext, t: Tone) {
  const start = c.currentTime + (t.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = t.type ?? "sine";
  osc.frequency.setValueAtTime(t.from, start);
  if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.dur);
  // quick attack, exponential fade: no clicks
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(t.gain, start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + t.dur);
  osc.connect(g).connect(master!);
  osc.start(start);
  osc.stop(start + t.dur + 0.02);
}

function noise(c: AudioContext, dur: number, gain: number, f0: number, f1: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(f0, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(master!);
  src.start();
}

export function playSfx(name: Sfx) {
  if (!soundEnabled()) return;
  const now = performance.now();
  if (now - (last.get(name) ?? -1e9) < 120) return; // never machine-gun the same sound
  last.set(name, now);
  const c = audio();
  if (!c) return;
  switch (name) {
    case "tick":
      tone(c, { from: 1900, to: 1250, dur: 0.045, type: "triangle", gain: 0.045 });
      break;
    case "pop":
      tone(c, { from: 420, to: 900, dur: 0.09, gain: 0.08 });
      tone(c, { from: 1800, to: 1200, dur: 0.03, type: "triangle", gain: 0.025 });
      break;
    case "open":
      tone(c, { from: 520, to: 640, dur: 0.07, gain: 0.05 });
      tone(c, { from: 780, to: 980, dur: 0.1, gain: 0.05, at: 0.055 });
      break;
    case "close":
      tone(c, { from: 760, to: 600, dur: 0.07, gain: 0.045 });
      tone(c, { from: 520, to: 400, dur: 0.1, gain: 0.04, at: 0.05 });
      break;
    case "success":
      // a soft three-note rise with a shimmer
      [659.25, 830.61, 987.77].forEach((f, i) => {
        tone(c, { from: f, dur: 0.34, gain: 0.055, at: i * 0.075 });
        tone(c, { from: f * 2, dur: 0.22, type: "triangle", gain: 0.012, at: i * 0.075 });
      });
      break;
    case "error":
      tone(c, { from: 240, to: 165, dur: 0.16, type: "triangle", gain: 0.07 });
      tone(c, { from: 200, to: 140, dur: 0.18, type: "triangle", gain: 0.05, at: 0.09 });
      break;
    case "remove":
      tone(c, { from: 640, to: 300, dur: 0.12, gain: 0.06 });
      break;
    case "swoosh":
      noise(c, 0.2, 0.05, 500, 2600);
      break;
  }
}
