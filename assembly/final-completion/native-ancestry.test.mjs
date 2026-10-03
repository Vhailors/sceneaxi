import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const incorporatedFrontiers = [
  "16f312c61435e3d379a0e54525ac8115e35fee86",
  "f1b468fa6b319ffede42f6d8d6bb40480818c08e",
];

for (const tip of incorporatedFrontiers) {
  test(`native merged ancestry contains ${tip}`, () => {
    assert.doesNotThrow(() => execFileSync("git", ["merge-base", "--is-ancestor", tip, "HEAD"]));
  });
}
