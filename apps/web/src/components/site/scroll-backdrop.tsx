"use client";

import { useEffect, useRef } from "react";

// A quiet, scroll-driven story behind the page content:
//   1. circuit traces draw in from the edges as you scroll and meet a central chip, which lights up at the end;
//   2. a robot arm swings in, works, and leaves;
//   3. a wireframe 3D model drifts in, turns with the scroll, and leaves.
// One fixed SVG, updated in a single rAF loop from scroll position (no React re-renders, transforms and
// stroke offsets only). Fades in after the hero. Static frame under reduced motion.

const W = 1000;
const H = 1000;

// Traces (viewBox units): from the edges toward the chip at the center. Hand-tuned to echo the logo's PCB look.
const TRACES = [
  "M -20 140 H 180 L 260 220 H 420 L 470 270 V 430",
  "M 1020 120 H 840 L 770 190 H 600 L 540 250 V 430",
  "M -20 520 H 120 L 190 450 H 380 L 420 490",
  "M 1020 560 H 880 L 820 500 H 620 L 580 490",
  "M 160 1020 V 860 L 240 780 H 400 L 460 720 V 570",
  "M 860 1020 V 880 L 780 800 H 600 L 540 740 V 570",
  "M 500 -20 V 120 L 520 140 V 430",
  "M 500 1020 V 900 L 480 880 V 570",
];
// Junction nodes along the traces (x, y, progress at which they light).
const NODES: [number, number, number][] = [
  [260, 220, 0.18], [770, 190, 0.22], [190, 450, 0.3], [820, 500, 0.34], [240, 780, 0.42], [780, 800, 0.46], [520, 140, 0.5], [480, 880, 0.55],
];

