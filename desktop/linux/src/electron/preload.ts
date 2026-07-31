/**
 * Preload: the only surface the renderer gets. One frozen global, one method,
 * every call routed through the main process bridge — no Node, no Electron API,
 * no filesystem reaches the window.
 */
import { contextBridge, ipcRenderer } from "electron";
import { DESKTOP_BRIDGE_CHANNEL, DESKTOP_BRIDGE_GLOBAL } from "../lib/bridge-contract.js";

contextBridge.exposeInMainWorld(DESKTOP_BRIDGE_GLOBAL, {
  request: (request: unknown) => ipcRenderer.invoke(DESKTOP_BRIDGE_CHANNEL, request),
});
