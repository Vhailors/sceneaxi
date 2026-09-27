import { describe, expect, it } from "vitest";
import { checkExpiry, daysUntilExpiry } from "../scripts/check-desktop-artifact-expiry.mjs";

describe("Linux desktop artifact expiry warning", () => {
  it("counts UTC calendar days and warns inside the 21-day window", () => {
    expect(daysUntilExpiry("2026-11-10", "2026-10-20")).toBe(21);
    expect(checkExpiry("2026-11-10", "2026-10-20").ok).toBe(true);
    expect(checkExpiry("2026-11-10", "2026-10-21")).toEqual({
      ok: false,
      remainingDays: 20,
      message: "Re-record the Linux desktop artifact from a fresh successful main-branch run, then update the recorded run, source commit, checksums, verified date, and expiry in docs/desktop-linux.md and packages/site-kit/src/desktop-app-offer.ts.",
    });
    expect(checkExpiry("2026-11-10", "2026-11-10").ok).toBe(false);
    expect(checkExpiry("2026-11-10", "2026-11-11").remainingDays).toBe(-1);
  });

  it("rejects malformed calendar dates", () => {
    expect(() => daysUntilExpiry("2026-02-30", "2026-02-01")).toThrow("valid calendar dates");
  });
});
