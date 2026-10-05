import type { ReactNode } from "react";
import { ScenePlayer } from "./scene-player";

// Small motion graphics for the department tiles, one per department icon key.
// Pure SVG/CSS (keyframes in globals.css under "Department scenes"); ScenePlayer only runs them while visible.
// Line art in the brand style: muted ink strokes, amber for the "alive" parts.

const line = "stroke-current";

function Robot() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <g className="sc-robot-bob">
        {/* antenna */}
        <line x1="100" y1="22" x2="100" y2="36" className={line} />
        <circle cx="100" cy="18" r="5" className="sc-led fill-[var(--accent)]" />
        {/* head */}
        <rect x="70" y="36" width="60" height="42" rx="12" className={line} />
        <g className="sc-blink">
          <circle cx="88" cy="57" r="5" className="fill-[var(--accent)]" />
          <circle cx="112" cy="57" r="5" className="fill-[var(--accent)]" />
        </g>
        {/* body */}
        <rect x="64" y="84" width="72" height="46" rx="10" className={line} />
        <rect x="80" y="96" width="9" height="9" rx="2" className="sc-panel sc-panel-1 fill-[var(--accent)]" />
        <rect x="95" y="96" width="9" height="9" rx="2" className="sc-panel sc-panel-2 fill-[var(--accent)]" />
        <rect x="110" y="96" width="9" height="9" rx="2" className="sc-panel sc-panel-3 fill-[var(--accent)]" />
        <line x1="82" y1="116" x2="118" y2="116" className={line} />
        {/* arms */}
        <path d="M 64 92 L 46 112" className={line} />
        <g className="sc-wave">
          <path d="M 136 92 L 156 76 L 162 60" className={line} />
          <path d="M 156 56 l 6 4 l 6 -4" className={line} />
        </g>
      </g>
      {/* wheels */}
      <g className="sc-wheel" style={{ transformOrigin: "82px 140px" }}>
        <circle cx="82" cy="140" r="10" className={line} strokeDasharray="4 4" />
      </g>
      <g className="sc-wheel" style={{ transformOrigin: "118px 140px" }}>
        <circle cx="118" cy="140" r="10" className={line} strokeDasharray="4 4" />
      </g>
    </svg>
  );
}

function Board() {
  const traces = ["M 100 62 V 30 H 30", "M 120 80 H 170 V 30", "M 100 98 V 130 H 40", "M 80 80 H 30 V 120", "M 120 92 H 160 V 130"];
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="12" y="14" width="176" height="132" rx="14" className={line} opacity="0.5" />
      {traces.map((d, i) => (
        <g key={d}>
          <path d={d} className={line} />
          <path d={d} pathLength={100} className="sc-current stroke-[var(--accent)]" strokeWidth="3" style={{ animationDelay: `${i * 0.45}s` }} />
        </g>
      ))}
      {[[30, 30], [170, 30], [40, 130], [30, 120], [160, 130]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="5" className={line} fill="var(--surface)" />
      ))}
      {/* chip */}
      <rect x="80" y="62" width="40" height="36" rx="5" className={line} fill="var(--surface)" />
      {[70, 80, 90].map((y) => (
        <g key={y}>
          <line x1="74" y1={y} x2="80" y2={y} className={line} />
          <line x1="120" y1={y} x2="126" y2={y} className={line} />
        </g>
      ))}
      {/* LED */}
      <circle cx="160" cy="58" r="6" className="sc-led fill-[var(--accent)]" />
      <path d="M 151 58 H 142" className={line} />
    </svg>
  );
}

function Code() {
  // Code is LTR; lines "type" in one after another, then the cycle restarts.
  const lines: [number, number, number, boolean][] = [
    [18, 30, 70, true],
    [18, 50, 110, false],
    [34, 70, 90, true],
    [34, 90, 60, false],
    [18, 110, 40, true],
  ];
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" fill="none" strokeLinecap="round" direction="ltr">
      <rect x="6" y="8" width="188" height="144" rx="14" className={line} strokeWidth="2" opacity="0.5" />
      {[18, 30, 42].map((x) => (
        <circle key={x} cx={x} cy="20" r="3" className="fill-current" opacity="0.4" />
      ))}
      {lines.map(([x, y, w, kw], i) => (
        <g key={y} className="sc-type" style={{ animationDelay: `${i * 0.7}s`, transformOrigin: `${x}px ${y}px` }}>
          <rect x={x} y={y + 6} width={Math.min(w * 0.35, 30)} height="7" rx="3.5" className={kw ? "fill-[var(--accent)]" : "fill-current"} opacity={kw ? 0.9 : 0.35} />
          <rect x={x + Math.min(w * 0.35, 30) + 5} y={y + 6} width={w} height="7" rx="3.5" className="fill-current" opacity="0.28" />
        </g>
      ))}
      <rect x="66" y="134" width="3" height="14" className="sc-caret fill-[var(--accent)]" />
    </svg>
  );
}

