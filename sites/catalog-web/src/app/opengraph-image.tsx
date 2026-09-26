import { ImageResponse } from "next/og";
import { FOUNDATION_COLORS, resolveSurfaceAccent } from "@sceneaxi/site-kit";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpenGraphImage() {
  const accent = resolveSurfaceAccent("web-assets");

  const background = FOUNDATION_COLORS.find((color) => color.token === "--bg-base");

  const foreground = FOUNDATION_COLORS.find((color) => color.token === "--fg");

  if (!accent.ok || !background || !foreground) throw new Error("Foundations image tokens refused");

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: background.hex, color: foreground.hex, borderTop: `12px solid ${accent.value.accent}` }}>
      <div style={{ color: accent.value.accent, fontSize: 28, letterSpacing: 8 }}>SCENEAXI VITRINE</div>
      <div style={{ marginTop: 24, fontSize: 68, fontWeight: 700 }}>Web assets</div>
      <div style={{ marginTop: 16, fontSize: 32 }}>Curated for the Web Experience profile.</div>
    </div>,
    size,
  );
}
