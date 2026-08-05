import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Platform detection is a property of the user agent, never of the machine running
 * the suite. Every navigation pins the agent it expects to be resolved from, so this
 * file measures the site on a macOS or Windows workstation exactly as it does in CI.
 */
const LINUX_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MACOS_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

test.use({ userAgent: LINUX_USER_AGENT });

const gotoOverview = async (page: Page, expectedPlatform = "linux") => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Build scenes. Keep the source.",
  );
  await expect(page.locator(".download-cta")).toHaveAttribute(
    "data-detected-platform",
    expectedPlatform,
  );
};

const box = async (locator: Locator) => {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  if (value === null) throw new Error("expected a rendered box");
  return value;
};

const expectNoSidewaysScroll = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    overflow.scrollWidth,
    `page scrolls sideways at ${JSON.stringify(page.viewportSize())}`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 1);
};

test("default route keeps Download, proof, comparisons, and profiles readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoOverview(page);

  await expect(page.getByRole("link", { name: "Download", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Engine comparison" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Profile capability matrix" })).toBeVisible();
  await expect(page.getByText("Kids is structurally separate")).toBeVisible();

  await expectNoSidewaysScroll(page);
});

test.describe("a detected macOS visitor", () => {
  test.use({ userAgent: MACOS_USER_AGENT });

  test("reads the coming-soon state without acquiring a macOS download", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await gotoOverview(page, "macos");

    await expect(page.locator(".download-context")).toContainText("macOS detected");
    await expect(
      page.locator('.platform-availability li[data-availability="recorded-build"]'),
    ).toHaveText(/Linux/);
    await expect(page.locator(".platform-availability")).not.toContainText("Available");
    await expect(
      page.locator('.platform-availability li[data-availability="coming-soon"]'),
    ).toHaveCount(2);
    await expect(page.locator(".platform-availability a")).toHaveCount(0);
    await expect(page.locator(".download-primary")).toHaveAttribute("href", "/engine");
  });
});

test("short desktop height keeps the release proposition and primary action above the fold", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await gotoOverview(page);

  const heading = await box(page.locator("#release-title"));
  const download = await box(page.locator(".download-primary"));
  const viewport = await box(page.locator(".release-hero .viewport"));

  expect(heading.y).toBeGreaterThanOrEqual(0);
  expect(heading.y + heading.height).toBeLessThanOrEqual(640);
  expect(download.y + download.height).toBeLessThanOrEqual(640);
  expect(viewport.height).toBeLessThanOrEqual(301);
});

test("breakpoint boundaries change composition on the declared side", async ({ page }) => {
  await page.setViewportSize({ width: 1025, height: 800 });
  await gotoOverview(page);
  const copyWide = await box(page.locator(".hero-copy"));
  const stageWide = await box(page.locator(".hero-stage"));
  expect(stageWide.x).toBeGreaterThan(copyWide.x + copyWide.width * 0.8);
  await expectNoSidewaysScroll(page);

  await page.setViewportSize({ width: 1024, height: 800 });
  const copyStacked = await box(page.locator(".hero-copy"));
  const stageStacked = await box(page.locator(".hero-stage"));
  expect(stageStacked.y).toBeGreaterThan(copyStacked.y + copyStacked.height);
  await expectNoSidewaysScroll(page);

  await page.setViewportSize({ width: 861, height: 900 });
  const wordmarkWide = await box(page.locator(".masthead .wordmark"));
  const navWide = await box(page.locator(".masthead .nav"));
  expect(Math.abs(wordmarkWide.y - navWide.y)).toBeLessThan(8);
  await expectNoSidewaysScroll(page);

  await page.setViewportSize({ width: 860, height: 900 });
  const wordmarkWrapped = await box(page.locator(".masthead .wordmark"));
  const navWrapped = await box(page.locator(".masthead .nav"));
  expect(navWrapped.y).toBeGreaterThan(wordmarkWrapped.y + wordmarkWrapped.height);
  await expectNoSidewaysScroll(page);

  await page.setViewportSize({ width: 621, height: 900 });
  const firstProofPaired = await box(page.locator(".launch-proof").nth(0));
  const secondProofPaired = await box(page.locator(".launch-proof").nth(1));
  expect(Math.abs(firstProofPaired.y - secondProofPaired.y)).toBeLessThan(2);
  await expectNoSidewaysScroll(page);

  await page.setViewportSize({ width: 620, height: 900 });
  const firstProofStacked = await box(page.locator(".launch-proof").nth(0));
  const secondProofStacked = await box(page.locator(".launch-proof").nth(1));
  expect(secondProofStacked.y).toBeGreaterThanOrEqual(
    firstProofStacked.y + firstProofStacked.height,
  );
  await expectNoSidewaysScroll(page);
});

test("keyboard order exposes the skip link and visible focus treatment", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoOverview(page);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  const skip = await box(page.locator(".skip-link"));
  expect(skip.x).toBeGreaterThanOrEqual(0);

  await page.keyboard.press("Tab");
  await expect(page.locator(".masthead .wordmark")).toBeFocused();
  const focus = await page.locator(".masthead .wordmark").evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(focus.style).not.toBe("none");
  expect(focus.width).toBeGreaterThanOrEqual(2);

  await page.locator(".comparison-scroll").focus();
  await expect(page.locator(".comparison-scroll")).toBeFocused();
});

test("composited readability clears WCAG body contrast after the browser cascade", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoOverview(page);

  const selectors = [
    ".download-primary",
    ".download-context",
    ".platform-availability li",
    '.platform-availability li[data-availability="recorded-build"] > span:last-child',
    '.platform-availability li[data-availability="coming-soon"] > span:last-child',
    ".launch-proof dd",
    ".comparison-sceneaxi td:nth-child(2)",
    ".profile-release-matrix tbody td",
    ".path-links a",
  ];

  for (const selector of selectors) {
    const result = await page.locator(selector).first().evaluate((element) => {
      type Rgba = readonly [number, number, number, number];

      const parse = (value: string): Rgba => {
        const parts = value.match(/[\d.]+/g)?.map(Number) ?? [];
        if (parts.length < 3) throw new Error(`cannot parse color ${value}`);
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
      };

      const composite = (foreground: Rgba, background: Rgba): Rgba => {
        const alpha = foreground[3] + background[3] * (1 - foreground[3]);
        if (alpha === 0) return [0, 0, 0, 0];
        return [
          (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
          (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
          (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
          alpha,
        ];
      };

      const chain: Element[] = [];
      for (let current: Element | null = element; current !== null; current = current.parentElement) {
        chain.unshift(current);
      }
      let background: Rgba = [255, 255, 255, 1];
      for (const current of chain) {
        background = composite(parse(getComputedStyle(current).backgroundColor), background);
      }

      const foreground = parse(getComputedStyle(element).color);
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (color: Rgba) =>
        0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
      const a = luminance(foreground);
      const b = luminance(background);
      return {
        foreground,
        background,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });

    expect(result.ratio, `${selector}: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(4.5);
  }
});
