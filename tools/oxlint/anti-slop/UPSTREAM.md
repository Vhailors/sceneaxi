# Vendored anti-slop rules

Source: https://github.com/dmmulroy/anti-slop at `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b` (`skills/install-anti-slop/assets/anti-slop`).
Installed at `tools/oxlint/anti-slop/` with the bundled rule files, tests, and `vendor/eslint-stylistic/LICENSE` unchanged.

Local configuration: `.oxlintrc.json` enables all generic rules and native `oxc/no-accumulating-spread`. The optional Effect rules are not enabled because the repository has no direct Effect dependency. Existing ESLint gate remains authoritative until the pre-existing Oxlint findings are resolved; `pnpm lint:anti-slop` reports that backlog without weakening the gate.
