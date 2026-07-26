import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendTo, editManifest, makeFixture, removeFixture, runCheck, writeTo } from "../helpers/fixture.ts";

/**
 * Injected-violation regressions for `check-publish-ready.mjs`.
 *
 * The publish-ready story is a claim made to outsiders, and nothing external verifies
 * it — there is no registry publish to fail. So the guarantee rests entirely on this
 * checker failing closed, and these tests are what prove it does. Each copies the real
 * tree, injects exactly one drift, and asserts the specific refusal.
 *
 * The control test proves the clean copy passes, so every failure below is caused by
 * its own injection alone.
 */

/** Rewrite one marked doc table's body rows; the marker contract is what the gate reads. */
function editMarkedTable(root: string, rel: string, key: string, mutate: (rows: string[]) => string[]): void {
  const path = join(root, rel);
  const text = readFileSync(path, "utf8");
  const marker = `<!-- publish-ready:${key} -->`;
  const start = text.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const after = text.slice(start + marker.length);
  const lines = after.split("\n");
  let end = 0;
  while (end < lines.length && (lines[end]?.trim() === "" || lines[end]?.trim().startsWith("|"))) end += 1;
  const table = lines.slice(0, end).filter((line) => line.trim().startsWith("|"));
  const rest = lines.slice(end);
  const mutated = mutate(table);
  writeFileSync(path, `${text.slice(0, start + marker.length)}\n${mutated.join("\n")}\n${rest.join("\n")}`);
}

const CHECK = "check-publish-ready.mjs" as const;

