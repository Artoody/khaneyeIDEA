"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";

/**
 * The 5-second brand intro, once per browser, on the home page only. The inline head script sets
 * html[data-intro] before first paint for eligible visitors, so the overlay is there from the first frame
 * (no flash of the page underneath). Skippable; ends itself after the video or a safety timeout.
 */
export function IntroSplash({ labels }: { labels: { skip: string; soundOn: string; soundOff: string } }) {
  const video = useRef<HTMLVideoElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [muted, setMuted] = useState(true);

  const finish = () => {
    setLeaving(true);
    setTimeout(() => {
      delete document.documentElement.dataset.intro;
      document.body.style.overflow = "";
    }, 700);
  };

  useEffect(() => {
    const html = document.documentElement;
    if (!html.dataset.intro) return;
    try {
      localStorage.setItem("intro-seen", "1");
    } catch {}
    document.body.style.overflow = "hidden";
    const v = video.current;
    let safety: ReturnType<typeof setTimeout>;
    if (v) {
      // Browsers only allow autoplay without sound; the viewer can turn sound on.
      v.muted = true;
      v.play().catch(() => finish());
      safety = setTimeout(finish, 9000);
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(safety);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div
      aria-hidden={leaving}
      className={`intro-splash fixed inset-0 z-[70] hidden items-center justify-center bg-[#0e1014] transition-opacity duration-700 [html[data-intro]_&]:flex ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <video
        ref={video}
        className="h-full w-full object-contain"
        poster="/media/intro/poster.jpg"
        playsInline
        muted
        preload="none"
        onEnded={finish}
        aria-label="Idea House Academy"
      >
        <source src="/media/intro/intro-1080.webm" type="video/webm" media="(min-width: 1024px)" />
        <source src="/media/intro/intro-720.webm" type="video/webm" />
        <source src="/media/intro/intro-720.mp4" type="video/mp4" />
      </video>
      <div className="absolute bottom-6 end-6 flex items-center gap-2 sm:bottom-8 sm:end-8">
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
          onClick={finish}
          className="h-11 rounded-full border border-white/20 px-5 text-sm font-medium text-white/85 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          {labels.skip}
        </button>
      </div>
    </div>
  );
}
