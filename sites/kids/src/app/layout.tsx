import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SceneAxi Kids — Make a tiny world",
  description: "A small, private-by-construction world-building activity for kids.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2307080a'/%3E%3Cpath d='M16 5l3.2 7.8L27 16l-7.8 3.2L16 27l-3.2-7.8L5 16l7.8-3.2z' fill='%23a78bfa'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
