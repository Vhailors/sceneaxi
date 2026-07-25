import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExitCode, runCli } from "@sceneaxi/cli";
import {
  createCatalogItemAtIntake,
  profileConformanceRegistry,
} from "@sceneaxi/schemas";

/**
 * Read-only listing verbs (sceneaxi#115). None of these can mutate state, and
 * `catalog list` in particular reports commerce activation without ever
 * changing it — the marketplace holds stay untouched.
 */
function fixtureItem(itemId: string) {
  return createCatalogItemAtIntake({
    itemId,
    assetPackage: {
      packageId: `${itemId}-pkg`,
      contentHash: `sha256:${"0".repeat(64)}`,
    },
    rights: {
      license: "CC-BY-4.0",
      rightsHolder: "Fixture Author",
      commercialUseAllowed: false,
    },
    provenance: {
      origin: "fixture",
      ingestedAt: "2026-01-01T00:00:00.000Z",
      sourceDigest: `sha256:${"1".repeat(64)}`,
    },
    aiGenerationDisclosure: {
      aiGenerated: false,
      disclosureText: "Authored by hand for tests.",
    },
    compatibility: {
      profiles: ["game"],
      coreRange: "^0.0.0",
    },
  });
}

describe("profile list", () => {
  it("lists the versioned Profile Conformance registry", () => {
    const r = runCli(["profile", "list"]);
    expect(r.exitCode).toBe(ExitCode.OK);
    if (!r.envelope.ok) return;

    expect(r.envelope.result["profileCount"]).toBe(
      profileConformanceRegistry.length,
    );
    expect(r.envelope.result["profiles"]).toEqual(
      profileConformanceRegistry.map((entry) => ({
        profile: entry.profile,
        claimStatus: entry.claimStatus,
        shippingClaim: entry.shippingClaim,
      })),
    );
  });

  it("never reports a shipping claim", () => {
    const r = runCli(["profile", "list"]);
    expect(r.envelope.ok).toBe(true);
    if (!r.envelope.ok) return;
    const profiles = r.envelope.result["profiles"] as ReadonlyArray<{
      shippingClaim: boolean;
    }>;
    expect(profiles.length).toBeGreaterThan(0);
    for (const profile of profiles) {
      expect(profile.shippingClaim).toBe(false);
    }
  });

  it("takes no flags", () => {
    const r = runCli(["profile", "list", "--dir", "somewhere"]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("UNKNOWN_FLAG");
    }
  });
});

