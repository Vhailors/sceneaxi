import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const capturedRefs = [
  {
    "ref": "refs/captured/heads/bb/luna-repository-sceneaxi-sceneaxi-monorepo-read-thr_7svfbah827",
    "tip": "1e5ea6043946afbdddeac049ee01d7019dceec03"
  },
  {
    "ref": "refs/captured/heads/bb/luna-repository-sceneaxi-sceneaxi-monorepo-read-thr_rww6kh273z",
    "tip": "db8afa68c18e46b426e0c9ac2a846fc8a7d3fdba"
  },
  {
    "ref": "refs/captured/heads/bb/opus-go-live-loop-2-for-sceneaxi-the-previous-lo-thr_cgpu4vbkib",
    "tip": "45866fc43f1d45920bbbfc32274685d61cf061c9"
  },
  {
    "ref": "refs/captured/heads/go-live-loop",
    "tip": "4e532e2fbf43e9948741578ab6208a3277870405"
  },
  {
    "ref": "refs/captured/heads/maestro/product-quality-loop-2",
    "tip": "fed05a766f1277b23ebf1757022067837d00621e"
  },
  {
    "ref": "refs/captured/heads/main",
    "tip": "5698f78d5bff24513ee53ec181d28bfebbdf0a83"
  },
  {
    "ref": "refs/captured/heads/production-swarm",
    "tip": "4e532e2fbf43e9948741578ab6208a3277870405"
  },
  {
    "ref": "refs/captured/heads/rescue/sceneaxi-release-dd77cc9",
    "tip": "e26f30bca3b4800cd7301606c7271244c1d6ea29"
  },
  {
    "ref": "refs/captured/remotes/origin/HEAD",
    "tip": "c202bfcbf3e93f5414596e7fc0fbec5d51d82a16"
  },
  {
    "ref": "refs/captured/remotes/origin/cursor/setup-dev-environment-e97a",
    "tip": "1d2fe8aa089772c87271580deb158d87dd68cb64"
  },
  {
    "ref": "refs/captured/remotes/origin/engine-redesign",
    "tip": "907d1d5db146189b0e50db49450feb3d635abc72"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-contracts-e1e2-v1",
    "tip": "60cd238d0fafa427c0bd1b363f6cc21e1a885727"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-docs-adr-v1",
    "tip": "d1a676ea53bd4e8f368f027fb80f6b0097ab6aa3"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-docs-program-v1",
    "tip": "9b2fd5d6ff24f08855c2669c011d7aba79e0211b"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-full-editor-asset-pipeline-20260812",
    "tip": "62e84cbee60471bd2cdd5f2e0e26a8c45f598928"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-full-editor-contained-git-20260812",
    "tip": "f1b468fa6b319ffede42f6d8d6bb40480818c08e"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-full-editor-input-actions-20260812",
    "tip": "740c7e950cf5eb6528e6629ee6f7041ef50dde5c"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave2-catalogs-v1",
    "tip": "21c135b3eb671a79c37444513fe775dc5ff6cefd"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave2-cli-v1",
    "tip": "1471150caeda3db7624f206753c566851182c688"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave2-kernel-v1",
    "tip": "136fee1103d650baf3dc40ebbc4fc3d3f6fb2f45"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave3-authoring-v1",
    "tip": "ac1440670a8ad4eb8532cb20b4b85a9fbd0458df"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave3-heldkeys-v1",
    "tip": "7e7767a44c7ab20942b93469295c97aa972ba54d"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave3-proof0-v1",
    "tip": "d53d180beccfd11e1178fbc9abf3b08282d2ed44"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave4-profile-v1",
    "tip": "07f0a3e8b27d2c6deb76856c3376243df490b822"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave4-proof1-v1",
    "tip": "b63dc23d61e883332f85d272c980a404530b70a7"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave4-shells-v1",
    "tip": "8729660a5cdaed2e5ced97124ac85311f3cef7ba"
  },
  {
    "ref": "refs/captured/remotes/origin/fm/sceneaxi-wave5-proof15-v1",
    "tip": "16f312c61435e3d379a0e54525ac8115e35fee86"
  },
  {
    "ref": "refs/captured/remotes/origin/maestro/phase-01-toolchain",
    "tip": "89c7aa5e9fbaa7e31b9c7e879841684651426d07"
  },
  {
    "ref": "refs/captured/remotes/origin/maestro/phase-02-audit-baseline",
    "tip": "94a4503050def7641f78faa24ae756497ceb3292"
  },
  {
    "ref": "refs/captured/remotes/origin/maestro/product-quality-loop-2",
    "tip": "fed05a766f1277b23ebf1757022067837d00621e"
  },
  {
    "ref": "refs/captured/remotes/origin/main",
    "tip": "c202bfcbf3e93f5414596e7fc0fbec5d51d82a16"
  },
  {
    "ref": "refs/captured/remotes/origin/maintenance/checkpoint-20260929",
    "tip": "23413eb7889ad2cdb41ab8d729c32c7512917394"
  },
  {
    "ref": "refs/captured/remotes/origin/production-swarm",
    "tip": "346933c105305224d575bf9319256301c1eeabfa"
  },
  {
    "ref": "refs/captured/remotes/origin/rescue/sceneaxi-release-dd77cc9",
    "tip": "e26f30bca3b4800cd7301606c7271244c1d6ea29"
  }
];

for (const { ref, tip } of capturedRefs) {
  test(`native merged ancestry contains ${ref} (${tip})`, () => {
    assert.doesNotThrow(() => execFileSync("git", ["merge-base", "--is-ancestor", tip, "HEAD"]));
  });
}
