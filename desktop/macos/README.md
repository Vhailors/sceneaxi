# SceneAxi Engine Desktop for macOS

This separate install root packages the existing application runtime from
`desktop/linux` for macOS without forking its product behavior. Release packaging
requires real Apple signing and notarization inputs and never publishes by itself.

Like `desktop/linux`, this root carries no test runner of its own: the repository gate
owns its coverage from `tests/desktop/`, so a packaging install root never grows a
second, unrun test surface.

The authoritative build, release, install, first-run, update, and fail-closed
contract is [`docs/desktop-macos.md`](../../docs/desktop-macos.md).
