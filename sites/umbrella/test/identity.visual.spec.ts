import { expect, test } from "@playwright/test";

/** Actual Next routes, not helper/source-order assertions. This suite is explicitly
 * an unconfigured local front door. A wired identity plane fails before any POST
 * can reach a provider; configured deployment proof is a separate integration gate.
 */
test("unconfigured Next identity refuses same-origin login and browser hostile/missing origins without credentials", async ({ page, request, baseURL }) => {
  if (baseURL === undefined) throw new Error("identity browser base URL required");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).planes.identity).toBe("absent");
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign-in is not activated on this deployment" })).toBeVisible();
  await expect(page.locator('form[action="/api/auth/account/disable"]')).toHaveCount(0);

  for (const path of ["/api/login", "/api/logout"]) {
    for (const origin of ["https://hostile.example.invalid", "https://alias.example.invalid", "null", ""]) {
      const response = await request.post(path, { headers: { origin }, form: { email: "unconfigured@example.invalid", password: "not-a-provider-credential" }, maxRedirects: 0 });
      expect(response.status()).toBe(303);
      expect(response.headers().location).toContain("SITE_REQUEST_CROSS_ORIGIN");
      expect(response.headers()["set-cookie"]).toBeUndefined();
    }
  }

  const refused = await request.post("/api/login", { headers: { origin: baseURL }, form: { email: "unconfigured@example.invalid", password: "not-a-provider-credential" }, maxRedirects: 0 });
  expect(refused.status()).toBe(303);
  expect(refused.headers().location).toContain("IDENTITY_PLANE_NOT_WIRED");
  expect(refused.headers()["set-cookie"]).toBeUndefined();
  const provider = await request.post("/api/auth/sign-in/email", { headers: { origin: baseURL }, data: { email: "unconfigured@example.invalid", password: "not-a-provider-credential" }, maxRedirects: 0 });
  expect(provider.status()).toBe(503);
  expect((await provider.json()).code).toBe("BETTER_AUTH_PROVIDER_CONFIGURATION_ABSENT");
  expect(provider.headers()["cache-control"]).toBe("no-store");
  expect(provider.headers()["set-cookie"]).toBeUndefined();
});
