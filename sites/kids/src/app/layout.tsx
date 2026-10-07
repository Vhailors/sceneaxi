import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SceneAxi Kids — Make a tiny world",
  description: "A small, private-by-construction world-building activity for kids.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231e4fbf'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23ffffff' stroke-width='3'/%3E%3Cpath d='M5 16h22' stroke='%23ffffff' stroke-width='3'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/big-shoulders-display.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body data-dialect="kids">{children}</body>
    </html>
  );
}
