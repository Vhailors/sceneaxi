# Profile open-path policy

Users can inspect which demo operations Game, Web and Kids permit. Policy inspection does not open a kernel session.

## Sub-features

- `profiles.parity` returns one shared policy across clients.
- `profiles.kids` refuses the shared engine open path.

## How to get to it (user POV)

Use CLI `profile open-path` or desktop `open-path`. Embedded web-shell consumers call `createOpenPathView()`; the inspector page does not render that view. Desktop chrome also projects the policy through its profile switch.

## Driving it with verify

Preconditions: root build and doctor pass.

```bash
.bb/skills/verify-sceneaxi/verify test tests/parity/open-path-policy-parity.test.ts tests/e2e/profile-kids-refuse-golden.test.ts
```

Require parity across the CLI, desktop shell and web-shell public API. The Kids golden must retain the named refusal and no open operation. These tests prove policy data and refusals, not a click through the desktop profile switch or a rendered viewport.

## Gotchas

Kids' isolated site activity is separate from the refused shared engine path. Never interpret policy output as a shipping claim. For actual playback or profile-switch UI changes, use the owning tests and browser proof in the runnable-surfaces document.
