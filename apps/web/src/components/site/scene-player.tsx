"use client";

import { useEffect, useRef } from "react";

/** Runs the CSS animations inside only while the scene is on screen (saves battery on long pages). */
export function ScenePlayer({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => el.setAttribute("data-play", String(!!e?.isIntersecting)), { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden data-play="false" className={`dept-scene ${className ?? ""}`}>
      {children}
    </div>
  );
}
