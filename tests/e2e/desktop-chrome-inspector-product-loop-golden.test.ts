import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type HTMLElement as HappyHTMLElement } from "happy-dom";
import { createDesktopBridge, desktopOpenScene } from "../../desktop/linux/src/index.ts";
import { productHarness, query, clickProduct as click } from "../helpers/desktop-chrome-golden.js";

const { projectDir, mountChrome } = productHarness(createDesktopBridge, desktopOpenScene);

describe("desktop first-release product loop — inspector", () => {
  /**
   * The panel used to hold the inspection the last open produced, so a value it
   * displayed could be one the session had already moved past — and the next
   * edit re-opened, which dropped the selection and refused.
   */
  it("keeps the property panel on the staged then saved value without reopening or reselecting", async () => {
    const dir = projectDir();
    const { window, start } = mountChrome(dir);
    start();

    const translationInput = () =>
      query(window, "#scene-property-translation-x") as
        | (HappyHTMLElement & { value: string })
        | null;
    const savedTranslationX = () => {
      const document_ = JSON.parse(readFileSync(join(dir, "scene.json"), "utf8")) as {
        data: {
          composedScene: {
            instances: Array<{
              instanceId: string;
              localTransform: { translation: number[] };
            }>;
          };
        };
      };
      return document_.data.composedScene.instances.find(
        (instance) => instance.instanceId === "desktop-crate-beside",
      )?.localTransform.translation[0];
    };

    await click(window, "#project-open");
    await click(window, "#scene-entity-desktop-crate-beside");
    const input = translationInput();
    if (input === null) throw new Error("translation input is missing");
    expect(input.value).toBe("-4.4");
    input.value = "-3.25";

    const before = readFileSync(join(dir, "scene.json"), "utf8");
    await click(window, "#scene-property-stage");
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(before);
    // The staged value is the host's, echoed back — not the string left in the field.
    expect(translationInput()?.value).toBe("-3.25");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(translationInput()?.value).toBe("-3.25");

    await click(window, "#project-save");
    expect(query(window, "[data-project-status]")?.textContent).toContain("saved");
    expect(savedTranslationX()).toBe(-3.25);
    // The applied proposal is spent: its diff goes, the written value stays.
    expect(query(window, "[data-scene-property-review]")?.hidden).toBe(true);
    expect(query(window, "[data-scene-property-review]")?.textContent).toBe("");
    expect(query(window, "[data-scene-entities]")?.hidden).toBe(false);
    expect(translationInput()?.value).toBe("-3.25");
    await click(window, "#scene-entity-desktop-crate-beside");
    expect(translationInput()?.value).toBe("-3.25");

    // A second edit straight after Save: no reopen, no reselect, and the value
    // typed at click time is the one that stages.
    const staged = translationInput();
    if (staged === null) throw new Error("translation input is missing after save");
    staged.value = "-1.5";
    const beforeSecond = readFileSync(join(dir, "scene.json"), "utf8");
    await click(window, "#scene-property-stage");
    expect(query(window, "[data-project-status]")?.textContent).toContain(
      "property staged · review before Save",
    );
    expect(readFileSync(join(dir, "scene.json"), "utf8")).toBe(beforeSecond);
    expect(translationInput()?.value).toBe("-1.5");

    await click(window, "#project-save");
    expect(savedTranslationX()).toBe(-1.5);
    expect(translationInput()?.value).toBe("-1.5");
  });
});