// Icosahedron (12 vertices, 30 edges) for the 3D model.
const PHI = (1 + Math.sqrt(5)) / 2;
const VERTS: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const EDGES: [number, number][] = [];
for (let i = 0; i < VERTS.length; i++)
  for (let j = i + 1; j < VERTS.length; j++) {
    const [a, b] = [VERTS[i]!, VERTS[j]!];
    if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 0.01) EDGES.push([i, j]);
  }

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** 0 -> 1 as p goes from a to b, eased. */
const seg = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function ScrollBackdrop() {
  const root = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = root.current;
    if (!svg) return;
    const traces = [...svg.querySelectorAll<SVGPathElement>("[data-trace]")];
    const lengths = traces.map((t) => t.getTotalLength());
    traces.forEach((t, i) => (t.style.strokeDasharray = `${lengths[i]}`));
    const nodes = [...svg.querySelectorAll<SVGCircleElement>("[data-node]")];
    const chip = svg.querySelector<SVGGElement>("[data-chip]")!;
    const arm = svg.querySelector<SVGGElement>("[data-arm]")!;
    const j1 = svg.querySelector<SVGGElement>("[data-j1]")!;
    const j2 = svg.querySelector<SVGGElement>("[data-j2]")!;
    const j3 = svg.querySelector<SVGGElement>("[data-j3]")!;
    const model = svg.querySelector<SVGGElement>("[data-model]")!;
    const wire = svg.querySelector<SVGPathElement>("[data-wire]")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const circuit = svg.querySelector<SVGGElement>("[data-circuit]")!;
    // The frame follows the screen's shape: 1000 units tall, as wide as the aspect ratio needs.
    // The circuit stays centered; the arm stands at the bottom start; the model floats on the other side.
    let vw = W;
    const layout = () => {
      vw = Math.round((H * innerWidth) / innerHeight);
      svg.setAttribute("viewBox", `0 0 ${vw} ${H}`);
      const scale = Math.min(1, vw / 900);
      circuit.setAttribute("transform", `translate(${vw / 2} ${H / 2}) scale(${scale}) translate(${-W / 2} ${-H / 2})`);
    };
    layout();
    addEventListener("resize", layout);

    let last = -1;
    let raf = 0;
    const draw = (time: number) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = reduce ? 0.6 : max > 0 ? clamp(scrollY / max) : 0;
      const idle = reduce ? 0 : time / 1000;

      // Whole layer: hidden over the hero, fades in after the first screen.
      svg.style.opacity = String(reduce ? 1 : seg(scrollY, innerHeight * 0.35, innerHeight * 0.9));

      if (p !== last) {
        // 1. traces draw in a staggered way, nodes light as their trace arrives, the chip lights at the end.
        traces.forEach((t, i) => (t.style.strokeDashoffset = String(lengths[i]! * (1 - seg(p, 0.04 + i * 0.05, 0.42 + i * 0.05)))));
        nodes.forEach((n, i) => n.setAttribute("data-on", String(p >= NODES[i]![2])));
        chip.setAttribute("data-on", String(p > 0.86));
      }

      // 2. robot arm: in (0.12-0.3), works, out (0.55-0.7). Joints follow scroll plus a slow breathing motion.
      const armIn = seg(p, 0.12, 0.3) - seg(p, 0.55, 0.7);
      arm.setAttribute("transform", `translate(${-220 + armIn * (vw > 1200 ? 380 : 300)} ${H})`);
      arm.style.opacity = String(armIn);
      const w = p * 14 + idle * 0.6;
      j1.setAttribute("transform", `rotate(${28 + Math.sin(w) * 16})`);
      j2.setAttribute("transform", `translate(0 -190) rotate(${48 + Math.sin(w * 1.3 + 1) * 20})`);
      j3.setAttribute("transform", `translate(0 -150) rotate(${35 + Math.sin(w * 1.7 + 2) * 25})`);

      // 3. 3D model: in (0.45-0.6), out (0.85-0.97); rotation follows scroll plus a slow idle spin.
      const mIn = seg(p, 0.45, 0.6) - seg(p, 0.85, 0.97);
      model.style.opacity = String(mIn);
      model.setAttribute("transform", `translate(${vw - (vw > 1200 ? 230 : 170) + (1 - mIn) * 220} 260) scale(${vw > 1200 ? 1 : 0.75})`);
      if (mIn > 0) {
        const ay = p * 7 + idle * 0.25;
        const ax = 0.5 + p * 3;
        const [cy, sy, cx, sx] = [Math.cos(ay), Math.sin(ay), Math.cos(ax), Math.sin(ax)];
        const pts = VERTS.map(([x, y, z]) => {
          const x1 = x * cy + z * sy;
          const z1 = -x * sy + z * cy;
          const y1 = y * cx - z1 * sx;
          const z2 = y * sx + z1 * cx;
          const f = 70 / (1 - z2 * 0.12); // light perspective
          return [x1 * f, y1 * f] as const;
        });
        wire.setAttribute("d", EDGES.map(([a, b]) => `M${pts[a]![0].toFixed(1)} ${pts[a]![1].toFixed(1)}L${pts[b]![0].toFixed(1)} ${pts[b]![1].toFixed(1)}`).join(""));
      }

      last = p;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", layout);
    };
  }, []);

  return (
    <svg
      ref={root}
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="scroll-backdrop pointer-events-none fixed inset-0 -z-10 h-[100lvh] w-full opacity-0"
    >
      <g data-circuit>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {TRACES.map((d, i) => (
          <path key={i} d={d} className="backdrop-trace-base" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
        {TRACES.map((d, i) => (
          <path key={i} data-trace d={d} className="backdrop-trace" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
      </g>
      {NODES.map(([x, y], i) => (
        <circle key={i} data-node data-on="false" cx={x} cy={y} r="6" className="backdrop-node" />
      ))}

      {/* central chip: lights up when every trace has arrived */}
      <g data-chip data-on="false" className="backdrop-chip" transform="translate(500 500)">
        <rect x="-80" y="-70" width="160" height="140" rx="14" />
        {[-50, -17, 17, 50].map((x) => (
          <g key={x}>
            <line x1={x} y1="-70" x2={x} y2="-88" />
            <line x1={x} y1="70" x2={x} y2="88" />
          </g>
        ))}
        <circle r="14" className="backdrop-chip-led" />
      </g>
      </g>

      {/* robot arm, line art, joints rotated from the scroll loop */}
      <g data-arm className="backdrop-line" opacity="0">
        <rect x="-60" y="-24" width="120" height="24" rx="6" />
        <g data-j1>
          <circle r="16" />
          <rect x="-12" y="-190" width="24" height="190" rx="12" />
          <g data-j2>
            <circle r="14" />
            <rect x="-10" y="-150" width="20" height="150" rx="10" />
            <g data-j3>
              <circle r="11" />
              <path d="M -26 -10 H 26 M -26 -10 V -48 M 26 -10 V -48" />
            </g>
          </g>
        </g>
      </g>

      {/* wireframe model */}
      <g data-model opacity="0">
        <path data-wire className="backdrop-line" />
      </g>
    </svg>
  );
}
