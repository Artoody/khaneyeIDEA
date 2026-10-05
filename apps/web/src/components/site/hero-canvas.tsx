"use client";

import { useEffect, useRef } from "react";
import { HeroScene } from "./hero-scene";

/** Live logo build-up. Plays fully on the first visit of a browser session, then starts in its idle state. */
export function HeroCanvas({ label }: { label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem("intro-seen") === "1";
      sessionStorage.setItem("intro-seen", "1");
    } catch {}
    const scene = new HeroScene(ref.current, { reducedMotion, skipIntro: seen });
    return () => scene.destroy();
  }, []);
  return <canvas ref={ref} role="img" aria-label={label} className="absolute inset-0 h-full w-full" />;
}
