import { Browser, Code, Cpu, Cube, GameController, Lightbulb, Robot } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

const ICONS: Record<string, Icon> = { robot: Robot, code: Code, browser: Browser, cpu: Cpu, cube: Cube, lightbulb: Lightbulb, "game-controller": GameController };

export function DeptBadge({ icon, label }: { icon: string | null; label: string }) {
  const Ico = ICONS[icon ?? ""] ?? Lightbulb;
  return (
    <span className="inline-flex items-center gap-2.5 text-sm font-medium text-muted">
      <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent-text">
        <Ico weight="duotone" className="size-5" />
      </span>
      {label}
    </span>
  );
}
