"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BellRinging, DownloadSimple } from "@phosphor-icons/react";
import type { OpsDict } from "@/lib/ops-i18n";

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

const iosNow = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function TeacherPwa({ t }: { t: OpsDict["tp"]["push"] }) {
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const ios = useSyncExternalStore(() => () => {}, iosNow, () => false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function enablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setHint(t.unsupported);
      return;
    }
    if (ios && !standalone()) {
      setHint(t.ios);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setHint(t.denied);
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch("/api/teacher/push");
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) {
      setHint(t.noKey);
      return;
    }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const json = sub.toJSON();
    await fetch("/api/teacher/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, platform: navigator.platform, standalone: standalone() }),
    });
    setHint(t.on);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-text">
          <BellRinging className="size-6" weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t.title}</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">{t.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-bg transition active:scale-[0.98]" onClick={() => void enablePush()}>
              <BellRinging className="size-4" />
              {t.enable}
            </button>
            {install && (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-sm transition hover:border-ink/30 active:scale-[0.98]"
                onClick={() => {
                  void install.prompt();
                  setInstall(null);
                }}
              >
                <DownloadSimple className="size-4" />
                {t.install}
              </button>
            )}
          </div>
          {ios && !standalone() && <p className="mt-3 text-sm text-muted">{t.ios}</p>}
          {hint && (
            <p className="mt-3 text-sm text-accent-text" role="status">
              {hint}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
