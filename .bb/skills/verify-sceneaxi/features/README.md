# SceneAxi verification map

Build and run doctor with [the skill](../SKILL.md) first. Each recipe selects existing tests rather than another test implementation.

| Feature | Entry points and proof |
| --- | --- |
| [Document edits](documents.md) | CLI, desktop command and web inspector propose/apply; bytes and hashes agree. |
| [Fixture assistant](assistant.md) | Inspector HTTP assistant route and embedded panel API; fixture reply without metering. |
| [Profile policy](profiles.md) | CLI and desktop open-path commands plus web-shell public view; Game/Web parity and Kids refusal. |
| [Three viewport](three-viewport.md) | Browser `/open` canvas, orbit, mount, reset, idle pacing, screenshots and timing samples. |

This is a seed map, not complete product coverage. For packaged desktop, sites, engine playback, importers, plugins or billing changes, start at [runnable surfaces](../../../../docs/runnable-surfaces.md) and its owning test/doc. Add the changed user entry points here. Headless tests do not prove WebGL pixels, native dialogs, hosted sign-in or deployment.

Use separate scratch projects and OS-assigned ports for parallel inspectors. Keep evidence outside scratch state. Record feature ID, entry point, command, exit status and observed outcome. A failure or unavailable browser is a reported gap, never a pass through a different path.
