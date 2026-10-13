import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "دبیر", statusBarStyle: "black-translucent" },
};

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return children;
}
