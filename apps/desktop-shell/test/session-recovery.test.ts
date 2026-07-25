import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ResolveApplyTransaction =
  typeof import("@sceneaxi/authoring-core").resolveApplyTransaction;
type ShellApply = typeof import("@sceneaxi/desktop-shell").shellApply;

import {
  createDocument,
  writeDocumentFile,
} from "@sceneaxi/authoring-core";
import { createDesktopSession } from "@sceneaxi/desktop-shell";

describe("desktop recovery state", () => {
  let cwd: string;
  let resolveTransaction: ReturnType<
    typeof vi.fn<ResolveApplyTransaction>
  >;
  let applyProposal: ReturnType<typeof vi.fn<ShellApply>>;

  beforeEach(() => {
    resolveTransaction = vi.fn<ResolveApplyTransaction>();
    applyProposal = vi.fn<ShellApply>();
    cwd = mkdtempSync(join(tmpdir(), "sceneaxi-desktop-recovery-"));
    const written = writeDocumentFile(
      join(cwd, "scene.json"),
      createDocument({ id: "scene", data: { x: 1 } }),
      { cwd },
    );
    expect(written.ok).toBe(true);
    applyProposal.mockReturnValue({
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
    rmSync(cwd, { recursive: true, force: true });
  });

  it.each(["aborted", "undone"] as const)(
    "preserves the proposal after a %s transaction",
    (state) => {
      resolveTransaction.mockReturnValue({
        ok: true,
        transactionId: "0000000000000-0000000000000000",
        state,
        documentPaths: ["scene.json"],
      });
      const session = createDesktopSession({
        cwd,
        operations: { applyProposal, resolveTransaction },
      });
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
