import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const incorporatedFrontiers = [
  "16f312c61435e3d379a0e54525ac8115e35fee86",
  "f1b468fa6b319ffede42f6d8d6bb40480818c08e",
  "62e84cbee60471bd2cdd5f2e0e26a8c45f598928",
  "740c7e950cf5eb6528e6629ee6f7041ef50dde5c",
  "1e5ea6043946afbdddeac049ee01d7019dceec03",
  "db8afa68c18e46b426e0c9ac2a846fc8a7d3fdba",
  "94a4503050def7641f78faa24ae756497ceb3292",
  "1d2fe8aa089772c87271580deb158d87dd68cb64",
  "23413eb7889ad2cdb41ab8d729c32c7512917394",
  "fed05a766f1277b23ebf1757022067837d00621e",
  "346933c105305224d575bf9319256301c1eeabfa",
];

for (const tip of incorporatedFrontiers) {
  test(`native merged ancestry contains ${tip}`, () => {
    assert.doesNotThrow(() => execFileSync("git", ["merge-base", "--is-ancestor", tip, "HEAD"]));
  });
}
