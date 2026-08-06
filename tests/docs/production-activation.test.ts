import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BILLING_REFUSE_REASONS,
  STRIPE_LIVE_MODE_ALIAS_ENV_VARS,
  STRIPE_LIVE_MODE_ENV_VAR,
} from "@sceneaxi/billing";
import { SITE_REFUSALS } from "@sceneaxi/site-kit";

const locate = (path: string) => new URL(`../../${path}`, import.meta.url);
const read = (path: string) => readFileSync(locate(path), "utf8");
const list = (dir: string) => readdirSync(locate(dir)).sort();
const readAll = (dir: string, extensions: readonly string[]) =>
  list(dir)
    .filter((entry) => extensions.some((extension) => entry.endsWith(extension)))
    .map((entry) => read(`${dir}/${entry}`))
    .join("\n");

describe("SA-OPS-1 production activation runbook", () => {
  const runbook = read("docs/production-activation.md");
  const normalizedRunbook = runbook.replace(/\s+/g, " ");

  const sectionOf = (heading: string) => {
    const marker = `### ${heading}`;
    const start = runbook.indexOf(marker);
    expect(start, `runbook is missing section "${heading}"`).toBeGreaterThan(-1);
    const body = runbook.slice(start + marker.length);
    const next = body.search(/\n#{2,3} /);
    return next === -1 ? body : body.slice(0, next);
  };

  const rowOf = (section: string, label: string) => {
    const row = section.split("\n").find((line) => line.startsWith(`| ${label} |`));
    expect(row, `section is missing the "${label}" row`).toBeTruthy();
    return row as string;
  };

  const identifiersIn = (source: string) => [
    ...new Set(
      [...source.matchAll(/`([A-Z][A-Z0-9_]*)(?::<[a-z]+>)?`/g)].map((match) => match[1]),
    ),
  ];

  const quotedIn = (source: string) =>
    [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

  const frozenList = (source: string, name: string) => {
    const match = source.match(
      new RegExp(`\\b${name}\\s*=\\s*Object\\.freeze\\(\\[([^\\]]*)\\]\\)`),
    );
    expect(match, `owner script no longer freezes a ${name} list`).toBeTruthy();
    const entries = quotedIn((match as RegExpMatchArray)[1] as string);
    expect(entries.length, `${name} parsed as empty`).toBeGreaterThan(0);
    return entries;
  };

  const frozenKeys = (source: string, name: string) => {
    const match = source.match(
      new RegExp(`\\b${name}\\s*=\\s*Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\}\\)`),
    );
    expect(match, `owner script no longer freezes a ${name} map`).toBeTruthy();
    const keys = [
      ...((match as RegExpMatchArray)[1] as string).matchAll(/^\s+([A-Z][A-Z0-9_]*):/gm),
    ].map((entry) => entry[1]);
    expect(keys.length, `${name} parsed as empty`).toBeGreaterThan(0);
    return keys;
  };

  const EXACT_ENV_NAMES = [
    "BETTER_AUTH_ORIGIN",
    "DATABASE_URL",
    "SCENEAXI_ADMIN_EMAIL",
    "SCENEAXI_ADMIN_BOOTSTRAP_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "SCENEAXI_BILLING_MODE",
    "SCENEAXI_STRIPE_LIVE_AUTHORIZED",
    "NEXT_PUBLIC_SCENEAXI_UMBRELLA_ORIGIN",
    "NEXT_PUBLIC_SCENEAXI_GAME_CATALOG_ORIGIN",
    "NEXT_PUBLIC_SCENEAXI_WEB_CATALOG_ORIGIN",
    "SCENEAXI_SITE_EDITOR_PREVIEW",
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
    "SCENEAXI_MACOS_RELEASE_BASE_URL",
    "WIN_CSC_LINK",
    "WIN_CSC_KEY_PASSWORD",
    "GITHUB_RELEASE_TOKEN",
    "SCENEAXI_WINDOWS_RELEASE_TAG",
    "GITHUB_SHA",
    "GITHUB_REPOSITORY",
    "GITHUB_RUN_ID",
  ];

  const desktopRefusalUniverse = () => [
    ...new Set(
      [
        ...`${readAll("desktop/macos/scripts", [".mjs", ".mts"])}\n${readAll(
          "desktop/windows/scripts",
          [".mjs", ".mts"],
        )}`.matchAll(/\b((?:MACOS|WINDOWS)_[A-Z][A-Z0-9_]*)\b/g),
      ].map((match) => match[1] as string),
    ),
  ];

  it("holds the explicit authorization boundary and complete operator phases", () => {
    expect(runbook).toContain("RUNBOOK ONLY — NO PRODUCTION ACTION IS AUTHORIZED");
    expect(runbook).toContain(
      "authorized preparing this checklist and considering activation now",
    );
    expect(runbook).toContain("explicit captain authorization naming the action");
    expect(runbook).toContain("real configured credentials");

    for (const heading of [
      "Authorization gate",
      "Exact production inputs and owners",
      "Preflight checklist",
      "Activation checklist",
      "Verification checklist",
      "Rollback and refusal checklist",
      "Evidence-capture checklist",
      "Actions that remain parked",
    ]) {
      expect(runbook).toContain(`## ${heading}`);
    }
  });

  it("pins the exact web, Neon, Stripe, alias, and desktop inputs", () => {
    for (const exactName of EXACT_ENV_NAMES) {
      expect(runbook).toContain(`\`${exactName}\``);
    }

    for (const exactValue of [
      "sceneaxi-prod",
      "misty-king-68383952",
      "aws-us-east-2",
      "neondb",
      "https://sceneaxi-umbrella.vercel.app",
      "https://sceneaxi-catalog-game.vercel.app",
      "https://sceneaxi-catalog-web.vercel.app",
      "checkout.session.completed",
      "charge.refunded",
    ]) {
      expect(runbook).toContain(exactValue);
    }
  });

  it("requires named fail-closed evidence and preserves parked work", () => {
    for (const refusal of [
      "IDENTITY_PLANE_NOT_WIRED",
      "IDENTITY_SESSION_ABSENT",
      "CREDITS_PLANE_UNAVAILABLE",
      "BILLING_CHECKOUT_ORIGIN_UNTRUSTED",
      "STRIPE_WEBHOOK_SECRET_MISSING",
      "STRIPE_LIVE_MODE_NOT_AUTHORIZED",
      "STRIPE_CONNECT_LIVE_UNAVAILABLE",
      "CATALOG_COMMERCE_INERT",
      "MACOS_ENV_REQUIRED:<name>",
      "WINDOWS_RELEASE_ENV_MISSING:<name>",
    ]) {
      expect(runbook).toContain(`\`${refusal}\``);
    }

    for (const held of [
      "custom domains",
      "Kids deployment",
      "tier-6b marketplace activation",
      "Stripe LIVE credit-pack charging",
      "Stripe Connect LIVE onboarding or payout",
      "package publication",
    ]) {
      expect(normalizedRunbook).toContain(held);
    }
  });

  it("resolves every named refusal against its owning source registry", () => {
    const siteRefusals = Object.keys(SITE_REFUSALS);
    const billingRefusals = Object.values(BILLING_REFUSE_REASONS);
    const desktopRefusals = desktopRefusalUniverse();
    expect(desktopRefusals.length).toBeGreaterThanOrEqual(10);

    const tokens = [
      ...new Set(
        [...runbook.matchAll(/`([A-Z][A-Z0-9_]*)(?::<[a-z]+>)?`/g)].map(
          (match) => match[1] as string,
        ),
      ),
    ];
    expect(tokens.length).toBeGreaterThanOrEqual(45);

    const cited = [
      [siteRefusals, "@sceneaxi/site-kit", [
        "IDENTITY_PLANE_NOT_WIRED",
        "IDENTITY_PLANE_UNAVAILABLE",
        "IDENTITY_SESSION_ABSENT",
        "CREDITS_PLANE_UNAVAILABLE",
        "BILLING_CHECKOUT_ORIGIN_UNCONFIGURED",
        "BILLING_CHECKOUT_ORIGIN_UNTRUSTED",
        "SITE_REQUEST_CROSS_ORIGIN",
        "CATALOG_COMMERCE_INERT",
      ]],
      [billingRefusals, "@sceneaxi/billing", [
        "STRIPE_WEBHOOK_SECRET_MISSING",
        "STRIPE_LIVE_MODE_NOT_AUTHORIZED",
        "STRIPE_CONNECT_PROVIDER_MISSING",
        "STRIPE_CONNECT_TEST_OPERATIONS_DISABLED",
        "STRIPE_CONNECT_DASHBOARD_MISSING",
        "STRIPE_CONNECT_SECRET_MISSING",
        "STRIPE_CONNECT_LIVE_UNAVAILABLE",
      ]],
      [desktopRefusals, "the desktop release scripts", [
        "MACOS_ENV_REQUIRED",
        "MACOS_PROVENANCE_REQUIRED",
        "MACOS_HOST_REQUIRED",
        "MACOS_TOOL_REQUIRED",
        "MACOS_XCRUN_TOOL_REQUIRED",
        "WINDOWS_RELEASE_ENV_MISSING",
        "WINDOWS_RELEASE_HOST_REQUIRED",
        "WINDOWS_RELEASE_TOOL_MISSING",
      ]],
    ] as const;

    for (const [registry, owner, names] of cited) {
      for (const name of names) {
        expect(tokens, `runbook no longer names the refusal \`${name}\``).toContain(name);
        expect(registry, `${owner} no longer defines \`${name}\``).toContain(name);
      }
    }

    expect(normalizedRunbook).toContain(
      `The sole accepted LIVE authorization variable is \`${STRIPE_LIVE_MODE_ENV_VAR}\``,
    );
    const citedAlias = "STRIPE_LIVE_MODE_AUTHORIZED";
    expect(normalizedRunbook).toContain(`any alias such as \`${citedAlias}\``);
    expect(
      STRIPE_LIVE_MODE_ALIAS_ENV_VARS,
      `live-mode owner no longer refuses \`${citedAlias}\``,
    ).toContain(citedAlias);

    const resolvable = new Set([
      ...EXACT_ENV_NAMES,
      ...siteRefusals,
      ...billingRefusals,
      ...desktopRefusals,
      ...STRIPE_LIVE_MODE_ALIAS_ENV_VARS,
      STRIPE_LIVE_MODE_ENV_VAR as string,
    ]);
    for (const token of tokens) {
      expect(
        resolvable.has(token),
        `runbook names \`${token}\`, which is neither a pinned production input nor a refusal any source registry defines`,
      ).toBe(true);
    }
  });

  it("keeps the desktop signing inputs in lockstep with their platform owners", () => {
    const desktop = sectionOf("Desktop signing and notarization inputs");
    const macosOwner = `${read("docs/desktop-macos.md")}\n${readAll("desktop/macos/scripts", [".mjs", ".mts"])}`;
    const windowsOwner = `${read("docs/desktop-windows.md")}\n${readAll("desktop/windows/scripts", [".mjs", ".mts"])}`;

    const macosRow = rowOf(desktop, "macOS");
    const windowsRow = rowOf(desktop, "Windows");
    const macosIdentifiers = identifiersIn(macosRow);
    const windowsIdentifiers = identifiersIn(windowsRow);
    expect(macosIdentifiers.length).toBeGreaterThanOrEqual(14);
    expect(windowsIdentifiers.length).toBeGreaterThanOrEqual(7);

    for (const identifier of macosIdentifiers) {
      expect(macosOwner, `macOS owner no longer defines \`${identifier}\``).toContain(
        identifier,
      );
    }
    for (const identifier of windowsIdentifiers) {
      expect(windowsOwner, `Windows owner no longer defines \`${identifier}\``).toContain(
        identifier,
      );
    }

    const macosDist = read("desktop/macos/scripts/dist.mjs");
    const windowsPreflight = read("desktop/windows/scripts/release-preflight.mjs");

    const macosRequired = [
      ...frozenList(macosDist, "requiredEnvironment"),
      ...frozenKeys(macosDist, "provenanceValidators"),
    ];
    const windowsRequired = [
      ...frozenList(windowsPreflight, "WINDOWS_SIGNING_ENV"),
      ...frozenList(windowsPreflight, "WINDOWS_RELEASE_ENV"),
    ];
    for (const name of macosRequired) {
      expect(macosRow, `runbook omits required macOS input \`${name}\``).toContain(
        `\`${name}\``,
      );
    }
    for (const name of windowsRequired) {
      expect(windowsRow, `runbook omits required Windows input \`${name}\``).toContain(
        `\`${name}\``,
      );
    }

    const macosTools = [
      ...new Set([
        ...frozenList(macosDist, "requiredTools"),
        ...[...macosDist.matchAll(/for \(const tool of \[([^\]]*)\]\)/g)].flatMap((match) =>
          quotedIn(match[1] as string),
        ),
      ]),
    ];
    const windowsTools = [
      ...new Set(
        [...windowsPreflight.matchAll(/commandAvailable\("([^"]+)"\)/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    expect(macosTools.length).toBeGreaterThanOrEqual(7);
    expect(windowsTools.length).toBeGreaterThanOrEqual(2);
    for (const tool of macosTools) {
      expect(desktop, `runbook omits required macOS tool ${tool}`).toContain(
        `\`${tool}\``,
      );
    }
    for (const tool of windowsTools) {
      expect(desktop, `runbook omits required Windows tool ${tool}`).toContain(
        `\`${tool}\``,
      );
    }
  });

  it("keeps the web activation facts in lockstep with the deployment owner", () => {
    const deploy = read("docs/websites-deploy.md");

    const neonRow = rowOf(sectionOf("Web identity, Neon, and Stripe TEST"), "Neon project identifiers");
    const neonIdentifiers = [
      ...new Set([...neonRow.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)].map((match) => match[1])),
    ];
    expect(neonIdentifiers).toEqual(
      expect.arrayContaining([
        "sceneaxi-prod",
        "misty-king-68383952",
        "aws-us-east-2",
        "neondb",
      ]),
    );
    for (const identifier of neonIdentifiers) {
      expect(deploy, `deployment owner no longer records \`${identifier}\``).toContain(
        identifier,
      );
    }

    const projectRows = sectionOf("Vercel projects, aliases, and build-time origins")
      .split("\n")
      .filter((line) => line.startsWith("| `sceneaxi-"));
    expect(projectRows).toHaveLength(3);
    for (const row of projectRows) {
      const cells = [...row.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
      expect(cells).toHaveLength(3);
      for (const cell of cells) {
        expect(deploy, `deployment owner no longer records \`${cell}\``).toContain(cell);
      }
    }

    const aliases = [
      ...new Set(
        [...runbook.matchAll(/https:\/\/sceneaxi-[a-z-]+\.vercel\.app/g)].map(
          (match) => match[0],
        ),
      ),
    ];
    expect(aliases).toHaveLength(3);
    for (const alias of aliases) {
      expect(deploy, `deployment owner no longer records ${alias}`).toContain(alias);
    }

    const webhookEndpoint = "https://sceneaxi-umbrella.vercel.app/api/stripe/webhook";
    expect(runbook).toContain(webhookEndpoint);
    expect(deploy).toContain(webhookEndpoint);

    const migrations = list("db/migrations").filter((entry) => entry.endsWith(".sql"));
    expect(migrations.length).toBeGreaterThan(1);
    expect(runbook).toContain(`db/migrations/${migrations[0]}`);
    expect(runbook).toContain(migrations[migrations.length - 1]);
  });

  it("keeps the runbook the only owner that sequences activation by number", () => {
    const deploy = read("docs/websites-deploy.md");
    const mechanicsMarker = "### Activation mechanics";
    expect(
      deploy.indexOf(mechanicsMarker),
      "deployment owner no longer groups activation as unnumbered mechanics",
    ).toBeGreaterThan(-1);

    const prose = deploy.replace(/^```[\s\S]*?^```/gm, "");

    const stepCitations = [...prose.matchAll(/.*\bsteps? \d+.*/gi)].map(
      (match) => match[0].trim(),
    );
    expect(
      stepCitations,
      "the deployment owner cites an activation step number; the runbook owns the ordering, so link the mechanics anchor instead",
    ).toEqual([]);

    const orderedListItems = [...prose.matchAll(/^ *\d+\. .*/gm)].map((match) =>
      (match[0] as string).trim(),
    );
    expect(
      orderedListItems,
      "the deployment owner numbers a list into an ordered procedure; only the runbook sequences actions, so state these as unordered mechanics",
    ).toEqual([]);

    for (const runbookOwned of ["## Activation checklist", "## Rollback and refusal checklist"]) {
      expect(
        runbook,
        `runbook no longer owns "${runbookOwned}", which the deployment owner defers to`,
      ).toContain(runbookOwned);
    }
    expect(deploy).toContain("production-activation.md#activation-checklist");
  });

  it("keeps every required workflow manually recoverable after check-registration failure", () => {
    const requiredWorkflows = [
      ".github/workflows/gate.yml",
      ".github/workflows/engine-sdk.yml",
      ".github/workflows/desktop-linux.yml",
      ".github/workflows/desktop-macos.yml",
    ];

    for (const path of requiredWorkflows) {
      const workflow = read(path);
      const jobsStart = workflow.indexOf("\njobs:");
      expect(jobsStart, `${path} no longer declares jobs`).toBeGreaterThan(-1);
      const triggers = workflow.slice(0, jobsStart);
      expect(
        triggers,
        `${path} cannot be dispatched to recover a missing or cancelled required check`,
      ).toMatch(/^ {2}workflow_dispatch:\s*$/m);
      expect(runbook, `runbook omits the manual recovery owner ${path}`).toContain(
        `\`${path}\``,
      );
    }

    const recovery = sectionOf("GitHub required-check registration recovery");
    const normalizedRecovery = recovery.replace(/\s+/g, " ");
    expect(normalizedRecovery).toContain(
      "operator-only CI recovery mechanics, not an activation step",
    );
    expect(normalizedRecovery).toContain("does not deploy a site");
    expect(normalizedRecovery).toContain("enable Stripe LIVE");
    expect(normalizedRecovery).toContain(
      "fails closed when its real Apple inputs are absent",
    );
    expect(normalizedRecovery).toContain(
      "authoritative GitHub results for the intended head",
    );
  });

  it("keeps the dated readiness observations in lockstep with the deployment owner", () => {
    const deploy = read("docs/websites-deploy.md");
    const readinessMarker = "## Verified TEST readiness";
    const readinessStart = deploy.indexOf(readinessMarker);
    expect(readinessStart, "deployment owner no longer records TEST readiness").toBeGreaterThan(
      -1,
    );
    const readinessBody = deploy.slice(readinessStart + readinessMarker.length);
    const readinessEnd = readinessBody.search(/\n## /);
    const readiness = (
      readinessEnd === -1 ? readinessBody : readinessBody.slice(0, readinessEnd)
    ).replace(/\s+/g, " ");

    const inventory = sectionOf("Web identity, Neon, and Stripe TEST");
    const normalizedInventory = inventory.replace(/\s+/g, " ");
    expect(inventory).toContain("websites-deploy.md#verified-test-readiness");

    const tableStart = inventory.indexOf("\n| Input or evidence");
    expect(tableStart, "runbook inventory no longer leads with its table").toBeGreaterThan(-1);
    const preambleParagraphs = inventory
      .slice(0, tableStart)
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter((paragraph) => paragraph.length > 0);
    expect(
      preambleParagraphs,
      "runbook inventory no longer separates externally observed cells from locally asserted ones",
    ).toHaveLength(2);
    const [observedPreamble, localPreamble] = preambleParagraphs as [string, string];
    expect(observedPreamble).toContain("websites-deploy.md#verified-test-readiness");
    expect(localPreamble).not.toContain("websites-deploy.md#verified-test-readiness");
    for (const label of [
      "`SCENEAXI_ADMIN_EMAIL`",
      "Neon-backed provider handles",
      "TEST checkout/evidence adapters",
    ]) {
      rowOf(inventory, label);
      expect(
        observedPreamble,
        `the readiness record does not observe ${label}; the runbook claims the owner's observation covers it`,
      ).not.toContain(label);
      expect(
        localPreamble,
        `runbook no longer states that ${label} is asserted locally rather than externally observed`,
      ).toContain(label);
    }

    const observedOn = readiness.match(/repeated on (\d{4}-\d{2}-\d{2})/);
    expect(observedOn, "readiness record no longer dates its observation").toBeTruthy();
    expect(
      normalizedInventory,
      "runbook inventory no longer names the owner's observation date",
    ).toContain((observedOn as RegExpMatchArray)[1]);

    const listed = readiness.match(/Vercel lists ([^*]*?) as encrypted Production variable/);
    expect(listed, "readiness record no longer lists observed variable names").toBeTruthy();
    const observedNames = identifiersIn((listed as RegExpMatchArray)[1] as string);
    expect(observedNames.length).toBeGreaterThanOrEqual(5);
    for (const name of observedNames) {
      const row = rowOf(inventory, `\`${name}\``);
      expect(row, `runbook does not record \`${name}\` as an observed name`).toMatch(
        /name (?:was |only )/,
      );
    }

    const betterAuthRow = rowOf(inventory, "`BETTER_AUTH_ORIGIN`");
    expect(
      observedNames,
      "readiness now observes BETTER_AUTH_ORIGIN; the runbook still calls it missing",
    ).not.toContain("BETTER_AUTH_ORIGIN");
    expect(readiness).toContain("`BETTER_AUTH_ORIGIN` is also absent");
    expect(betterAuthRow).toContain("**Missing**");
    expect(readiness).toContain("predates the merged hosted-login route");
    expect(betterAuthRow).toContain("predates `/login`");

    const neonRow = rowOf(inventory, "Neon project identifiers");
    expect(readiness).toContain("No database connection or migration was attempted");
    expect(neonRow).toContain("no connection or migration proof was performed");

    const endpointRow = rowOf(inventory, "Stripe TEST endpoint");
    expect(readiness).toContain("`livemode: false`");
    expect(endpointRow).toContain("`livemode: false`");
    const subscribed = readiness.match(/subscribed only to `([^`]+)`/);
    expect(subscribed, "readiness record no longer states the subscribed events").toBeTruthy();
    expect(endpointRow).toContain(
      `subscribed only to \`${(subscribed as RegExpMatchArray)[1]}\``,
    );
  });

  it("is linked from every narrower operations owner", () => {
    for (const path of [
      "README.md",
      "docs/websites-deploy.md",
      "docs/auth-credits.md",
      "docs/stripe-live-activation.md",
      "docs/stripe-connect-operations.md",
      "docs/desktop-linux.md",
      "docs/desktop-macos.md",
      "docs/desktop-windows.md",
      "docs/program/NEXT-STEP.md",
      "docs/adr/0021-identity-credits-injected-adapters.md",
    ]) {
      expect(read(path), `${path} no longer points at the activation owner`).toContain(
        "production-activation.md",
      );
    }
  });
});
