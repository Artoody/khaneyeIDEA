// Live, deterministic port of design/motion/intro for the website hero.
// Plays the build-up once (spark, soldering, power-on), then idles with circulating current.
// Pure canvas 2D, no dependencies. Respects reduced motion and pauses off-screen.

type P = { pts: [number, number][]; segs: number[]; total: number };
type Pt = [number, number];

const AMBER: [number, number, number] = [255, 179, 71];
const HOT: [number, number, number] = [255, 243, 222];
const rgba = (c: number[], a: number) => `rgba(${c[0]! | 0},${c[1]! | 0},${c[2]! | 0},${a})`;
const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i]! - v) * k);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const eOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const eOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const eInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eInCubic = (x: number) => x * x * x;
const spring = (x: number) => (x <= 0 ? 0 : 1 - Math.exp(-7 * x) * Math.cos(11 * x));

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poly(pts: Pt[], sx = 1): P {
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot((pts[i]![0] - pts[i - 1]![0]) * sx, pts[i]![1] - pts[i - 1]![1]);
    segs.push(l);
    total += l;
  }
  return { pts, segs, total };
}
function pointAt(p: P, s: number): Pt {
  s = clamp(s, 0, p.total);
  for (let i = 0; i < p.segs.length; i++) {
    const seg = p.segs[i]!;
    if (s <= seg || i === p.segs.length - 1) {
      const k = seg ? clamp(s / seg) : 0;
      const a = p.pts[i]!,
        b = p.pts[i + 1]!;
      return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
    }
    s -= seg;
  }
  return p.pts[p.pts.length - 1]!;
}
function subPath(g: CanvasRenderingContext2D, p: P, s0: number, s1: number) {
  s0 = clamp(s0, 0, p.total);
  s1 = clamp(s1, 0, p.total);
  if (s1 <= s0) return false;
  const a = pointAt(p, s0);
  g.moveTo(a[0], a[1]);
  let acc = 0;
  for (let i = 0; i < p.segs.length; i++) {
    const e = acc + p.segs[i]!;
    if (e > s0 && e < s1) g.lineTo(p.pts[i + 1]![0], p.pts[i + 1]![1]);
    acc = e;
  }
  const b = pointAt(p, s1);
  g.lineTo(b[0], b[1]);
  return true;
}

// Logo geometry (same as the brand mark)
const SX = 1.24,
  STROKE = 22,
  NODE_R = 19.5;
const LOGO_C: Pt = [228.5, 213.5];
const LOGO_H = 305;
const PATHS = [
  { pts: [[324, 212.5], [71.9, 212.5], [202.6, 81.8]] as Pt[], node: [251.2, 81.8] as Pt, t0: 0.62, dur: 1.05, clip: true },
  { pts: [[208, 119], [264.1, 175.5], [163.4, 175.5]] as Pt[], node: [202.6, 175.0] as Pt, t0: 0.86, dur: 0.92, clip: false },
  { pts: [[106.9, 212.5], [106.9, 347], [289.5, 347]] as Pt[], node: [359.0, 346.6] as Pt, t0: 0.98, dur: 0.95, clip: false },
  { pts: [[261.3, 212.5], [261.3, 304], [145.8, 304]] as Pt[], node: [180.8, 303.6] as Pt, t0: 1.12, dur: 0.86, clip: false },
].map((p) => ({ ...p, P: poly(p.pts, SX), t1: p.t0 + p.dur }));
const T_PULSE = 1.98;
const INTRO_END = 3.0;

