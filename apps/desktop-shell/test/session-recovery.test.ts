import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ResolveApplyTransaction =
  typeof import("@sceneaxi/authoring-core").resolveApplyTransaction;
type ShellApply = typeof import("../src/protocol-client.js").shellApply;

const mocks = vi.hoisted(() => ({
  resolveApplyTransaction: vi.fn<ResolveApplyTransaction>(),
  shellApply: vi.fn<ShellApply>(),
}));

vi.mock("@sceneaxi/authoring-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@sceneaxi/authoring-core")>();
  return {
    ...actual,
    resolveApplyTransaction: mocks.resolveApplyTransaction,
  };
});

vi.mock("../src/protocol-client.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/protocol-client.js")>();
  return { ...actual, shellApply: mocks.shellApply };
});

import {
  createDocument,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import { createDesktopSession } from "../src/session.js";

describe("desktop recovery state", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-recovery-"));
    const written = writeDocumentFile(
      join(cwd, "scene.json"),
      createDocument({ id: "scene", data: { x: 1 } }),
      { cwd },
    );
    expect(written.ok).toBe(true);
    mocks.shellApply.mockReturnValue({
      ok: false,
      applicationState: "indeterminate",
      journalRecoveryPending: true,
      transactionId: "0000000000000-0000000000000000",
      diagnostics: [
        {
          code: "apply-in-progress",
          message: "Apply recovery is pending.",
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(cwd, { recursive: true, force: true });
  });

  it.each(["aborted", "undone"] as const)(
    "preserves the proposal after a %s transaction",
    (state) => {
      mocks.resolveApplyTransaction.mockReturnValue({
        ok: true,
        transactionId: "0000000000000-0000000000000000",
        state,
        documentPaths: ["scene.json"],
      });
      const session = createDesktopSession({ cwd });
      const proposed = session.proposeEdit({
        documentPath: "scene.json",
        jsonPointer: "/data/x",
        newValue: 2,
        cwd,
      });
      expect(proposed.phase).toBe("reviewing");
      expect(proposed.proposal).not.toBeNull();

      expect(session.accept().phase).toBe("pending");
      const recovered = session.refreshRecovery();

      expect(recovered.phase).toBe("reviewing");
      expect(recovered.proposal).toEqual(proposed.proposal);
      expect(recovered.unifiedDiff).toBe(proposed.unifiedDiff);
      expect(recovered.journalRecoveryPending).toBe(false);
      expect(recovered.transactionId).toBeNull();
      expect(recovered.diagnostics?.[0]?.code).toBe("journal-conflict");
    },
  );
});
