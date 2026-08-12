import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PROJECT_MIGRATION_EVIDENCE_PATH,
  PROJECT_MIGRATION_JOURNAL_PATH,
  PROJECT_MIGRATION_PROPOSAL_PATH,
  acquireAtomicWriteLocks,
  commitProjectMigration,
  inspectProjectModel,
  proposeProjectMigration,
  recoverProjectMigration,
  releaseAtomicWriteLocks,
  serializeDocument,
} from "@sceneaxi/authoring-core";
import {
  PROJECT_MANIFEST_DIAGNOSTICS,
  PROJECT_MANIFEST_PATH,
  createDocument,
  createProjectManifest,
  serializeProjectManifest,
} from "@sceneaxi/schemas";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function temporary(label: string) {
  const root = mkdtempSync(join(tmpdir(), `sceneaxi-project-model-${label}-`));
  roots.push(root);
  return root;
}

function legacyProject(label: string) {
  const root = temporary(label);
  const bytes = serializeDocument(createDocument({
    id: "portable-world",
    title: "Portable world",
    data: { entities: [{ id: "hero" }] },
  }));
  writeFileSync(join(root, "scene.json"), bytes, "utf8");
  return { root, bytes };
}

describe("native project migration host", () => {
  it("opens and proposes over legacy bytes without rewriting them", () => {
    const project = legacyProject("preserve");
    const inspected = inspectProjectModel(project.root);
    expect(inspected).toMatchObject({
      ok: true,
      inspection: { state: "legacy", migration: { required: true } },
    });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);

    const proposed = proposeProjectMigration(project.root);
    expect(proposed).toMatchObject({ ok: true, replayed: false });
    expect(readFileSync(join(project.root, "scene.json"), "utf8")).toBe(project.bytes);
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);
    expect(proposeProjectMigration(project.root)).toMatchObject({
      ok: true,
      replayed: true,
      proposal: { proposalDigest: proposed.ok ? proposed.proposal.proposalDigest : "" },
    });
  });

  it("commits and recovers byte-identical manifests and evidence across roots", () => {
    const first = legacyProject("first");
    const second = legacyProject("second");
    const firstProposal = proposeProjectMigration(first.root);
    const secondProposal = proposeProjectMigration(second.root);
    if (!firstProposal.ok || !secondProposal.ok) throw new Error("proposal refused");
    expect(secondProposal.proposal).toEqual(firstProposal.proposal);
    expect(readFileSync(join(first.root, PROJECT_MIGRATION_PROPOSAL_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MIGRATION_PROPOSAL_PATH), "utf8"),
    );

    expect(commitProjectMigration({
      root: first.root,
      approved: false,
      proposalDigest: firstProposal.proposal.proposalDigest,
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.approvalRequired },
    });
    const firstCommit = commitProjectMigration({
      root: first.root,
      approved: true,
      proposalDigest: firstProposal.proposal.proposalDigest,
    });
    const secondCommit = commitProjectMigration({
      root: second.root,
      approved: true,
      proposalDigest: secondProposal.proposal.proposalDigest,
    });
    expect(firstCommit).toMatchObject({ ok: true, inspection: { state: "native" } });
    expect(secondCommit).toMatchObject({ ok: true, inspection: { state: "native" } });
    expect(readFileSync(join(first.root, PROJECT_MANIFEST_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MANIFEST_PATH), "utf8"),
    );
    expect(readFileSync(join(first.root, PROJECT_MIGRATION_EVIDENCE_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MIGRATION_EVIDENCE_PATH), "utf8"),
    );
    expect(readFileSync(join(first.root, "scene.json"), "utf8")).toBe(first.bytes);

    const journalPath = join(first.root, PROJECT_MIGRATION_JOURNAL_PATH);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<string, unknown>;
    writeFileSync(journalPath, `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`, "utf8");
    rmSync(join(first.root, PROJECT_MANIFEST_PATH));
    rmSync(join(first.root, PROJECT_MIGRATION_EVIDENCE_PATH));
    const recovered = recoverProjectMigration(first.root);
    expect(recovered).toMatchObject({ ok: true, recovered: true, evidence: firstCommit.ok ? firstCommit.evidence : {} });
    expect(readFileSync(join(first.root, PROJECT_MANIFEST_PATH), "utf8")).toBe(
      readFileSync(join(second.root, PROJECT_MANIFEST_PATH), "utf8"),
    );
  });

  it("serializes migration commit and recovery through the authoring operation authority", () => {
    const project = legacyProject("operation-authority");
    const proposed = proposeProjectMigration(project.root);
    if (!proposed.ok) throw new Error("proposal refused");
    const operationLock = acquireAtomicWriteLocks([
      join(project.root, ".sceneaxi-authoring-operation"),
    ]);
    try {
      expect(commitProjectMigration({
        root: project.root,
        approved: true,
        proposalDigest: proposed.proposal.proposalDigest,
      })).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict },
      });
      expect(existsSync(join(project.root, PROJECT_MIGRATION_JOURNAL_PATH))).toBe(false);
    } finally {
      releaseAtomicWriteLocks(operationLock);
    }

    expect(commitProjectMigration({
      root: project.root,
      approved: true,
      proposalDigest: proposed.proposal.proposalDigest,
    })).toMatchObject({ ok: true });
    const journalPath = join(project.root, PROJECT_MIGRATION_JOURNAL_PATH);
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as Record<string, unknown>;
    writeFileSync(journalPath, `${JSON.stringify({ ...journal, state: "prepared" }, null, 2)}\n`);
    rmSync(join(project.root, PROJECT_MANIFEST_PATH));
    rmSync(join(project.root, PROJECT_MIGRATION_EVIDENCE_PATH));

    const recoveryLock = acquireAtomicWriteLocks([
      join(project.root, ".sceneaxi-authoring-operation"),
    ]);
    try {
      expect(recoverProjectMigration(project.root)).toMatchObject({
        ok: false,
        diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.mutationConflict },
      });
      expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);
    } finally {
      releaseAtomicWriteLocks(recoveryLock);
    }
    expect(recoverProjectMigration(project.root)).toMatchObject({ ok: true, recovered: true });
  });

  it("refuses source changes and canonical asset escapes before manifest mutation", () => {
    const project = legacyProject("changed");
    const proposed = proposeProjectMigration(project.root);
    if (!proposed.ok) throw new Error("proposal refused");
    writeFileSync(join(project.root, "scene.json"), project.bytes.replace("Portable world", "Changed world"), "utf8");
    expect(commitProjectMigration({
      root: project.root,
      approved: true,
      proposalDigest: proposed.proposal.proposalDigest,
    })).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.sourceChanged },
    });
    expect(existsSync(join(project.root, PROJECT_MANIFEST_PATH))).toBe(false);

    const escaped = legacyProject("escape");
    const outside = temporary("outside");
    writeFileSync(join(outside, "crate.glb"), "outside", "utf8");
    mkdirSync(join(escaped.root, "assets"));
    symlinkSync(join(outside, "crate.glb"), join(escaped.root, "assets", "crate.glb"));
    const document = createDocument({ id: "portable-world" });
    writeFileSync(join(escaped.root, "scene.json"), serializeDocument(document), "utf8");
    const manifest = createProjectManifest({
      document,
      assets: [{
        sourceId: "crate",
        path: "assets/crate.glb",
        mediaType: "model/gltf-binary",
        digest: `sha256:${"a".repeat(64)}`,
      }],
    });
    writeFileSync(join(escaped.root, PROJECT_MANIFEST_PATH), serializeProjectManifest(manifest), "utf8");
    expect(inspectProjectModel(escaped.root)).toMatchObject({
      ok: false,
      diagnostic: { code: PROJECT_MANIFEST_DIAGNOSTICS.canonicalPathEscape },
    });
  });
});
