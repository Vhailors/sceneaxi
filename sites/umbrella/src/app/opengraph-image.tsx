import { ImageResponse } from "next/og";
import { FOUNDATION_COLORS, resolveSurfaceAccent } from "@sceneaxi/site-kit";
import { UMBRELLA_BRAND } from "../lib/site-config.js";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpenGraphImage() {
  const accent = resolveSurfaceAccent("umbrella");

  const background = FOUNDATION_COLORS.find((color) => color.token === "--bg-base");

  const foreground = FOUNDATION_COLORS.find((color) => color.token === "--fg");

  if (!accent.ok || !background || !foreground) throw new Error("Foundations image tokens refused");

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: background.hex, color: foreground.hex, borderTop: `12px solid ${accent.value.accent}` }}>
      <div style={{ color: accent.value.accent, fontSize: 28, letterSpacing: 8 }}>{UMBRELLA_BRAND.name}</div>
      <div style={{ marginTop: 24, fontSize: 68, fontWeight: 700 }}>{UMBRELLA_BRAND.tagline}</div>
      <div style={{ marginTop: 16, fontSize: 32 }}>{UMBRELLA_BRAND.summary}</div>
    </div>,
    size,
  );
}
