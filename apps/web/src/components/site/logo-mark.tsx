// The Idea House circuit-house mark, rebuilt as vector from the brand logo.
// Traces are drawn in a 1.24x horizontally stretched space (as in the original); nodes are true circles.
export const MARK = {
  viewBox: "50 55 355 317",
  sx: 1.24,
  stroke: 22,
  nodeR: 19.5,
  paths: [
    "M324 212.5 L71.9 212.5 L202.6 81.8",
    "M208 119 L264.1 175.5 L163.4 175.5",
    "M106.9 212.5 L106.9 347 L289.5 347",
    "M261.3 212.5 L261.3 304 L145.8 304",
  ],
  nodes: [
    [251.2, 81.8],
    [202.6, 175],
    [359, 346.6],
    [180.8, 303.6],
  ] as const,
  // 45 degree cut on the eave's right end
  clip: "M0 0 H500 V195 H366.3 L415.9 235 H500 V400 H0 Z",
};

export function LogoMark({ className, title = "Idea House" }: { className?: string; title?: string }) {
  return (
    <svg viewBox={MARK.viewBox} className={className} role="img" aria-label={title}>
      <defs>
        <clipPath id="mark-eave-cut">
          <path d={MARK.clip} />
        </clipPath>
      </defs>
      <g clipPath="url(#mark-eave-cut)">
        <g transform={`scale(${MARK.sx} 1)`} fill="none" stroke="#FFB347" strokeWidth={MARK.stroke} strokeLinejoin="miter">
          {MARK.paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>
      {MARK.nodes.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={MARK.nodeR} fill="#FFB347" />
      ))}
    </svg>
  );
}