describe("publish-ready check — injected violations", () => {
  let fx: string;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    removeFixture(fx);
  });

  it("control: the unmodified tree passes", () => {
    const res = runCheck(fx, CHECK);
    expect(res.stderr).toBe("");
    expect(res.stdout).toContain("publish-ready check OK");
    expect(res.status).toBe(0);
  });

  it("fails when a package stops being private", () => {
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.private = false;
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[manifest-private] @sceneaxi/schemas is not private");
  });

  it("fails when the repository root manifest stops being private", () => {
    // The root manifest is not a workspace package, so nothing else covers it — yet it
    // is the one `npm publish` at the repo root would ship.
    editManifest(fx, "package.json", (m) => {
      m.private = false;
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[manifest-private] sceneaxi (repository root) is not private");
  });

  it("fails when the repository root manifest grows a publish lifecycle hook", () => {
    editManifest(fx, "package.json", (m) => {
      m.scripts = { ...(m.scripts as Record<string, string>), prepublishOnly: "echo build" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-publish-hooks] sceneaxi (repository root) declares a 'prepublishOnly' script");
  });

  it("fails when a manifest drops a required hygiene field", () => {
    editManifest(fx, "packages/importers/package.json", (m) => {
      delete m.description;
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[manifest-hygiene] @sceneaxi/importers declares no description");
  });

  it("fails with a structured refusal when a workspace manifest is unreadable", () => {
    // A broken manifest must refuse like every other drift, not die with a raw stack
    // trace that names no check.
    writeTo(fx, "packages/importers/package.json", "{ not json");
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("publish-ready check FAILED");
    expect(res.stderr).toContain("[manifest-hygiene] packages/importers/package.json is unreadable");
  });

  it("fails when a package drifts off the pinned version plan", () => {
    editManifest(fx, "packages/engine-kernel/package.json", (m) => {
      m.version = "0.1.0";
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[manifest-version-plan] @sceneaxi/engine-kernel is version '0.1.0'");
    // The doc table still says 0.0.0, so the same drift is caught from the docs side too.
    expect(res.stderr).toContain("[docs-version-plan]");
  });

  it("fails when an exports target points at a file that does not exist", () => {
    editManifest(fx, "packages/authoring-core/package.json", (m) => {
      m.exports = { ".": "./src/index.ts", "./gone": "./src/does-not-exist.ts" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[exports-resolve] @sceneaxi/authoring-core export './gone' points at missing file");
  });

  it("fails when an exports target is a symlink rather than a real file", () => {
    symlinkSync(join(fx, "packages/schemas/src/index.ts"), join(fx, "packages/schemas/src/alias.ts"));
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.exports = { ...(m.exports as Record<string, string>), "./testing/alias.ts": "./src/alias.ts" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[exports-resolve] @sceneaxi/schemas export './testing/alias.ts' is a symlink",
    );
  });

  it("fails when an exports target reaches outside the package through a symlinked directory", () => {
    // Only the final path component is lstat'd; the kernel resolves every directory above
    // it, so containment has to be proven on canonical paths rather than on the string.
    mkdirSync(join(fx, "outside-package"), { recursive: true });
    writeFileSync(join(fx, "outside-package/leaked.ts"), "export {};\n");
    symlinkSync(join(fx, "outside-package"), join(fx, "packages/importers/vendor"), "dir");
    editManifest(fx, "packages/importers/package.json", (m) => {
      m.exports = { ...(m.exports as Record<string, string>), "./vendor/leaked.ts": "./vendor/leaked.ts" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[exports-resolve] @sceneaxi/importers export './vendor/leaked.ts' resolves outside its package root",
    );
  });

  it("fails when an exports subpath is a pattern rather than an explicit target", () => {
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.exports = { ...(m.exports as Record<string, string>), "./testing/*": "./src/testing/*.ts" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[exports-resolve] @sceneaxi/schemas export './testing/*' is a subpath pattern");
  });

  it("fails when a files entry does not exist", () => {
    editManifest(fx, "packages/engine-kernel/package.json", (m) => {
      m.files = ["src", "no-such-dir"];
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[files-resolve] @sceneaxi/engine-kernel declares files entry 'no-such-dir'");
  });

  it("fails when a files glob has no directory it could match inside", () => {
    editManifest(fx, "packages/engine-kernel/package.json", (m) => {
      m.files = ["src", "no-such-dir/**"];
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[files-resolve] @sceneaxi/engine-kernel declares files entry 'no-such-dir/**', which does not exist (no 'no-such-dir' for it to match inside)",
    );
  });

  it("fails when an internal dependency leaves the workspace protocol", () => {
    editManifest(fx, "packages/profile-web/package.json", (m) => {
      m.dependencies = { ...m.dependencies, "@sceneaxi/schemas": "^1.2.3" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[internal-deps-workspace] @sceneaxi/profile-web declares @sceneaxi/schemas@'^1.2.3'");
  });

  it("fails when an internal dependency hides in optionalDependencies", () => {
    // npm and pnpm both install optional dependencies, so the field is not a way out of
    // the workspace-protocol rule.
    editManifest(fx, "packages/profile-web/package.json", (m) => {
      m.optionalDependencies = { "@sceneaxi/schemas": "^1.2.3" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[internal-deps-workspace] @sceneaxi/profile-web declares @sceneaxi/schemas@'^1.2.3' in optionalDependencies",
    );
  });

  it("fails when a package grows a publish lifecycle hook", () => {
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.scripts = { prepublishOnly: "echo build" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-publish-hooks] @sceneaxi/schemas declares a 'prepublishOnly' script");
  });

  it("fails when a package grows a prepare hook", () => {
    // npm runs `prepare` during both publish and pack, so it is a publish hook like the
    // siblings around it.
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.scripts = { prepare: "echo build" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-publish-hooks] @sceneaxi/schemas declares a 'prepare' script");
  });

  it("fails when a package declares publishConfig", () => {
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.publishConfig = { access: "public" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-publish-hooks] @sceneaxi/schemas declares publishConfig");
  });

  it("fails when a root script could run a registry publish", () => {
    editManifest(fx, "package.json", (m) => {
      m.scripts = { ...(m.scripts as Record<string, string>), ship: "npm publish --access public" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-registry-publish] package.json can run a registry publish");
  });

  it("fails when a root script hides the publish verb behind a flag value", () => {
    // Flag order is not a way out: the verb is matched as a token anywhere in the
    // command, not only immediately after the package manager.
    editManifest(fx, "package.json", (m) => {
      m.scripts = { ...(m.scripts as Record<string, string>), ship: "npm --access public publish" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-registry-publish] package.json can run a registry publish (npm publish)");
  });

  it("fails when a CI workflow could run a registry publish", () => {
    appendTo(fx, ".github/workflows/gate.yml", "\n      - run: pnpm publish -r --no-git-checks\n");
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[no-registry-publish] .github/workflows/gate.yml can run a registry publish");
  });

  it("fails when a CI workflow uses the recursive publish form", () => {
    appendTo(fx, ".github/workflows/gate.yml", "\n      - run: pnpm -r --filter ./packages publish\n");
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[no-registry-publish] .github/workflows/gate.yml can run a registry publish (pnpm publish)",
    );
  });

  it("fails when a CI workflow wraps the publish across a line continuation", () => {
    // A command split over two lines is still one command; folding continuations away is
    // what keeps the head and its verb together.
    appendTo(fx, ".github/workflows/gate.yml", "\n      - run: npm \\\n          publish --access public\n");
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[no-registry-publish] .github/workflows/gate.yml can run a registry publish (npm publish)",
    );
  });

  it("fails when the SDK output directories stop being git-ignored", () => {
    writeTo(fx, ".gitignore", "node_modules/\ndist/\n");
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[sdk-output-ignored] .gitignore does not ignore 'dist-sdk/'");
  });

  it("fails when the site SDK output directory stops being git-ignored", () => {
    // The umbrella builds the SDK into its own `public/` from `prebuild`/`predev`, so that
    // directory is a third real output path a stale archive could be committed from.
    const path = join(fx, ".gitignore");
    writeFileSync(
      path,
      readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "sites/*/public/engine-sdk/")
        .join("\n"),
    );
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[sdk-output-ignored] .gitignore does not ignore 'sites/*/public/engine-sdk/'",
    );
  });

  it("fails when a profile manifest pin and its seam pin disagree", () => {
    editManifest(fx, "packages/profile-web/package.json", (m) => {
      m.sceneaxi = { ...m.sceneaxi, corePin: "^0.1.0" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    // The plan pin is the first thing that disagrees, and it is the load-bearing one:
    // a profile may not quietly claim a core train the release plan has not reached.
    expect(res.stderr).toContain("[profile-core-pin] @sceneaxi/profile-web pins core '^0.1.0'");
  });

  it("fails when a profile seam literal drifts from its manifest pin", () => {
    const path = join(fx, "packages/profile-game/src/index.ts");
    writeFileSync(path, readFileSync(path, "utf8").replace('CORE_PIN = "^0.0.0"', 'CORE_PIN = "^9.9.9"'));
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[profile-core-pin] @sceneaxi/profile-game seam pins '^9.9.9'");
  });

  it("fails when an SDK package exports a file the archive does not ship", () => {
    writeTo(fx, "packages/engine-kernel/extra.ts", "export {};\n");
    editManifest(fx, "packages/engine-kernel/package.json", (m) => {
      m.exports = { ...(m.exports as Record<string, string>), "./extra": "./extra.ts" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[sdk-covers-exports] @sceneaxi/engine-kernel export './extra' resolves to 'packages/engine-kernel/extra.ts', which the engine SDK archive does not ship",
    );
  });

  it("fails when a Kids file is pinned into the SDK archive list", () => {
    const path = join(fx, "scripts/engine-sdk-files.json");
    const list = JSON.parse(readFileSync(path, "utf8")) as string[];
    writeFileSync(path, JSON.stringify([...list, "packages/profile-kids/src/index.ts"], null, 2));
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("is Kids content — the Kids boundary is absolute");
  });

  it("fails when a documented consumer package does not ship in the SDK archive", () => {
    editMarkedTable(fx, "docs/web-consumer.md", "consumer-surface", (rows) => [
      ...rows,
      "| `@sceneaxi/plugin-host` | a real package the archive does not carry | pin it |",
    ]);
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[sdk-consumer-packages] docs/web-consumer.md documents '@sceneaxi/plugin-host' as a consumer entry point, but the engine SDK archive does not ship it",
    );
  });

  it("fails when the consumer contract documents a package that does not exist", () => {
    editMarkedTable(fx, "docs/web-consumer.md", "consumer-surface", (rows) => [
      ...rows,
      "| `@sceneaxi/profile-imaginary` | invented | invented |",
    ]);
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-consumer-surface] docs/web-consumer.md documents '@sceneaxi/profile-imaginary', which is not a workspace package",
    );
  });

  it("fails when a real export subpath is covered by no documented namespace", () => {
    editManifest(fx, "packages/schemas/package.json", (m) => {
      m.exports = { ...(m.exports as Record<string, string>), "./internal/index.ts": "./src/index.ts" };
    });
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "@sceneaxi/schemas exports './internal/index.ts', which no namespace documented in docs/publish-readiness.md covers",
    );
  });

  it("fails when a documented namespace matches no real export", () => {
    editMarkedTable(fx, "docs/publish-readiness.md", "exports", (rows) =>
      rows.map((row) =>
        row.includes("@sceneaxi/profile-web") ? "| `@sceneaxi/profile-web` | `./src/index.ts` | `./ghost/*` |" : row,
      ),
    );
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-export-namespaces] docs/publish-readiness.md documents namespace './ghost/*' for @sceneaxi/profile-web, which matches no real export",
    );
  });

  it("fails when the documented root export is not the real one", () => {
    editMarkedTable(fx, "docs/publish-readiness.md", "exports", (rows) =>
      rows.map((row) =>
        row.includes("@sceneaxi/authoring-core")
          ? "| `@sceneaxi/authoring-core` | `./src/main.ts` | — |"
          : row,
      ),
    );
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-export-namespaces] @sceneaxi/authoring-core root export is './src/index.ts', docs/publish-readiness.md documents './src/main.ts'",
    );
  });

  it("fails when a workspace package is missing from the documented version plan", () => {
    editMarkedTable(fx, "docs/publish-readiness.md", "versions", (rows) =>
      rows.filter((row) => !row.includes("`@sceneaxi/plugin-host`")),
    );
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-version-plan] @sceneaxi/plugin-host is a workspace package with no row in the docs/publish-readiness.md version plan",
    );
  });

  it("fails when the documented release group disagrees with the manifest", () => {
    editMarkedTable(fx, "docs/publish-readiness.md", "versions", (rows) =>
      rows.map((row) =>
        row.includes("`@sceneaxi/billing`") ? "| `@sceneaxi/billing` | `0.0.0` | `apps` | — |" : row,
      ),
    );
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-version-plan] @sceneaxi/billing release group is 'identity', docs/publish-readiness.md declares 'apps'",
    );
  });

  it("fails when the checklist claims a check the script does not implement", () => {
    editMarkedTable(fx, "docs/publish-readiness.md", "checklist", (rows) => [
      ...rows,
      "| `audits-the-whole-registry` | an overstated guarantee |",
    ]);
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-checklist-ids] docs/publish-readiness.md claims check 'audits-the-whole-registry', which this script does not implement",
    );
  });

  it("fails when an implemented check is dropped from the published checklist", () => {
    editMarkedTable(fx, "docs/publish-readiness.md", "checklist", (rows) =>
      rows.filter((row) => !row.includes("`no-registry-publish`")),
    );
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-checklist-ids] check 'no-registry-publish' runs but is not listed in docs/publish-readiness.md",
    );
  });

  it("fails closed when a required consumer doc is emptied", () => {
    writeTo(fx, "docs/publish-readiness.md", "");
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("declaration marker");
  });

  it("attributes a deleted doc to the check that doc backs", () => {
    // The ID-to-guarantee mapping is the contract `docs-checklist-ids` enforces, so the
    // refusal for a missing doc has to name the check that stopped being enforceable.
    rmSync(join(fx, "docs/publish-readiness.md"));
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-checklist-ids] required doc 'docs/publish-readiness.md' is missing",
    );
  });

  it("attributes a deleted consumer contract to the consumer-surface check", () => {
    rmSync(join(fx, "docs/web-consumer.md"));
    const res = runCheck(fx, CHECK);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      "[docs-consumer-surface] required doc 'docs/web-consumer.md' is missing",
    );
  });
});
