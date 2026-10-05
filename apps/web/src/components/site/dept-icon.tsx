"use client";

import { Browser, Code, Cpu, Cube, GameController, Lightbulb, Robot, type Icon } from "@phosphor-icons/react";
import type { DeptIconKey } from "@/lib/dept-icons";

/** Department icons for client components (server components use the ssr entry in home-sections). */
export const DEPT_ICONS: Record<DeptIconKey, Icon> = { robot: Robot, code: Code, browser: Browser, cpu: Cpu, cube: Cube, lightbulb: Lightbulb, "game-controller": GameController };

export function DeptIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Ico = DEPT_ICONS[(icon ?? "") as DeptIconKey] ?? Lightbulb;
  return <Ico weight="duotone" className={className} />;
}
