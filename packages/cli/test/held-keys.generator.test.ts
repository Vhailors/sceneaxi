import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeSourceDigest,
  generateRegistrySnapshot,
  validateRegistrySnapshot,
  type FirstMateBacklogExport,
} from "@sceneaxi/cli";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "held-keys",
);
const loadFixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));

const epoch2Export = loadFixture(
  "firstmate-export.epoch2.json",
) as FirstMateBacklogExport;

describe("registry snapshot generator (fixture-driven)", () => {
  it("emits a schema-valid snapshot from a structured backlog export", () => {
    const generated = generateRegistrySnapshot(epoch2Export);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const snapshot = generated.value;
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.registryEpoch).toBe(2);
    expect(snapshot.generatedAt).toBe(epoch2Export.exportedAt);
    expect(snapshot.source).toBe(epoch2Export.source);
    expect(snapshot.sourceDigest).toMatch(/^sha256:[0-9a-f]{64}$/);

    // The emitted snapshot must itself pass fail-closed validation.
    const revalidated = validateRegistrySnapshot(snapshot);
    expect(revalidated.ok).toBe(true);
  });

  it("derives origin and key from FirstMate hold identities (<origin>-decision-<key>)", () => {
    const generated = generateRegistrySnapshot(epoch2Export);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const byKey = new Map(generated.value.keys.map((k) => [k.key, k]));
    expect(byKey.get("synthetic-demo-alpha")?.origin).toBe("captain");
    expect(byKey.get("synthetic-demo-alpha")?.state).toBe("resolved");
    expect(byKey.get("synthetic-demo-beta")?.origin).toBe("captain");
    expect(byKey.get("synthetic-demo-beta")?.state).toBe("open");
    expect(byKey.get("synthetic-demo-gamma")?.origin).toBe("spec");
  });

  it("emits keys in canonical (key-sorted) order so the digest is deterministic", () => {
    const generated = generateRegistrySnapshot(epoch2Export);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const keys = generated.value.keys.map((k) => k.key);
    expect(keys).toEqual([...keys].sort());
  });

  it("sourceDigest is verified: recomputable from the key set", () => {
    const generated = generateRegistrySnapshot(epoch2Export);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    expect(computeSourceDigest(generated.value.keys)).toBe(
      generated.value.sourceDigest,
    );
  });

  it("a tampered snapshot fails digest verification", () => {
    const generated = generateRegistrySnapshot(epoch2Export);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const [first, ...rest] = generated.value.keys;
    expect(first).toBeDefined();
    if (first === undefined) return;
    const tampered = {
      ...generated.value,
      keys: [{ ...first, state: "resolved" as const, resolvedAt: first.registeredAt, decisionRecord: "tampered" }, ...rest],
    };
    const validation = validateRegistrySnapshot(tampered);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errors.join("\n")).toMatch(/digest/i);
    }
  });

  it("refuses to generate from a Markdown-document source", () => {
    const markdownSource = loadFixture("firstmate-export.markdown-source.json");
    const generated = generateRegistrySnapshot(markdownSource);
    expect(generated.ok).toBe(false);
    if (!generated.ok) {
      expect(generated.errors.join("\n")).toMatch(/markdown/i);
    }
  });

  it("refuses raw Markdown text outright (never a structured export)", () => {
    const generated = generateRegistrySnapshot(
      "# Decision-key registry\n\n- widget-color: open\n",
    );
    expect(generated.ok).toBe(false);
  });

  it("refuses an export without the structured-backlog format discriminator", () => {
    const withoutFormat: Record<string, unknown> = { ...epoch2Export };
    delete withoutFormat["format"];
    expect(generateRegistrySnapshot(withoutFormat).ok).toBe(false);
    expect(
      generateRegistrySnapshot({ ...epoch2Export, format: "markdown-registry" })
        .ok,
    ).toBe(false);
  });

  it("refuses a non-monotonic registry epoch (export older than what we already saw)", () => {
    const regressed = generateRegistrySnapshot(epoch2Export, {
      previousRegistryEpoch: 3,
    });
    expect(regressed.ok).toBe(false);
    if (!regressed.ok) {
      expect(regressed.errors.join("\n")).toMatch(/monotonic|epoch/i);
    }

    // Same or newer epoch is fine (re-export of the same registry state).
    expect(
      generateRegistrySnapshot(epoch2Export, { previousRegistryEpoch: 2 }).ok,
    ).toBe(true);
  });

  it("refuses malformed hold identities", () => {
    const bad: FirstMateBacklogExport = {
      ...epoch2Export,
      holds: [
        {
          identity: "captain-hold-without-marker",
          title: "no -decision- marker",
          state: "open",
          registeredAt: "2026-07-18T09:00:00.000Z",
        },
      ],
    };
    expect(generateRegistrySnapshot(bad).ok).toBe(false);
  });

  it("refuses duplicate derived keys", () => {
    const dup: FirstMateBacklogExport = {
      ...epoch2Export,
      holds: [
        {
          identity: "captain-decision-synthetic-demo-alpha",
          title: "first",
          state: "open",
          registeredAt: "2026-07-18T09:00:00.000Z",
        },
        {
          identity: "captain-decision-synthetic-demo-alpha",
          title: "second",
          state: "open",
          registeredAt: "2026-07-18T09:00:00.000Z",
        },
      ],
    };
    expect(generateRegistrySnapshot(dup).ok).toBe(false);
  });

  it("refuses a resolved hold without resolvedAt + decisionRecord", () => {
    const bad: FirstMateBacklogExport = {
      ...epoch2Export,
      holds: [
        {
          identity: "captain-decision-synthetic-demo-alpha",
          title: "resolved but no record",
          state: "resolved",
          registeredAt: "2026-07-18T09:00:00.000Z",
        },
      ],
    };
    expect(generateRegistrySnapshot(bad).ok).toBe(false);
  });

  it("refuses epoch below 1 and non-integer epochs", () => {
    expect(
      generateRegistrySnapshot({ ...epoch2Export, registryEpoch: 0 }).ok,
    ).toBe(false);
    expect(
      generateRegistrySnapshot({ ...epoch2Export, registryEpoch: 1.5 }).ok,
    ).toBe(false);
  });

  it("enforces RFC 3339 timestamps before emitting a snapshot", () => {
    for (const exportedAt of [
      "2026-07-20T12:00:00",
      "2026-02-29T12:00:00Z",
      "2026-07-20T12:00:00+24:00",
      "2026-07-20T12:00:00Z\n",
      "2026-07-20T12:00:00Z\r",
      "2026-07-20T12:00:00Z\r\n",
    ]) {
      expect(
        generateRegistrySnapshot({ ...epoch2Export, exportedAt }).ok,
        exportedAt,
      ).toBe(false);
    }

    expect(
      generateRegistrySnapshot({
        ...epoch2Export,
        exportedAt: "2026-07-20T14:00:00+02:00",
      }).ok,
    ).toBe(true);

    expect(
      generateRegistrySnapshot({
        ...epoch2Export,
        holds: epoch2Export.holds.map((hold, index) =>
          index === 0
            ? { ...hold, registeredAt: "2026-07-18T09:00:00" }
            : hold,
        ),
      }).ok,
    ).toBe(false);
  });
});

describe("snapshot validator (fail-closed)", () => {
  it("refuses the schema-invalid fixture (missing sourceDigest)", () => {
    const invalid = loadFixture("snapshot.schema-invalid.json");
    const validation = validateRegistrySnapshot(invalid);
    expect(validation.ok).toBe(false);
  });

  it("refuses non-object inputs", () => {
    for (const value of [undefined, null, "text", 42, []]) {
      expect(validateRegistrySnapshot(value).ok, String(value)).toBe(false);
    }
  });

  it("refuses unknown extra properties (additionalProperties: false)", () => {
    const generated = generateRegistrySnapshot(epoch2Export);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const extended = { ...generated.value, vendorExtension: true };
    expect(validateRegistrySnapshot(extended).ok).toBe(false);
  });
});
