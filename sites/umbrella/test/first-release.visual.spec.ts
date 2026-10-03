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
  await page.evaluate(() => {
    const active = document.activeElement;

    if (active instanceof HTMLElement) active.blur();
  });

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
    // The redesign's new text: chrome, provenance, the proof gallery, tables, footer.
    ".masthead .nav a",
    ".masthead-actions .button",
    ".badge",
    ".hero-stage-note",
    ".launch-proof dt",
    ".proof-title",
    ".proof-claim",
    ".proof-level",
    ".proof-limits .chip",
    ".proof-link",
    ".comparison-table th[scope=\"row\"] > span",
    ".comparison-table th[scope=\"row\"] > a",
    ".profile-release-matrix thead .chip",
    ".matrix-note p",
    "footer .footer-col a",
    "footer .footer-version",
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

test("the masthead holds one row on desktop and two on a phone, on the shared edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoOverview(page);
  const masthead = await box(page.locator(".masthead"));
  expect(masthead.height).toBeLessThanOrEqual(61.5);
  // The wordmark, the hero copy, and the footer brand share one left edge.
  const wordmark = await box(page.locator(".masthead .wordmark"));
  const heroCopy = await box(page.locator(".hero-copy"));
  const footerBrand = await box(page.locator(".footer-brand"));
  expect(Math.abs(wordmark.x - heroCopy.x)).toBeLessThan(1);
  expect(Math.abs(wordmark.x - footerBrand.x)).toBeLessThan(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const phone = await box(page.locator(".masthead"));
  expect(phone.height).toBeLessThanOrEqual(104);
  await expectNoSidewaysScroll(page);
});

test("the first fold carries the claim, both actions, the artifact, and the trust rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoOverview(page);
  const stage = await box(page.locator(".release-hero .viewport"));
  expect(stage.width).toBeGreaterThanOrEqual(671);
  expect(stage.height).toBeGreaterThanOrEqual(503);
  const primary = await box(page.locator(".download-primary"));
  const secondary = await box(page.locator(".release-actions > .button-quiet"));
  expect(Math.abs(primary.y - secondary.y)).toBeLessThanOrEqual(1);
  expect(primary.height).toBe(46);
  expect(secondary.height).toBe(46);
  const rail = await box(page.locator(".launch-proof-rail"));
  expect(rail.y).toBeLessThanOrEqual(720);

  await page.setViewportSize({ width: 390, height: 844 });
  const phoneStage = await box(page.locator(".release-hero .viewport"));
  expect(phoneStage.y).toBeLessThanOrEqual(700);
  const phonePrimary = await box(page.locator(".download-primary"));
  const phoneSecondary = await box(page.locator(".release-actions > .button-quiet"));
  // Download spans the column; the open-path link keeps its own width, below the facts.
  expect(phoneSecondary.width).toBeLessThan(phonePrimary.width);
  expect(phoneSecondary.y).toBeGreaterThan(phonePrimary.y + phonePrimary.height);
});

test("the proof gallery shows three captioned captures, each with its limits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await gotoOverview(page);
  const figures = page.locator(".proof-gallery .proof-figure");
  await expect(figures).toHaveCount(3);
  const heights: number[] = [];

  for (let index = 0; index < 3; index += 1) {
    const figure = figures.nth(index);
    const image = figure.locator("img");
    await expect(image).toHaveAttribute("loading", "lazy");
    expect(((await image.getAttribute("alt")) ?? "").length).toBeGreaterThan(0);
    expect(await figure.locator(".proof-limits li").count()).toBeGreaterThan(0);
    // The capture is evidence, not a control: the image never sits inside a link.
    await expect(figure.locator("a img")).toHaveCount(0);
    heights.push((await box(figure)).height);
  }

  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);

  for (const href of await page.locator(".proof-link").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")),
  )) {
    expect(["/engine", "/docs"]).toContain(href);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const first = await box(figures.nth(0).locator(".proof-frame"));
  const second = await box(figures.nth(1).locator(".proof-frame"));
  expect(Math.abs(first.x - second.x)).toBeLessThan(1);
  expect(second.y).toBeGreaterThan(first.y + first.height);
  await expectNoSidewaysScroll(page);
});

test("the overview keeps an 11px floor, nine sizes at most, and a 1.4 heading ratio", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await gotoOverview(page);

    /*
      Every size a sighted reader can see: any laid-out element with its own text. Text
      hidden from assistive technology still counts, since `aria-hidden` removes it from
      the accessibility tree, not from the screen.
    */
    const ramp = await page.evaluate(() => {
      const sizes = new Set<number>();

      for (const element of document.querySelectorAll("body *")) {
        const hasText = [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
        );

        const rect = element.getBoundingClientRect();

        if (hasText && rect.width > 0 && rect.height > 0) {
          sizes.add(Number.parseFloat(getComputedStyle(element).fontSize));
        }
      }

      const size = (element: Element | null) =>
        element === null ? 0 : Number.parseFloat(getComputedStyle(element).fontSize);

      return {
        sizes: [...sizes].sort((a, b) => a - b),
        h1: size(document.querySelector("#release-title")),
        h2: Math.max(...[...document.querySelectorAll("main h2")].map(size)),
      };
    });

    const evidence = `${JSON.stringify(viewport)} ${JSON.stringify(ramp)}`;

    expect(Math.min(...ramp.sizes), evidence).toBeGreaterThanOrEqual(11);
    expect(ramp.sizes.length, evidence).toBeLessThanOrEqual(9);

    if (viewport.width === 1440) expect(ramp.h1 / ramp.h2, evidence).toBeGreaterThanOrEqual(1.4);
    else expect(ramp.h2, evidence).toBeGreaterThanOrEqual(28);
  }
});

test.describe("before any script runs", () => {
  test.use({ javaScriptEnabled: false });

  test("the hero stage is a labelled panel, never an unexplained black box", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const stage = page.locator(".release-hero .hero-stage");
    await expect(stage).toHaveAttribute("data-frame", "pending");
    await expect(stage.locator(".hero-stage-note")).toContainText(
      "Opening a committed Sculpt Artifact",
    );

    // The panel over the canvas: the panel fill under a token-line grid, fully shown.
    const panel = await stage.locator(".viewport").evaluate((element) => {
      const style = getComputedStyle(element, "::after");

      return { opacity: style.opacity, image: style.backgroundImage };
    });

    expect(panel.opacity).toBe("1");
    expect(panel.image).toContain("linear-gradient");
  });
});
