import {
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExitCode, runCli } from "@sceneaxi/cli";
import { reconstructSculpt } from "@sceneaxi/authoring-core";

/**
 * `scene compose` (sceneaxi#115) — the CLI face of the deterministic multi-object
 * composition landed in #113. Artifacts come from the checked-in sculpt-quality
 * intakes at their landed seeds, so this exercise is offline end to end.
 */
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SCENE_INTAKE = join(
  REPO_ROOT,
  "tests/e2e/fixtures/scene-composition/workshop-bay.scene.json",
);
const SOURCES = [
  { path: "tests/e2e/fixtures/sculpt-quality/hard-surface-service-crate.intake.json", seed: 8001 },
  { path: "tests/e2e/fixtures/sculpt-quality/richer-field-drone.intake.json", seed: 8002 },
] as const;

function writeArtifacts(cwd: string): string[] {
  return SOURCES.map((source, index) => {
    const intake = JSON.parse(
      readFileSync(join(REPO_ROOT, source.path), "utf8"),
    ) as unknown;
    const reconstruction = reconstructSculpt(intake, { seed: source.seed });
    if (!reconstruction.ok) {
      throw new Error(`fixture reconstruction failed: ${reconstruction.message}`);
    }
    const name = `artifact-${String(index)}.json`;
    writeFileSync(
      join(cwd, name),
      `${JSON.stringify(reconstruction.artifact, null, 2)}\n`,
      "utf8",
    );
    return name;
  });
}

