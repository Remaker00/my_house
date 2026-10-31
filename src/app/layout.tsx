import type { Metadata, Viewport } from "next";
import { profile } from "@/content/story";
import "./globals.css";

export const metadata: Metadata = {
  title: `${profile.name} · ${profile.role}`,
  description: `${profile.name}, a frontend engineer in ${profile.location}, tells his story from a small ink house: where he began, what he knows, what he built, where he worked. ${profile.availability}.`,
};

export const viewport: Viewport = {
  themeColor: "#060a1c",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
