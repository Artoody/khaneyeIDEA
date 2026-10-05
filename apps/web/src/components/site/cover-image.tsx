/* eslint-disable @next/next/no-img-element -- legacy article images of unknown size */
"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./logo-mark";

/** Article cover: if the image cannot load (e.g. old-site link), a branded placeholder takes its place. */
export function CoverImage({ src, className = "" }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);
  // The image may have failed before React attached onError (server-rendered <img>): check once on mount.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed)
    return (
      <div className={`bg-dots relative grid place-items-center bg-accent/10 ${className}`} aria-hidden>
        <LogoMark className="h-1/3 max-h-24 w-auto opacity-60" />
      </div>
    );
  return <img ref={ref} src={src!} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}
