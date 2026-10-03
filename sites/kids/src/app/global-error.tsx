"use client";

/** A root failure stays child-safe and has no outbound link or ambient capability. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main role="alert">
          <h1>Let&apos;s take a short break</h1>
          <p>Close this page and open your play space again when you are ready.</p>
        </main>
      </body>
    </html>
  );
}