describe("catalog list / asset list", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-cli-catalog-"));
    for (const itemId of ["beta-item", "alpha-item"]) {
      writeFileSync(
        join(cwd, `${itemId}.catalog-item.json`),
        `${JSON.stringify(fixtureItem(itemId), null, 2)}\n`,
        "utf8",
      );
    }
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("lists catalog items in stable filename order with pipeline state", () => {
    const r = runCli(["catalog", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.OK);
    if (!r.envelope.ok) return;

    expect(r.envelope.result["itemCount"]).toBe(2);
    const items = r.envelope.result["items"] as ReadonlyArray<{
      file: string;
      itemId: string;
      pipelineState: string;
      metadataComplete: boolean;
    }>;
    expect(items.map((i) => i.file)).toEqual([
      "alpha-item.catalog-item.json",
      "beta-item.catalog-item.json",
    ]);
    expect(items.map((i) => i.pipelineState)).toEqual(["intake", "intake"]);
    expect(items.map((i) => i.metadataComplete)).toEqual([true, true]);
    expect(items.every((i) => !Object.hasOwn(i, "listable"))).toBe(true);
  });

  it("reports commerce as inert and never activates it", () => {
    const r = runCli(["catalog", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.envelope.ok).toBe(true);
    if (!r.envelope.ok) return;

    expect(r.envelope.result["commerceActivation"]).toBe("inert");
    const items = r.envelope.result["items"] as ReadonlyArray<{
      commerceActive: boolean;
    }>;
    for (const item of items) {
      expect(item.commerceActive).toBe(false);
    }
  });

  it("refuses a malformed catalog item rather than half-reading it", () => {
    writeFileSync(
      join(cwd, "broken.catalog-item.json"),
      '{"itemId":"broken"}\n',
      "utf8",
    );
    const r = runCli(["catalog", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("VALIDATION");
    }
  });

  it("validates the complete catalog contract before listing", () => {
    writeFileSync(
      join(cwd, "forged.catalog-item.json"),
      `${JSON.stringify(
        {
          ...fixtureItem("forged"),
          moderation: { pipelineState: "approved", history: [] },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const r = runCli(["catalog", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("VALIDATION");
    }
  });

  it("lists Asset Package refs declared by those catalog items", () => {
    const r = runCli(["asset", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.OK);
    if (!r.envelope.ok) return;

    expect(r.envelope.result["assetCount"]).toBe(2);
    const assets = r.envelope.result["assets"] as ReadonlyArray<{
      itemId: string;
      packageId: string;
    }>;
    expect(assets.map((a) => a.packageId)).toEqual([
      "alpha-item-pkg",
      "beta-item-pkg",
    ]);
  });

  it("refuses a missing directory with NOT_FOUND", () => {
    const r = runCli(["catalog", "list", "--dir", "absent", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.ERROR);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns an empty listing for a directory with no catalog items", () => {
    const empty = mkdtempSync(join(tmpdir(), "sceneaxi-cli-empty-"));
    try {
      const r = runCli(["catalog", "list", "--dir", ".", "--cwd", empty]);
      expect(r.exitCode).toBe(ExitCode.OK);
      if (r.envelope.ok) {
        expect(r.envelope.result["itemCount"]).toBe(0);
      }
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("evidence list", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-cli-evidence-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("lists packets written by project capture", () => {
    for (const name of ["two", "one"]) {
      expect(
        runCli([
          "project",
          "new",
          "--document",
          `${name}.json`,
          "--cwd",
          cwd,
        ]).exitCode,
      ).toBe(ExitCode.OK);
      expect(
        runCli([
          "project",
          "capture",
          "--document",
          `${name}.json`,
          "--out",
          `${name}.evidence.json`,
          "--cwd",
          cwd,
        ]).exitCode,
      ).toBe(ExitCode.OK);
    }

    const r = runCli(["evidence", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.OK);
    if (!r.envelope.ok) return;

    expect(r.envelope.result["packetCount"]).toBe(2);
    const packets = r.envelope.result["packets"] as ReadonlyArray<{
      file: string;
      documentId: string;
      refusedCount: number;
    }>;
    expect(packets.map((p) => p.file)).toEqual([
      "one.evidence.json",
      "two.evidence.json",
    ]);
    expect(packets.map((p) => p.documentId)).toEqual(["one", "two"]);
    expect(packets.every((p) => p.refusedCount === 0)).toBe(true);
  });

  it("refuses a file that is not an evidence packet", () => {
    writeFileSync(
      join(cwd, "impostor.evidence.json"),
      `${JSON.stringify(
        { schemaVersion: 1, kind: "sceneaxi.document", id: "x", data: {} },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const r = runCli(["evidence", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("VALIDATION");
    }
  });

  it("refuses a valid packet inside a malformed document carrier", () => {
    expect(
      runCli([
        "project",
        "new",
        "--document",
        "scene.json",
        "--cwd",
        cwd,
      ]).exitCode,
    ).toBe(ExitCode.OK);
    expect(
      runCli([
        "project",
        "capture",
        "--document",
        "scene.json",
        "--out",
        "valid.evidence.json",
        "--cwd",
        cwd,
      ]).exitCode,
    ).toBe(ExitCode.OK);
    const valid = JSON.parse(
      readFileSync(join(cwd, "valid.evidence.json"), "utf8"),
    ) as { data: unknown };
    writeFileSync(
      join(cwd, "malformed.evidence.json"),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          kind: "sceneaxi.document",
          id: "malformed",
          data: valid.data,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const r = runCli(["evidence", "list", "--dir", ".", "--cwd", cwd]);
    expect(r.exitCode).toBe(ExitCode.USAGE);
    if (!r.envelope.ok) {
      expect(r.envelope.error.code).toBe("VALIDATION");
    }
  });
});
