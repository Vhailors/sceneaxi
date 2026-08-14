import { describe, expect, it } from "vitest";
import {
  DESKTOP_DEEPSEEK_MODEL,
  DESKTOP_OPENCODE_API_BASE,
  createDesktopOpenCodeLiveTransport,
  extractCompletionJsonDocument,
} from "../../desktop/linux/src/electron/live-transport.ts";
import { DESKTOP_BYO_CONFIGURATION_REFUSALS } from "../../desktop/linux/src/index.ts";

describe("desktop OpenCode DeepSeek transport", () => {
  it("unwraps a fenced JSON completion and refuses the PRC endpoint", async () => {
    expect(extractCompletionJsonDocument('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
    expect(extractCompletionJsonDocument('  {"ok":true}  ')).toBe('{"ok":true}');

    const refused = createDesktopOpenCodeLiveTransport({
      credential: { read: () => "synthetic-opencode-key" },
      apiBase: "https://api.deepseek.com/v1",
    });
    await expect(refused.complete("prompt", DESKTOP_DEEPSEEK_MODEL)).rejects.toMatchObject({
      reason: DESKTOP_BYO_CONFIGURATION_REFUSALS.providerSessionFailed,
      message: expect.stringMatching(/PRC endpoint/i),
    });
  });

  it("posts a pinned DeepSeek complete-only request to the named OpenCode host", async () => {
    const calls: Array<{
      url: string;
      body: unknown;
      authorization: string;
      userAgent: string;
    }> = [];
    const transport = createDesktopOpenCodeLiveTransport({
      credential: { read: () => "synthetic-opencode-key" },
      fetchImpl: (async (url, init) => {
        const headers = init?.headers as { authorization?: string; "user-agent"?: string };
        calls.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          authorization: String(headers.authorization),
          userAgent: String(headers["user-agent"]),
        });
        return new Response(JSON.stringify({
          choices: [{ message: { content: "```json\n{\"kind\":\"sceneaxi.sculpt-intake\"}\n```" } }],
        }), { status: 200 });
      }) as typeof fetch,
    });

    await expect(transport.complete("Make an archer shooting to the tree", DESKTOP_DEEPSEEK_MODEL))
      .resolves.toBe('{"kind":"sceneaxi.sculpt-intake"}');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${DESKTOP_OPENCODE_API_BASE}/chat/completions`);
    expect(calls[0]?.url).toContain("opencode.ai");
    expect(calls[0]?.url).not.toContain("deepseek.com");
    expect(calls[0]?.authorization).toBe("Bearer synthetic-opencode-key");
    expect(calls[0]?.userAgent).toContain("SceneAxi-Desktop");
    expect(calls[0]?.body).toMatchObject({
      model: DESKTOP_DEEPSEEK_MODEL.model,
      temperature: 0,
    });
  });
});
