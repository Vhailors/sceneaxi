"use client";

/**
 * Root-layout failure must not echo a server exception or imply a completed purchase.
 *
 * This document replaces the root layout, so no stylesheet reaches it, and it may not
 * import anything. One inline block styles it: literal copies of this store's existing
 * sheet values (DIRECTION DV-F12), the system UI stack, no custom property, and no quote,
 * angle bracket, ampersand or URL. It is static by design, so it needs no motion fallback.
 */
const FALLBACK_STYLE = [
  "html{background:#07080A;color-scheme:dark}",
  "body{margin:0;background:#07080A;color:#EDEFF2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:1rem;line-height:1.6;-webkit-font-smoothing:antialiased}",
  "main{box-sizing:border-box;max-width:42rem;margin:0 auto;padding:4.5rem 1rem;display:flex;flex-direction:column;align-items:flex-start;gap:1rem}",
  "main h1{margin:0;padding-bottom:0.75rem;font-size:1.875rem;line-height:1.08;letter-spacing:-0.025em;font-weight:700;text-wrap:balance;background-image:linear-gradient(#FF4D5E,#FF4D5E);background-size:3rem 2px;background-repeat:no-repeat;background-position:0 100%}",
  ".lede{margin:0;max-width:60ch;font-size:1.125rem;line-height:1.55;color:#8A929C;text-wrap:pretty}",
  ".primary{display:inline-flex;align-items:center;justify-content:center;min-height:2.875rem;margin-top:0.5rem;padding:0 1.5rem;border-radius:5px;background:#E8544E;color:#07080A;font-size:0.9375rem;font-weight:600;text-decoration:none;cursor:pointer}",
  ".primary:hover{box-shadow:inset 0 0 0 6rem rgba(7,8,10,0.08)}",
  ".primary:active{box-shadow:inset 0 0 0 6rem rgba(7,8,10,0.1)}",
  ".primary:focus-visible{outline:2px solid #E8544E;outline-offset:2px}",
  "@media (forced-colors:active){.primary{border:1px solid ButtonText}.primary:focus-visible{outline-color:Highlight}}",
].join("");

export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <style>{FALLBACK_STYLE}</style>
        <main role="alert">
          <h1>The catalogue could not open</h1>
          <p className="lede">No purchase was made. You can leave this page and return later.</p>
          <a className="primary" href="/">Back to the catalogue</a>
        </main>
      </body>
    </html>
  );
}
