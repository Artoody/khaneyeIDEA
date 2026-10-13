import { NextResponse } from "next/server";

export function GET() {
  const body = {
    id: "/teacher",
    name: "پنل دبیر خانه ایده",
    short_name: "دبیر",
    start_url: "/teacher",
    scope: "/",
    display: "standalone",
    lang: "fa",
    dir: "rtl",
    background_color: "#0b0c10",
    theme_color: "#0b0c10",
    icons: [
      { src: "/brand/mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
  return NextResponse.json(body, { headers: { "content-type": "application/manifest+json" } });
}
