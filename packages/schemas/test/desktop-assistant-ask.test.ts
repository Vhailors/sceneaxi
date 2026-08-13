import { describe, expect, it } from "vitest";
import {
  ASSISTANT_ASK_REFUSALS,
  answerAssistantAsk,
  applyAssistantBuildEntry,
  emptySceneAssistantBuildCatalog,
  isFixtureProviderDescriptor,
} from "@sceneaxi/schemas";

const hash = `sha256:${"ab".repeat(32)}`;
const state = Object.freeze({
  instanceIds: Object.freeze(["desktop-crate-beside"]),
  assetIds: Object.freeze(["tex-crate"]),
  clipIds: Object.freeze(["idle"]),
  bodyIds: Object.freeze(["falling"]),
  playActive: false,
});

describe("assistant ask", () => {
  it("answers list and count questions from the named scope only", () => {
    const listed = answerAssistantAsk({
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
      sourceContentHash: hash,
      profile: "@sceneaxi/profile-game",
      state,
    });
    const counted = answerAssistantAsk({
      prompt: "How many bodies are authored?",
      scope: "physics",
      sourceContentHash: hash,
      profile: "@sceneaxi/profile-web",
      state,
    });
    expect(listed).toMatchObject({
      ok: true,
      answer: {
        kind: "sceneaxi.assistant-ask-answer",
        savedBytesWritten: false,
        providerClass: "none",
        answer: "instances in this hierarchy scope: desktop-crate-beside.",
      },
    });
    expect(counted).toMatchObject({
      ok: true,
      answer: { answer: "There are 1 bodies." },
    });
    if (!listed.ok || !counted.ok) throw new Error("expected answers");
    expect(answerAssistantAsk({
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
      sourceContentHash: hash,
      profile: "@sceneaxi/profile-game",
      state,
    })).toEqual(listed);
  });

  it("refuses Kids, unsupported scopes, and questions that would require a fake answer", () => {
    expect(answerAssistantAsk({
      prompt: "What instances are in the hierarchy?",
      scope: "hierarchy",
      sourceContentHash: hash,
      profile: "@sceneaxi/profile-kids",
      state,
    })).toMatchObject({ ok: false, reason: ASSISTANT_ASK_REFUSALS.kidsDenied });
    expect(answerAssistantAsk({
      prompt: "What instances are in the hierarchy?",
      scope: "materials",
      sourceContentHash: hash,
      profile: "@sceneaxi/profile-game",
      state,
    })).toMatchObject({ ok: false, reason: ASSISTANT_ASK_REFUSALS.scopeUnsupported });
    expect(answerAssistantAsk({
      prompt: "Write a marketing slogan for this crate",
      scope: "hierarchy",
      sourceContentHash: hash,
      profile: "@sceneaxi/profile-game",
      state,
    })).toMatchObject({ ok: false, reason: ASSISTANT_ASK_REFUSALS.questionUnsupported });
  });

  it("labels the rarity fixture so it cannot stand in for a configured cloud provider", () => {
    expect(isFixtureProviderDescriptor({
      model: "wayfinder-rarity-fixture",
      provider: "sceneaxi-fixture",
    })).toBe(true);
    expect(isFixtureProviderDescriptor({
      model: "openai/desktop-fixture-2026-08-08",
      provider: "openrouter",
    })).toBe(false);
    const catalog = applyAssistantBuildEntry({
      catalog: emptySceneAssistantBuildCatalog(),
      entry: {
        buildId: "build-1",
        artifactDigest: `sha256:${"cd".repeat(32)}`,
        providerClass: "configured",
        model: "openai/desktop-fixture-2026-08-08",
        provider: "openrouter",
        version: "2026-08-08",
        fallbackPolicy: "none",
      },
    });
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.entries[0]?.fallbackPolicy).toBe("none");
  });
});
