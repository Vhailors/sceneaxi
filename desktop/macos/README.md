# SceneAxi Engine Desktop for macOS

This separate install root packages the existing application runtime from
`desktop/linux` for macOS without forking its product behavior. Release packaging
requires real Apple signing and notarization inputs and never publishes by itself.

Like `desktop/linux`, this root carries no test runner dependency of its own. Its
public-name seam test lives in `test/seam.test.ts` and runs in the repository gate;
cross-tier packaging coverage stays in `tests/desktop/`.

The authoritative build, release, install, first-run, update, and fail-closed
contract is [`docs/desktop-macos.md`](../../docs/desktop-macos.md).
