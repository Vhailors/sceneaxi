import { describe, expect, it } from "vitest";
import { type HTMLElement as HappyHTMLElement } from "happy-dom";
import { createDesktopBridge, desktopOpenScene } from "../../desktop/linux/src/index.ts";
import { productHarness, query, clickProduct as click } from "../helpers/desktop-chrome-golden.js";

const { projectDir, mountChrome } = productHarness(createDesktopBridge, desktopOpenScene);

describe("desktop first-release product loop — tree", () => {
  it("keeps click and keyboard multi-selection in canonical hierarchy order", async () => {
    const { window, start } = mountChrome(projectDir());
    start();
    await click(window, "#project-open");

    const selection = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & {
          multiple: boolean;
          options: ArrayLike<HappyHTMLElement & { selected: boolean; value: string }>;
          dataset: Record<string, string | undefined>;
        })
      | null;
    if (selection === null) throw new Error("hierarchy multi-selector missing");
    expect(selection.multiple).toBe(true);
    for (const option of Array.from(selection.options)) {
      option.selected = option.value === "desktop-crate-stacked" ||
        option.value === "desktop-crate-beside";
    }
    selection.dispatchEvent(new window.Event("change", { bubbles: true }));

    expect(selection.dataset.value).toBe(
      "desktop-crate-beside,desktop-crate-stacked",
    );
    expect(query(window, "[data-scene-property-entity-id]")?.textContent).toBe(
      "desktop-crate-beside",
    );
  });

  it("renders object identity and current parentage after reparent and reopen", async () => {
    const { window, start } = mountChrome(projectDir());
    start();
    await click(window, "#project-open");

    const identityText = (instanceId: string, field: "artifact" | "instance" | "parent") =>
      query(
        window,
        `[data-scene-identity="${instanceId}"] [data-scene-identity-${field}]`,
      )?.textContent;
    expect(identityText("desktop-crate-beside", "artifact"))
      .toBe("starter-service-crate-artifact");
    expect(identityText("desktop-crate-beside", "instance"))
      .toBe("desktop-crate-beside");
    expect(identityText("desktop-crate-beside", "parent"))
      .toBe("desktop-crate-root");

    const hierarchy = query(window, "#scene-entity-desktop-crate-beside") as
      | (HappyHTMLElement & {
          value: string;
          options: ArrayLike<HappyHTMLElement & { value: string }>;
        })
      | null;
    if (hierarchy === null) throw new Error("hierarchy selector missing");
    const optionText = (instanceId: string) =>
      Array.from(hierarchy.options).find((option) => option.value === instanceId)?.textContent;
    const initialText = optionText("desktop-crate-beside");
    expect(initialText).toContain(
      " · instance desktop-crate-beside · parent desktop-crate-root",
    );
    expect(initialText).not.toContain("Placed beside the root");
    const objectIdentity = initialText?.split(" · instance ")[0];
    expect(objectIdentity).toMatch(/^\s*Object [a-z0-9-]+$/);

    hierarchy.value = "desktop-crate-beside";
    hierarchy.dispatchEvent(new window.Event("change", { bubbles: true }));
    const parent = query(window, "#scene-instance-parent") as
      | (HappyHTMLElement & { value: string })
      | null;
    const policy = query(window, "#scene-instance-policy") as
      | (HappyHTMLElement & { value: string })
      | null;
    if (parent === null || policy === null) throw new Error("reparent controls missing");
    parent.value = "desktop-crate-stacked";
    policy.value = "preserve-local";
    await click(window, "#scene-instance-reparent");
    await click(window, "#change-review-accept");
    await click(window, "#project-open");

    expect(optionText("desktop-crate-beside")).toContain(
      `${objectIdentity} · instance desktop-crate-beside · parent desktop-crate-stacked`,
    );
    expect(optionText("desktop-crate-beside")).not.toContain("Placed beside the root");
    expect(identityText("desktop-crate-beside", "artifact"))
      .toBe("starter-service-crate-artifact");
    expect(identityText("desktop-crate-beside", "instance"))
      .toBe("desktop-crate-beside");
    expect(identityText("desktop-crate-beside", "parent"))
      .toBe("desktop-crate-stacked");
  });
});
