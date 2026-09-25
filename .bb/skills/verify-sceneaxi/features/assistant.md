# Fixture assistant

The local inspector can answer a prompt with recorded fixture data without a live model or credit debit.

## Sub-features

- `assistant.fixture` returns the deterministic completion.
- `assistant.hosted` stays default-off.

## How to get to it (user POV)

Local clients send `POST /api/assistant` with `prompt` and optional `mode` to the inspector's printed URL. The current inspector HTML has no assistant prompt or Send button. Embedded consumers can use `createAssistantPanel()`.

## Driving it with verify

Preconditions: root build and doctor pass.

```bash
.bb/skills/verify-sceneaxi/verify test apps/web-shell/test/bin-smoke.test.ts apps/web-shell/test/assistant-panel.test.ts
```

The binary test sends `How do I place a cube?` over a real socket. Require `fixture completion`, `mode: fixture`, `metered: false`, and `hostedEnabled: false`. The panel suite covers its named refusals. Preserve test output and exit status. An inspector screenshot does not prove this HTTP-only interaction.

## Gotchas

The fixture reply is not live-provider evidence. Do not supply credentials or enable hosted calls. A missing deployment adapter is a refusal, not a setup step this skill may bypass.
