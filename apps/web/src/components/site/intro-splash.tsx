"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { InlineScript } from "../inline-script";

// The 5-second brand intro on the home page, once per visit (browser session).
// 1. The head script sets html[data-intro] before first paint, so the overlay is there from the first frame.
// 2. A tiny inline script right after the <video> starts playback while the HTML is still loading
//    (no waiting for React), so the intro begins as soon as the first bytes of video arrive.
// 3. Near the end, the page opens out of the logo (circular reveal) and the hero eases in behind it.

/** Logo center inside the video frame (fraction of width / height). */
const LOGO = { x: 0.31, y: 0.5 };
const REVEAL_MS = 1300;

const startScript = `(function(){var v=document.getElementById("intro-video");if(!v||!document.documentElement.dataset.intro)return;v.muted=true;v.preload="auto";var p=v.play();if(p&&p.catch)p.catch(function(){})})()`;

export function IntroSplash({ labels }: { labels: { skip: string; soundOn: string; soundOff: string } }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const done = useRef(false);

  useEffect(() => {
    const html = document.documentElement;
    const el = root.current;
    const v = video.current;
    if (!html.dataset.intro || !el || !v) return;
    try {
      sessionStorage.setItem("intro-seen", "1");
    } catch {}
    document.body.style.overflow = "hidden";

    const reveal = () => {
      if (done.current) return;
      done.current = true;
      // Centre the opening circle on the logo as it appears on screen (object-cover/contain aware).
      const r = v.getBoundingClientRect();
      const vw = v.videoWidth || 16;
      const vh = v.videoHeight || 9;
      const cover = getComputedStyle(v).objectFit === "cover";
      const scale = cover ? Math.max(r.width / vw, r.height / vh) : Math.min(r.width / vw, r.height / vh);
      const x = r.left + r.width / 2 + (LOGO.x - 0.5) * vw * scale;
      const y = r.top + r.height / 2 + (LOGO.y - 0.5) * vh * scale;
      el.style.setProperty("--ix", `${x}px`);
      el.style.setProperty("--iy", `${y}px`);
      html.dataset.intro = "reveal";
      document.body.style.overflow = "";
      setTimeout(() => {
        delete html.dataset.intro;
        v.pause();
      }, REVEAL_MS + 200);
    };

    // Start the reveal a moment before the last frame so the logo hands over to the page while still alive.
    const onTime = () => v.duration && v.currentTime >= v.duration - 0.45 && reveal();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", reveal);
    v.addEventListener("error", reveal);
    if (v.paused) v.play().catch(reveal); // the inline script may have been blocked
    if (v.ended) reveal();
    const safety = setTimeout(reveal, 9000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && reveal();
    window.addEventListener("keydown", onKey);
    (el as HTMLDivElement & { reveal?: () => void }).reveal = reveal;
    return () => {
      clearTimeout(safety);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", reveal);
      v.removeEventListener("error", reveal);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={root} className="intro-splash fixed inset-0 z-[70] hidden bg-[#0b0c10] [html[data-intro]_&]:block">
      <video
        id="intro-video"
        ref={video}
        // The inline start script sets preload/muted before React attaches; the DOM is right, keep it.
        suppressHydrationWarning
        className="intro-video h-full w-full object-contain sm:object-cover"
        playsInline
        muted
        preload="none"
        aria-label="Idea House Academy"
      >
        <source src="/media/intro/intro-1080.webm" type="video/webm" media="(min-width: 1024px)" />
        <source src="/media/intro/intro-720.webm" type="video/webm" />
        <source src="/media/intro/intro-720.mp4" type="video/mp4" />
      </video>
      <InlineScript html={startScript} />
      <div className="intro-controls absolute bottom-6 end-6 flex items-center gap-2 sm:bottom-8 sm:end-8">
        <button
          type="button"
          onClick={() => {
            const v = video.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
          }}
          aria-label={muted ? labels.soundOn : labels.soundOff}
          className="grid size-11 place-items-center rounded-full border border-white/20 text-white/80 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          {muted ? <SpeakerSlash className="size-5" /> : <SpeakerHigh className="size-5" />}
        </button>
        <button
          type="button"
          onClick={() => (root.current as (HTMLDivElement & { reveal?: () => void }) | null)?.reveal?.()}
          className="h-11 rounded-full border border-white/20 px-5 text-sm font-medium text-white/85 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          {labels.skip}
        </button>
      </div>
    </div>
  );
}