function Browser() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" direction="ltr">
      <rect x="10" y="10" width="180" height="140" rx="12" className={line} opacity="0.6" />
      <line x1="10" y1="30" x2="190" y2="30" className={line} opacity="0.6" />
      {[22, 32, 42].map((x) => (
        <circle key={x} cx={x} cy="20" r="3" className="fill-current" opacity="0.4" />
      ))}
      <rect x="24" y="42" width="152" height="38" rx="6" className="sc-build fill-[var(--accent)]" opacity="0.85" style={{ animationDelay: "0s" }} />
      <rect x="24" y="90" width="72" height="44" rx="6" className="sc-build fill-current" opacity="0.25" style={{ animationDelay: "0.5s" }} />
      <rect x="104" y="90" width="72" height="20" rx="6" className="sc-build fill-current" opacity="0.25" style={{ animationDelay: "0.9s" }} />
      <rect x="104" y="116" width="48" height="8" rx="4" className="sc-build fill-current" opacity="0.25" style={{ animationDelay: "1.2s" }} />
      <g className="sc-cursor">
        <path d="M 0 0 L 0 18 L 5 13 L 9 22 L 13 20 L 9 11 L 16 11 Z" className="fill-[var(--ink)] stroke-[var(--surface)]" strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function Cube() {
  // A CSS 3D wireframe cube with a CAD-style dimension line.
  const faces = ["rotateY(0deg)", "rotateY(90deg)", "rotateY(180deg)", "rotateY(-90deg)", "rotateX(90deg)", "rotateX(-90deg)"];
  return (
    <div className="relative grid h-full w-full place-items-center [perspective:500px]">
      <div className="sc-cube relative size-20 [transform-style:preserve-3d]">
        {faces.map((f, i) => (
          <div
            key={f}
            className={`absolute inset-0 rounded-md border-2 ${i === 0 ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-current/50"}`}
            style={{ transform: `${f} translateZ(40px)` }}
          />
        ))}
      </div>
      <svg viewBox="0 0 200 40" className="absolute inset-x-6 bottom-1 h-8" fill="none" strokeWidth="1.5" direction="ltr">
        <path d="M 40 20 H 160 M 40 12 V 28 M 160 12 V 28 M 40 20 l 8 -4 M 40 20 l 8 4 M 160 20 l -8 -4 M 160 20 l -8 4" className={line} opacity="0.6" />
        <rect x="86" y="13" width="28" height="14" rx="3" className="fill-[var(--surface)]" />
        <rect x="90" y="18" width="20" height="4" rx="2" className="sc-led fill-[var(--accent)]" />
      </svg>
    </div>
  );
}

function Bulb() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <g className="sc-rays">
        {[-60, -30, 0, 30, 60].map((a) => (
          <line key={a} x1="100" y1="16" x2="100" y2="6" className="stroke-[var(--accent)]" transform={`rotate(${a} 100 68)`} />
        ))}
      </g>
      <circle cx="100" cy="68" r="36" className="sc-glow fill-[var(--accent)]" opacity="0" />
      <path d="M 78 98 C 66 88 60 78 60 66 A 40 40 0 0 1 140 66 C 140 78 134 88 122 98 V 112 H 78 Z" className={line} />
      <path d="M 86 100 V 84 L 94 72 L 100 84 L 106 72 L 114 84 V 100" pathLength={100} className="sc-filament stroke-[var(--accent)]" />
      <line x1="82" y1="122" x2="118" y2="122" className={line} />
      <line x1="88" y1="132" x2="112" y2="132" className={line} />
    </svg>
  );
}

function Game() {
  return (
    <svg viewBox="0 0 200 160" className="h-full w-full" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" direction="ltr">
      <line x1="6" y1="132" x2="194" y2="132" className={line} />
      {[20, 60, 100, 140, 180].map((x) => (
        <line key={x} x1={x} y1="140" x2={x + 10} y2="140" className={line} opacity="0.4" />
      ))}
      <g className="sc-obstacle">
        <rect x="200" y="112" width="14" height="20" rx="3" className={line} />
      </g>
      <g className="sc-coin">
        <circle cx="120" cy="58" r="7" className="fill-[var(--accent)]" />
      </g>
      <g className="sc-jump">
        <rect x="52" y="104" width="28" height="28" rx="6" className="fill-[var(--accent)]" />
        <rect x="68" y="112" width="5" height="7" rx="2" className="fill-[var(--ink)]" />
      </g>
      <text x="190" y="30" textAnchor="end" className="fill-current font-mono text-[14px]" opacity="0.5">
        0042
      </text>
    </svg>
  );
}

const SCENES: Record<string, () => ReactNode> = {
  robot: Robot,
  cpu: Board,
  code: Code,
  browser: Browser,
  cube: Cube,
  lightbulb: Bulb,
  "game-controller": Game,
};

export function DeptScene({ icon, className }: { icon: string | null; className?: string }) {
  const Scene = SCENES[icon ?? ""] ?? Bulb;
  return (
    <ScenePlayer className={className}>
      <Scene />
    </ScenePlayer>
  );
}
