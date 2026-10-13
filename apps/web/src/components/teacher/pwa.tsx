"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

const iosNow = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function TeacherPwa() {
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
      setHint("این مرورگر اعلان را پشتیبانی نمی‌کند.");
      return;
    }
    if (ios && !standalone()) {
      setHint("در آیفون اول با Share و Add to Home Screen برنامه را نصب کنید، بعد از آیکون خانه وارد شوید.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setHint("اجازه اعلان داده نشد.");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const keyRes = await fetch("/api/teacher/push");
    const { publicKey } = (await keyRes.json()) as { publicKey?: string };
    if (!publicKey) {
      setHint("کلید اعلان روی سرور تنظیم نشده.");
      return;
    }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const json = sub.toJSON();
    await fetch("/api/teacher/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, platform: navigator.platform, standalone: standalone() }),
    });
    setHint("اعلان روشن شد.");
  }

  return (
    <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-surface/80 p-4 text-sm">
      <p className="font-medium">اعلان روی گوشی</p>
      <p className="text-muted">اگر گزارش کلاس تا آخر روز نرسد، یا در گروه از شما سؤال شود، همین‌جا خبر می‌دهد.</p>
      <div className="flex flex-wrap gap-2">
        {install && (
          <button
            type="button"
            className="h-10 rounded-full bg-ink px-4 text-bg"
            onClick={() => {
              void install.prompt();
              setInstall(null);
            }}
          >
            افزودن به صفحه خانه
          </button>
        )}
        {ios && !standalone() && <p className="text-muted">آیفون: Share، بعد Add to Home Screen.</p>}
        <button type="button" className="h-10 rounded-full border border-line px-4" onClick={() => void enablePush()}>
          روشن کردن اعلان
        </button>
      </div>
      {hint && <p className="text-accent-text">{hint}</p>}
    </div>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
