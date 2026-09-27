#!/usr/bin/env node
/**
 * Desktop artifact expiry check — fail before the offered Linux download disappears.
 *
 * The `/engine` download offer points at a GitHub Actions workflow artifact that expires
 * (docs/desktop-linux.md, "Download expires by"). The scheduled
 * `desktop-artifact-expiry` workflow runs this weekly and goes red when fewer than
 * `WARNING_DAYS` remain, printing what to re-record.
 */
import { readFileSync } from "node:fs";

export const WARNING_DAYS = 21;

export function daysUntilExpiry(expiry, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error("Expiry and today must be YYYY-MM-DD dates");
  }
  const expiryMs = Date.parse(`${expiry}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (new Date(expiryMs).toISOString().slice(0, 10) !== expiry || new Date(todayMs).toISOString().slice(0, 10) !== today) {
    throw new Error("Expiry and today must be valid calendar dates");
  }
  return (expiryMs - todayMs) / 86_400_000;
}

export function checkExpiry(expiry, today) {
  const remainingDays = daysUntilExpiry(expiry, today);
  return {
    ok: remainingDays >= WARNING_DAYS,
    remainingDays,
    message: remainingDays < WARNING_DAYS
      ? `Re-record the Linux desktop artifact from a fresh successful main-branch run, then update the recorded run, source commit, checksums, verified date, and expiry in docs/desktop-linux.md and packages/site-kit/src/desktop-app-offer.ts.`
      : `Linux desktop artifact expiry is ${expiry}; ${remainingDays} days remain.`,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const doc = readFileSync(new URL("../docs/desktop-linux.md", import.meta.url), "utf8");
  const match = doc.match(/^\| Download expires by \| (\d{4}-\d{2}-\d{2}) \|$/m);
  if (!match) throw new Error("Could not read Download expires by date from docs/desktop-linux.md");
  const result = checkExpiry(match[1], new Date().toISOString().slice(0, 10));
  console.log(result.message);
  if (!result.ok) process.exitCode = 1;
}