export class HeroScene {
  private ctx: CanvasRenderingContext2D;
  private glow = document.createElement("canvas");
  private gx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private start = 0;
  private visible = true;
  private dark = true;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private traces: { P: P; pad: Pt; delay: number; dur: number; w: number; eDelay: number; eDur: number; out: number; speed: number }[] = [];
  private sparks: { pi: number; tb: number; vx: number; vy: number; life: number; size: number }[] = [];
  private ro: ResizeObserver;
  private io: IntersectionObserver;
  private mo: MutationObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: { reducedMotion: boolean; skipIntro: boolean },
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.gx = this.glow.getContext("2d")!;
    const r = rng(42);
    PATHS.forEach((p, pi) => {
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2,
          sp = 120 + r() * 360;
        this.sparks.push({ pi, tb: p.t0 + p.dur * (0.04 + 0.94 * (i / 26)), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, life: 0.2 + r() * 0.35, size: 1 + r() * 1.8 });
      }
    });
    this.readTheme();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = !!e?.isIntersecting;
      if (this.visible) this.loop();
    });
    this.io.observe(canvas);
    this.mo = new MutationObserver(() => this.readTheme());
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    canvas.addEventListener("pointermove", this.onPointer);
    this.resize();
    this.start = performance.now() - (opts.skipIntro ? INTRO_END * 1000 : 0);
    if (opts.reducedMotion) this.draw(INTRO_END + 2);
    else this.loop();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    this.mo.disconnect();
    this.canvas.removeEventListener("pointermove", this.onPointer);
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    this.pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };

  private readTheme() {
    this.dark = document.documentElement.dataset.theme !== "light";
    if (this.opts.reducedMotion) this.draw(INTRO_END + 2);
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width;
    this.h = r.height;
    for (const c of [this.canvas, this.glow]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    this.buildTraces();
    if (this.opts.reducedMotion) this.draw(INTRO_END + 2);
  }

  private buildTraces() {
    const r = rng(7),
      cx = this.w / 2,
      cy = this.h / 2;
    const scale = this.logoScale();
    const rx = (LOGO_H * scale) * 0.78,
      ry = (LOGO_H * scale) * 0.66;
    this.traces = [];
    const N = 30;
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2 + (r() - 0.5) * 0.14;
      const pad: Pt = [cx + Math.cos(th) * rx * (1 + r() * 0.15), cy + Math.sin(th) * ry * (1 + r() * 0.15)];
      const far = Math.max(this.w, this.h) * (0.9 + r() * 0.3);
      const S: Pt = [cx + Math.cos(th) * far, cy + Math.sin(th) * far * 0.7];
      const dx = pad[0] - S[0],
        dy = pad[1] - S[1];
      const K: Pt =
        Math.abs(dx) > Math.abs(dy)
          ? [S[0] + Math.sign(dx) * (Math.abs(dx) - Math.abs(dy)), S[1]]
          : [S[0], S[1] + Math.sign(dy) * (Math.abs(dy) - Math.abs(dx))];
      const delay = 0.04 + r() * 0.5;
      this.traces.push({ P: poly([S, K, pad]), pad, delay, dur: 0.85 + r() * 0.35, w: 1.4 + r() * 0.7, eDelay: delay + 0.18 + r() * 0.25, eDur: 0.7 + r() * 0.3, out: 2.6 + r() * 3, speed: 70 + r() * 70 });
    }
  }

  private logoScale() {
    return Math.min(this.h * 0.56, this.w * 0.62) / LOGO_H;
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    if (!this.visible || this.opts.reducedMotion) return;
    const tick = () => {
      if (!this.visible) return;
      this.draw((performance.now() - this.start) / 1000);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  private draw(t: number) {
    const { ctx: g, dpr } = this;
    const p = this.pointer;
    p.x += (p.tx - p.x) * 0.05;
    p.y += (p.ty - p.y) * 0.05;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);

    const cx = this.w / 2,
      cy = this.h / 2,
      s = this.logoScale();
    const traceA = this.dark ? 0.22 : 0.3;
    const traceC = this.dark ? AMBER : [154, 88, 0];

    // background circuit, slight parallax against the pointer
    g.save();
    g.translate(-p.x * 10, -p.y * 8);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const tr of this.traces) {
      const k = eOutCubic(prog(t, tr.delay, tr.delay + tr.dur));
      if (k <= 0) continue;
      g.strokeStyle = rgba(traceC, traceA);
      g.lineWidth = tr.w;
      g.beginPath();
      subPath(g, tr.P, 0, k * tr.P.total);
      g.stroke();
      const padK = spring(prog(t, tr.delay + tr.dur * 0.92, tr.delay + tr.dur * 0.92 + 0.6));
      if (padK > 0) {
        g.strokeStyle = rgba(traceC, traceA * 2);
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(tr.pad[0], tr.pad[1], 4.5 * padK, 0, Math.PI * 2);
        g.stroke();
      }
      const ek = prog(t, tr.eDelay, tr.eDelay + tr.eDur);
      if (ek > 0 && ek < 1) this.comet(g, tr.P, eInCubic(ek) * tr.P.total, 90, 2.2, 0.9, false);
      if (t > tr.out) {
        const cyc = tr.P.total + 400;
        const sOut = tr.P.total - (((t - tr.out) * tr.speed) % cyc);
        if (sOut > 0) this.comet(g, tr.P, sOut, 70, 1.8, this.dark ? 0.55 : 0.45, true);
      }
    }
    g.restore();

    // logo on its own layer (for bloom)
    const lg = this.gx;
    lg.setTransform(dpr, 0, 0, dpr, 0, 0);
    lg.clearRect(0, 0, this.w, this.h);
    this.drawLogo(lg, t, cx + p.x * 4, cy + p.y * 3, s);
    const pulse = Math.exp(-Math.pow((t - (T_PULSE + 0.22)) / 0.18, 2));
    const glow = 0.3 + 0.55 * pulse;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = this.dark ? "lighter" : "source-over";
    g.filter = `blur(${14 * dpr}px)`;
    g.globalAlpha = clamp((this.dark ? 0.8 : 0.35) * glow);
    g.drawImage(this.glow, 0, 0);
    g.filter = `blur(${48 * dpr}px)`;
    g.globalAlpha = clamp((this.dark ? 0.5 : 0.2) * glow);
    g.drawImage(this.glow, 0, 0);
    g.filter = "none";
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.drawImage(this.glow, 0, 0);
    g.restore();

    // sparks while soldering
    g.save();
    g.globalCompositeOperation = this.dark ? "lighter" : "source-over";
    for (const sp of this.sparks) {
      const age = t - sp.tb;
      if (age < 0 || age > sp.life) continue;
      const path = PATHS[sp.pi]!;
      const hp = pointAt(path.P, eInOutCubic(prog(sp.tb, path.t0, path.t1)) * path.P.total);
      const ox = cx + (hp[0] * SX - LOGO_C[0]) * s,
        oy = cy + (hp[1] - LOGO_C[1]) * s;
      const f = 1 - age / sp.life;
      g.fillStyle = rgba(mix(AMBER, HOT, f), f);
      g.beginPath();
      g.arc(ox + sp.vx * age, oy + sp.vy * age + 480 * age * age, sp.size * (0.5 + f), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();

    this.drawSpark(g, t, cx, cy, s);
  }

  private drawSpark(g: CanvasRenderingContext2D, t: number, cx: number, cy: number, s: number) {
    if (t > 1.3) return;
    g.save();
    g.globalCompositeOperation = this.dark ? "lighter" : "source-over";
    const born = spring(prog(t, 0.06, 0.6));
    const a = born * (1 - eOutCubic(prog(t, 0.95, 1.25))) * (0.85 + 0.15 * Math.sin(t * 40));
    if (a > 0.01) {
      const r = 60 * born;
      const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, rgba(HOT, a));
      rg.addColorStop(0.3, rgba(AMBER, a * 0.4));
      rg.addColorStop(1, rgba(AMBER, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
    }
    const rk = prog(t, 0.12, 0.95);
    if (rk > 0 && rk < 1) {
      g.strokeStyle = rgba(AMBER, 0.5 * (1 - rk));
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(cx, cy, 10 + 240 * eOutExpo(rk), 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of PATHS) {
      const k = prog(t, p.t0 - 0.24, p.t0);
      if (k <= 0 || k >= 1) continue;
      const st = p.pts[0]!;
      const ex = cx + (st[0] * SX - LOGO_C[0]) * s,
        ey = cy + (st[1] - LOGO_C[1]) * s;
      const e = eInOutCubic(k);
      const hx = lerp(cx, ex, e),
        hy = lerp(cy, ey, e);
      const hg = g.createRadialGradient(hx, hy, 0, hx, hy, 14);
      hg.addColorStop(0, rgba(HOT, 1));
      hg.addColorStop(1, rgba(AMBER, 0));
      g.fillStyle = hg;
      g.beginPath();
      g.arc(hx, hy, 14, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  private comet(g: CanvasRenderingContext2D, P: P, s: number, tail: number, w: number, alpha: number, reverse: boolean) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = reverse ? s + tail * (i / n) : s - tail * (1 - i / n);
      const b = reverse ? s + tail * ((i + 1) / n) : s - tail * (1 - (i + 1) / n);
      const k = reverse ? 1 - (i + 1) / n : (i + 1) / n;
      g.strokeStyle = rgba(mix(AMBER, HOT, this.dark ? k : k * 0.3), alpha * k * k);
      g.lineWidth = w * (0.6 + k);
      g.beginPath();
      if (subPath(g, P, Math.min(a, b), Math.max(a, b))) g.stroke();
    }
  }

  private drawLogo(g: CanvasRenderingContext2D, t: number, x: number, y: number, s: number) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    g.translate(-LOGO_C[0], -LOGO_C[1]);
    g.lineJoin = "miter";
    g.miterLimit = 8;
    g.lineCap = "butt";
    for (const p of PATHS) {
      const sh = eInOutCubic(prog(t, p.t0, p.t1)) * p.P.total;
      if (sh <= 0) continue;
      g.save();
      if (p.clip) {
        g.beginPath();
        g.moveTo(-50 * SX, -50);
        g.lineTo((312.9 + (-50 - 212.5)) * SX, -50);
        g.lineTo((312.9 + (600 - 212.5)) * SX, 600);
        g.lineTo(-50 * SX, 600);
        g.closePath();
        // only cut the eave, never the roof near the apex
        g.rect(-60, -60, 600, 255);
        g.clip("nonzero");
      }
      g.save();
      g.scale(SX, 1);
      g.lineWidth = STROKE;
      g.strokeStyle = rgba(AMBER, 1);
      g.beginPath();
      subPath(g, p.P, 0, sh);
      g.stroke();
      if (t < p.t1 + 0.25) {
        const cool = prog(t, p.t1, p.t1 + 0.25);
        for (let i = 0; i < 10; i++) {
          const a = sh - 110 * (1 - i / 10),
            b = sh - 110 * (1 - (i + 1) / 10) + 0.6;
          g.strokeStyle = rgba(mix(AMBER, HOT, ((i + 1) / 10) * (1 - cool)), 1);
          g.beginPath();
          if (subPath(g, p.P, Math.max(0, a), b)) g.stroke();
        }
      }
      const pk = prog(t, T_PULSE, T_PULSE + 0.62);
      if (pk > 0 && pk < 1) {
        const len = 150,
          ps = eInOutCubic(pk) * (p.P.total + len);
        for (let i = 0; i < 12; i++) {
          g.strokeStyle = rgba(HOT, 0.95 * Math.sin((Math.PI * (i + 0.5)) / 12));
          g.beginPath();
          if (subPath(g, p.P, ps - len * (1 - i / 12), ps - len * (1 - (i + 1) / 12) + 0.6)) g.stroke();
        }
      }
      const idle = prog(t, 2.7, 3.2);
      if (idle > 0) {
        g.lineWidth = STROKE * 0.26;
        for (let j = 0; j < 2; j++) {
          const ss = ((t - 2.7) * 120 + (j * p.P.total) / 2 + p.P.total * 0.37 * PATHS.indexOf(p)) % (p.P.total + 60);
          g.strokeStyle = rgba(HOT, (this.dark ? 0.32 : 0.5) * idle);
          g.beginPath();
          if (subPath(g, p.P, ss - 34, ss)) g.stroke();
        }
      }
      g.restore();
      if (t >= p.t0 && t < p.t1 + 0.05) {
        const hp = pointAt(p.P, sh);
        const ix = hp[0] * SX,
          iy = hp[1];
        const rg = g.createRadialGradient(ix, iy, 0, ix, iy, 34);
        rg.addColorStop(0, rgba(HOT, 1));
        rg.addColorStop(0.35, rgba(AMBER, 0.6));
        rg.addColorStop(1, rgba(AMBER, 0));
        g.fillStyle = rg;
        g.beginPath();
        g.arc(ix, iy, 34, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      const nk = prog(t, p.t1 - 0.04, p.t1 + 0.9);
      if (nk > 0) {
        const flash = Math.exp(-nk * 9) + Math.exp(-Math.pow((t - (T_PULSE + 0.6)) / 0.08, 2));
        g.fillStyle = rgba(mix(AMBER, HOT, clamp(flash)), 1);
        g.beginPath();
        g.arc(p.node[0], p.node[1], NODE_R * spring(nk * 1.1), 0, Math.PI * 2);
        g.fill();
        const rk = prog(t, p.t1, p.t1 + 0.7);
        if (rk > 0 && rk < 1) {
          g.strokeStyle = rgba(AMBER, 0.75 * (1 - rk));
          g.lineWidth = 2.5 * (1 - rk) + 0.5;
          g.beginPath();
          g.arc(p.node[0], p.node[1], NODE_R + 44 * eOutExpo(rk), 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
    g.restore();
  }
}
