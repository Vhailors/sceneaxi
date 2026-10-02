import { DESKTOP_VISUAL_REFUSALS, type DesktopControlMint } from "./core.js";

export function treeSelection(control: DesktopControlMint) {
  return control("scene-entity-desktop-crate-beside", "Ordered scene object selection", "view");
}

export function treeProjectControls(control: DesktopControlMint) {
  return {
    newProject: control("project-new-root", "New Project", "live"),
    openProjectRoot: control("project-open-root", "Open Project", "live"),
    recentProject: control("project-recent-select", "Recent project", "view"),
    openRecent: control("project-open-recent", "Open recent project", "live"),
    removeRecent: control("project-remove-recent", "Remove recent project", "live"),
  };
}

export function treeBrowserControls(control: DesktopControlMint) {
  return {
    browseFile: control("project-browser-file-select", "Project file", "live"),
    openBrowserFile: control("project-browser-open", "Open selected project file", "live"),
    renameBrowserFile: control("project-browser-rename", "Rename selected project file", "inert", DESKTOP_VISUAL_REFUSALS.projectBrowserOperationNotPermitted),
    deleteBrowserFile: control("project-browser-delete", "Delete selected project file", "inert", DESKTOP_VISUAL_REFUSALS.projectBrowserOperationNotPermitted),
  };
}

export function treeHierarchyControls(control: DesktopControlMint) {
  return {
    addSceneInstance: control("scene-instance-add", "Add local instance", "live"),
    removeSceneInstance: control("scene-instance-remove", "Remove selected instance", "live"),
    reparentSceneInstance: control("scene-instance-reparent", "Reparent primary selection", "live"),
    reparentSceneParent: control("scene-instance-parent", "New parent", "live"),
    reparentScenePolicy: control("scene-instance-policy", "Transform policy", "live"),
  };
}
