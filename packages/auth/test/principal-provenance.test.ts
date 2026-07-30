import { describe, expect, it } from "vitest";
import {
  digestSessionToken,
  hasPrincipalProvenance,
} from "@sceneaxi/auth";
import { issuePrincipalForTest } from "@sceneaxi/auth/testing/principal-issuance";

const fixture = () => ({
  user: {
    schemaVersion: 1,
    kind: "sceneaxi.user",
    userId: "usr_crew",
    email: "crew@example.com",
    emailVerified: true,
    disabled: false,
    createdAt: "2026-07-25T09:00:00Z",
  },
  role: {
    schemaVersion: 1,
    kind: "sceneaxi.role-assignment",
    userId: "usr_crew",
    role: "user",
    source: "default-user",
    assignedAt: "2026-07-25T09:30:00Z",
  },
  session: {
    schemaVersion: 1,
    kind: "sceneaxi.session",
    sessionId: "ses_crew",
    userId: "usr_crew",
    surface: "web-shell",
    issuedAt: "2026-07-25T09:00:00Z",
    expiresAt: "2026-07-26T10:00:00Z",
    tokenDigest: digestSessionToken("tok"),
  },
});

describe("principal provenance fixture seam", () => {
  it("issues the validated fixture object and no structural look-alike", () => {
    const literal = fixture();
    const issued = issuePrincipalForTest(literal);

    expect(hasPrincipalProvenance(literal)).toBe(false);
    expect(hasPrincipalProvenance(issued)).toBe(true);
    expect(hasPrincipalProvenance({ ...issued })).toBe(false);
  });
});
