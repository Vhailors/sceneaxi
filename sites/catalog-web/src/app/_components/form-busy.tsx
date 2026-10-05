"use client";

/**
 * Loading feedback for a plain GET form.
 *
 * The form still submits natively, with or without script; this only marks its submit
 * button `aria-busy` while the browser fetches the next page, so the stylesheet can show
 * the delayed 2px progress bar (DIRECTION §6.3 row 5). Returning through the back/forward
 * cache clears the mark. No value is read, changed, or sent, and no request is made.
 *
 * A callback ref rather than a hook: it attaches when the hidden marker mounts and React
 * calls the returned cleanup when it unmounts, so the component holds no state.
 */
function attach(marker: HTMLSpanElement | null): (() => void) | undefined {
  const form = marker?.closest("form");
  const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');

  if (!form || !button) return undefined;

  const busy = () => button.setAttribute("aria-busy", "true");
  const idle = () => button.removeAttribute("aria-busy");
  form.addEventListener("submit", busy);
  window.addEventListener("pageshow", idle);

  return () => {
    form.removeEventListener("submit", busy);
    window.removeEventListener("pageshow", idle);
  };
}

export function FormBusy() {
  return <span ref={attach} hidden />;
}
