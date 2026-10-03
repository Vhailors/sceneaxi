"use client";

/** Root-layout failure must not echo a server exception or imply a completed purchase. */
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <main role="alert">
          <h1>The catalogue could not open</h1>
          <p>No purchase was made. You can leave this page and return later.</p>
          <a href="/">Back to the catalogue</a>
        </main>
      </body>
    </html>
  );
}