describe("scene compose", () => {
  let cwd: string;
  let artifacts: string[];

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-cli-scene-"));
    artifacts = writeArtifacts(cwd);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const compose = (extra: string[] = []) =>
    runCli([
      "scene",
      "compose",
      "--intake",
      SCENE_INTAKE,
      ...artifacts.flatMap((name) => ["--artifact", name]),
      "--cwd",
      cwd,
      ...extra,
    ]);

  it("composes a multi-object scene from repeated --artifact flags", () => {
    const r = compose();
    expect(r.exitCode).toBe(ExitCode.OK);
    expect(r.envelope.ok).toBe(true);
    if (!r.envelope.ok) return;

    expect(r.envelope.result["status"]).toBe("composed");
    expect(r.envelope.result["sceneId"]).toBe("workshop-bay");
    expect(r.envelope.result["artifactCount"]).toBe(2);
    expect(r.envelope.result["instanceCount"]).toBe(3);
    expect(r.envelope.result["instanceIds"]).toEqual([
      "bay-service-crate",
      "bay-stacked-crate",
      "bay-field-drone",
    ]);
    expect(r.envelope.result["sceneDigest"]).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is deterministic — the same inputs always yield the same digest and bytes", () => {
    const first = compose(["--out-scene", "a.scene.json"]);
    const second = compose(["--out-scene", "b.scene.json"]);
    expect(first.exitCode).toBe(ExitCode.OK);
    expect(second.exitCode).toBe(ExitCode.OK);
    if (first.envelope.ok && second.envelope.ok) {
      expect(second.envelope.result["sceneDigest"]).toBe(
        first.envelope.result["sceneDigest"],
      );
    }
    expect(readFileSync(join(cwd, "a.scene.json"), "utf8")).toBe(
      readFileSync(join(cwd, "b.scene.json"), "utf8"),
    );
  });

  it("writes the composed scene and the projected document on request", () => {
    const r = compose([
      "--out-scene",
      "scene.json",
      "--out-document",
      "scene.document.json",
      "--document-id",
      "workshop-bay-scene",
      "--title",
      "Workshop bay",
    ]);
    expect(r.exitCode).toBe(ExitCode.OK);
    if (r.envelope.ok) {
      expect(r.envelope.result["writtenPaths"]).toEqual([
        "scene.json",
        "scene.document.json",
      ]);
      expect(r.envelope.result["documentId"]).toBe("workshop-bay-scene");
    }

    const document = JSON.parse(
      readFileSync(join(cwd, "scene.document.json"), "utf8"),
    ) as { kind: string; id: string; title?: string };
    expect(document.kind).toBe("sceneaxi.document");
    expect(document.id).toBe("workshop-bay-scene");
    expect(document.title).toBe("Workshop bay");
  });

  it("does not commit either output when staging one output fails", () => {
    writeFileSync(join(cwd, "blocked"), "not a directory", "utf8");
    const r = compose([
      "--out-scene",
      "scene.json",
      "--out-document",
      "blocked/scene.document.json",
    ]);
    expect(r.exitCode).toBe(ExitCode.ERROR);
    expect(() => readFileSync(join(cwd, "scene.json"), "utf8")).toThrow();
  });

  it("never rewrites a source artifact", () => {
    const before = artifacts.map((name) =>
      readFileSync(join(cwd, name), "utf8"),
    );
    expect(compose(["--out-scene", "scene.json"]).exitCode).toBe(ExitCode.OK);
    const after = artifacts.map((name) => readFileSync(join(cwd, name), "utf8"));
    expect(after).toEqual(before);
  });

  it("refuses direct and symlink output aliases of source artifacts", () => {
    const artifact = artifacts[0] as string;
    const before = readFileSync(join(cwd, artifact), "utf8");

    const direct = compose(["--out-scene", artifact]);
    expect(direct.exitCode).toBe(ExitCode.ERROR);
    if (!direct.envelope.ok) {
      expect(direct.envelope.error.code).toBe("CONFLICT");
    }
    expect(readFileSync(join(cwd, artifact), "utf8")).toBe(before);

    symlinkSync(artifact, join(cwd, "artifact-alias.json"));
    const alias = compose(["--out-document", "artifact-alias.json"]);
    expect(alias.exitCode).toBe(ExitCode.ERROR);
    if (!alias.envelope.ok) {
      expect(alias.envelope.error.code).toBe("CONFLICT");
    }
    expect(readFileSync(join(cwd, artifact), "utf8")).toBe(before);
  });

  it("maps a malformed intake onto a named refusal (USAGE)", () => {
    writeFileSync(join(cwd, "bad.scene.json"), '{"schemaVersion":1}\n', "utf8");
    const r = runCli([
      "scene",
      "compose",
      "--intake",
      "bad.scene.json",
      ...artifacts.flatMap((name) => ["--artifact", name]),
      "--cwd",
      cwd,
    ]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("VALIDATION");
      expect(r.envelope.error.message).toContain("Scene composition refused");
    }
  });

  it("refuses a structural violation from the named refuse matrix (ERROR)", () => {
    // Drop one artifact: the intake still references it, so composition refuses
    // with unknown-artifact-reference rather than composing a partial scene.
    const r = runCli([
      "scene",
      "compose",
      "--intake",
      SCENE_INTAKE,
      "--artifact",
      artifacts[0] as string,
      "--cwd",
      cwd,
    ]);
    expect(r.exitCode).toBe(ExitCode.ERROR);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("INTERNAL");
      expect(r.envelope.error.message).toMatch(
        /unknown-artifact-reference|unplaced-artifact/,
      );
    }
  });

  it("refuses missing --intake and missing --artifact", () => {
    expect(
      runCli(["scene", "compose", "--cwd", cwd]).exitCode,
    ).toBe(ExitCode.USAGE);
    expect(
      runCli(["scene", "compose", "--intake", SCENE_INTAKE, "--cwd", cwd])
        .exitCode,
    ).toBe(ExitCode.USAGE);
  });

  it("refuses a missing artifact file with NOT_FOUND", () => {
    const r = runCli([
      "scene",
      "compose",
      "--intake",
      SCENE_INTAKE,
      "--artifact",
      "absent.json",
      "--cwd",
      cwd,
    ]);
    expect(r.exitCode).toBe(ExitCode.ERROR);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("NOT_FOUND");
    }
  });
});
