/**
 * Preload: the only surface the renderer gets. One frozen global with separate
 * engine, project-lifecycle, and BYOK methods, each routed through its typed main
 * process channel — no Node, Electron API, or filesystem reaches the window.
 */
import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_BYO_CONFIGURATION_CHANNEL } from "../lib/byo-configuration-contract.js";
import {
  DESKTOP_ASSET_IMPORT_CHANNEL,
  DESKTOP_BRIDGE_CHANNEL,
  DESKTOP_BRIDGE_GLOBAL,
} from "../lib/bridge-contract.js";
import { DESKTOP_PROJECT_CHANNEL } from "../lib/project-lifecycle-contract.js";
import { DESKTOP_PROJECT_BROWSER_CHANNEL } from "../lib/project-browser-contract.js";

contextBridge.exposeInMainWorld(DESKTOP_BRIDGE_GLOBAL, {
  request: (request: unknown) => ipcRenderer.invoke(DESKTOP_BRIDGE_CHANNEL, request),
  importAsset: (request: unknown) => ipcRenderer.invoke(DESKTOP_ASSET_IMPORT_CHANNEL, request),
  project: (request: unknown) => ipcRenderer.invoke(DESKTOP_PROJECT_CHANNEL, request),
  browseProject: (request: unknown) =>
    ipcRenderer.invoke(DESKTOP_PROJECT_BROWSER_CHANNEL, request),
  configureByo: (request: unknown) =>
    ipcRenderer.invoke(DESKTOP_BYO_CONFIGURATION_CHANNEL, request),
});
