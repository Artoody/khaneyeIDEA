import { NextResponse } from "next/server";

export function GET() {
  const body = {
    id: "/teacher",
    name: "پنل دبیر خانه ایده",
    short_name: "دبیر",
    start_url: "/fa/teacher",
    scope: "/",
    display: "standalone",
    lang: "fa",
    dir: "rtl",
    background_color: "#0b0c10",
    theme_color: "#0b0c10",
    orientation: "portrait-primary",
    icons: [
      { src: "/brand/teacher-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/teacher-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/teacher-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
  return NextResponse.json(body, { headers: { "content-type": "application/manifest+json" } });
}
