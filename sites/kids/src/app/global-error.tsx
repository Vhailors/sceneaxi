"use client";

/**
 * Root failure face. It replaces the root layout and may import nothing, so it cannot
 * read globals.css: the block below holds literal copies of existing Kids sheet values
 * (DV-F12; no new colour, no custom property). Change a sheet value, change it here too.
 * The CSS stays free of quotes, angle brackets, ampersands and URLs, and it is static.
 */
const ROOT_FALLBACK_STYLE = [
  "html{background:#07080a;color-scheme:dark}",
  "body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px 16px;box-sizing:border-box;background:#07080a;color:#edeff2;font-family:ui-rounded,system-ui,sans-serif;-webkit-text-size-adjust:100%}",
  ".rest{box-sizing:border-box;width:min(560px,100%);padding:32px;background:#0d0f12;border:2px solid #2c323b;border-radius:16px}",
  "main h1{margin:0;font-size:2rem;line-height:1.1;letter-spacing:-0.02em;font-weight:800;text-wrap:balance}",
  ".rest-note{margin:16px 0 0;max-width:44ch;color:#8a929c;font-size:1.125rem;line-height:1.6;text-wrap:pretty}",
  "@media (max-width:560px){.rest{padding:24px}main h1{font-size:1.75rem}}",
].join("");

/** A root failure stays child-safe and has no outbound link or ambient capability. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <style>{ROOT_FALLBACK_STYLE}</style>
        <main className="rest" role="alert">
          <h1>Let&apos;s take a short break</h1>
          <p className="rest-note">Close this page and open your play space again when you are ready.</p>
        </main>
      </body>
    </html>
  );
}
