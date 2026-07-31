"use client";

/**
 * The Engine Desktop shell, rendered over one real Minimum E2 session render.
 *
 * This component draws `buildEditorShellView()`'s data and decides nothing: which
 * dock tabs a mode has, what every control's kind is, which refusal an inert
 * control names, and every digest, tick, and transform on screen were decided in
 * `@sceneaxi/site-kit` from the real session. Client state here is *view* state
 * only — active mode, active dock tab, palette/assistant visibility, and the
 * profile projection — the same split the desktop chrome keeps between its
 * model and its emitted document (`docs/engine-desktop-surface.md`).
 *
 * Engine state never changes client-side: every `live` control is a link or a
 * form submit that re-renders `/editor` with new URL state, so the browser can
 * never show a scene the server session did not produce.
 *
 * The Kids chip projects the shared open-path policy: selecting it replaces the
 * editor body with the policy's own refusal, demotes the rail and the composer
 * to inert, and keeps exactly the controls that leave the state live — the same
 * refuse-only behaviour the desktop chrome records.
 */
import { useEffect, useRef, useState } from "react";
import type {
  EditorShellControl,
  EditorShellView,
  MountableScene,
} from "@sceneaxi/site-kit";
import { EditorViewport } from "./editor-viewport.js";

type ModeId = EditorShellView["modes"][number]["id"];
type DockTabId = EditorShellView["modes"][number]["dockTabs"][number];
type ProfileId = EditorShellView["profiles"][number]["id"];

const DOCK_TAB_LABELS: Record<DockTabId, string> = {
  changes: "Changes",
  assets: "Assets",
  console: "Console",
  evidence: "Evidence",
  timeline: "Timeline",
};

/** The refusal-legend anchor id for a code, shared by every describedby. */
const legendId = (code: string): string => `edshell-refusal-${code}`;

/** The one panel every viewport-source tab controls. */
const VIEWPORT_PANEL_ID = "ed-viewport-panel";

/**
 * Every interactive element goes through this one helper, so a control cannot
 * reach the document without its kind and its refusal wiring — the invariant
 * the desktop chrome enforces with its own `button()` helper.
 */
function ShellButton({
  control,
  className,
  demotedRefusal,
  pressed,
  selected,
  role,
  controls,
  onClick,
  children,
}: {
  readonly control: EditorShellControl;
  readonly className?: string | undefined;
  /**
   * Kids projection: a live/view control rendered behind the refusal. The code
   * is the view's own (`view.kidsLock.code`), never restated here, so the
   * describedby it produces always resolves against the rendered legend.
   */
  readonly demotedRefusal?: string | undefined;
  readonly pressed?: boolean | undefined;
  /**
   * `aria-selected` is only legal on a role that supports it, so a caller that
   * passes it must also pass the role (`tab`) and the panel it controls.
   */
  readonly selected?: boolean | undefined;
  readonly role?: "tab" | undefined;
  readonly controls?: string | undefined;
  readonly onClick?: ((event: React.MouseEvent<HTMLElement>) => void) | undefined;
  readonly children?: React.ReactNode;
}) {
  const inert = control.kind === "inert" || demotedRefusal !== undefined;
  const refusal = control.kind === "inert" ? control.refusal : (demotedRefusal ?? null);
  const binding = control.binding;

  const shared = {
    className: `${className ?? ""}${inert ? " is-inert" : ""}`,
    "data-kind": inert ? "inert" : control.kind,
    ...(inert
      ? {
          "aria-disabled": true,
          "data-refusal": refusal ?? undefined,
          "aria-describedby": refusal === null ? undefined : legendId(refusal),
        }
      : {}),
    ...(pressed === undefined ? {} : { "aria-pressed": pressed }),
    ...(role === undefined ? {} : { role }),
    ...(selected === undefined || role === undefined
      ? {}
      : { "aria-selected": selected }),
    ...(controls === undefined ? {} : { "aria-controls": controls }),
  } as const;

  if (!inert && binding !== null && binding.kind === "href") {
    return (
      <a id={control.id} href={binding.href} {...shared}>
        {children ?? control.label}
      </a>
    );
  }
  return (
    <button
      id={control.id}
      type="button"
      {...shared}
      onClick={inert ? undefined : onClick}
    >
      {children ?? control.label}
    </button>
  );
}

export function EditorShell({
  view,
  scene,
  selectedInstanceId,
  deepLinkFields,
  viewportCopy,
}: {
  readonly view: EditorShellView;
  readonly scene: MountableScene | null;
  readonly selectedInstanceId: string;
  readonly deepLinkFields: ReadonlyArray<{ readonly name: string; readonly value: string }>;
  /**
   * The viewport copy is owned by `src/lib/editor-viewport.ts` and arrives as a
   * prop because a client component must not import the Node-bearing site-kit
   * root barrel that module reads its vocabulary from.
   */
  readonly viewportCopy: Readonly<{ lede: string; honesty: string; notComposable: string }>;
}) {
  const [mode, setMode] = useState<ModeId>("build");
  const [dockTab, setDockTab] = useState<DockTabId>("changes");
  const [profile, setProfile] = useState<ProfileId>("game");
  const [assistantOpen, setAssistantOpen] = useState(view.assistant.state === "open");
  const [assistantMode, setAssistantMode] = useState(view.assistant.defaultModeId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLInputElement | null>(null);
  const paletteReturnFocus = useRef<HTMLElement | null>(null);

  const fallbackMode = view.modes[0];
  if (fallbackMode === undefined) {
    throw new Error("The editor shell view carries no modes.");
  }
  const activeMode =
    view.modes.find((candidate) => candidate.id === mode) ?? fallbackMode;
  const kids = profile === "kids";
  // The view decides which source has a session here; the other tabs refuse.
  const selectedViewportSource = view.viewport.sources.find(
    (source) => source.kind !== "inert",
  );

  const enterMode = (next: ModeId) => {
    const nextMode = view.modes.find((candidate) => candidate.id === next);
    if (nextMode === undefined) return;
    setMode(next);
    setDockTab(nextMode.dockTabs[0] ?? "console");
  };

  // ⌘K / Ctrl+K opens the palette; Escape closes it and returns focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        paletteReturnFocus.current = document.activeElement as HTMLElement;
        setPaletteOpen(true);
      } else if (event.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
        paletteReturnFocus.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  useEffect(() => {
    if (paletteOpen) paletteRef.current?.focus();
  }, [paletteOpen]);

  const profilePin =
    view.profiles.find((chip) => chip.id === profile)?.statusPin ??
    view.statusBar.profilePin;

  /** Palette groups in the view's own mint order — the view decides the set. */
  const paletteGroups = view.palette.reduce<readonly string[]>(
    (groups, row) => (groups.includes(row.group) ? groups : [...groups, row.group]),
    [],
  );

  const dockTabs = activeMode.dockTabs;
  const shownDockTab: DockTabId = dockTabs.includes(dockTab) ? dockTab : (dockTabs[0] ?? "console");

  return (
    <div className="edshell" data-mode={mode} data-profile={profile}>
      {/*
        Below the shared minimum window the chrome refuses rather than rendering
        an unusable layout — the same tier rule the desktop chrome derives from
        the shared editor-shell model. The block is in every document; the
        stylesheet decides which side shows, so the refusal needs no script.
      */}
      <div className="ed-minimum" role="note">
        <p className="reason mono">{view.windowMinimum.code}</p>
        <p>{view.windowMinimum.message}</p>
      </div>
      {/* ------------------------------------------------ title bar ------ */}
      <header className="ed-titlebar" aria-label="Editor title bar">
        <a className="ed-wordmark" href="/" aria-label="SceneAxi home">
          <span className="mark" aria-hidden="true" />
        </a>
        <nav className="ed-menus" aria-label="Application menus">
          {view.menus.map((menu) => (
            <ShellButton key={menu.id} control={menu} className="ed-menu" />
          ))}
        </nav>
        <div className="ed-profile-switch" role="group" aria-label="Profile">
          {view.profiles.map((chip) => (
            <ShellButton
              key={chip.control.id}
              control={chip.control}
              className={`ed-profile-chip ed-profile-${chip.id}`}
              pressed={profile === chip.id}
              onClick={() => setProfile(chip.id)}
            >
              <span className="dot" aria-hidden="true" />
              {chip.label}
            </ShellButton>
          ))}
        </div>
        <div className="ed-project">
          <span className="ed-project-pill">
            <span className="dot" aria-hidden="true" />
            {view.project.name}
            <span className="ed-project-doc">{view.project.documentPath}</span>
          </span>
          <span className="ed-project-save">
            {view.changes.appliedPaths.length > 0
              ? `saved · ${view.changes.appliedPaths.join(", ")}`
              : "not saved"}
          </span>
        </div>
        <div className="ed-title-actions">
          <ShellButton
            control={view.paletteOpener}
            className="ed-search"
            onClick={(event) => {
              paletteReturnFocus.current = event.currentTarget;
              setPaletteOpen(true);
            }}
          >
            {view.paletteOpener.label} <kbd>⌘K</kbd>
          </ShellButton>
          <ShellButton
            control={view.assistant.toggle}
            className="ed-assistant-toggle"
            pressed={assistantOpen}
            onClick={() => setAssistantOpen((open) => !open)}
          >
            <span className="dot" aria-hidden="true" />
            Assistant
          </ShellButton>
        </div>
      </header>

      <div className="ed-body">
        {/* ---------------------------------------------- mode rail ------ */}
        <nav className="ed-rail" aria-label="Editor modes">
          <span className="ed-rail-mark" aria-hidden="true" />
          {view.modes.map((entry) => (
            <ShellButton
              key={entry.control.id}
              control={entry.control}
              className="ed-rail-mode"
              demotedRefusal={kids ? view.kidsLock.code : undefined}
              pressed={mode === entry.id}
              onClick={() => enterMode(entry.id)}
            >
              <span className={`ed-rail-glyph ed-glyph-${entry.id}`} aria-hidden="true" />
              {entry.railLabel}
            </ShellButton>
          ))}
        </nav>

        {kids ? (
          /* ------------------------------- the refuse-only projection --- */
          <section className="ed-kids-lock" aria-label="Kids profile refusal">
            <p className="ed-kids-code">{view.kidsLock.code}</p>
            <h2>{view.kidsLock.summary}</h2>
            <p>{view.policyNote}</p>
            <p className="ed-kids-exit">
              The profile switch stays live: a refuse-only state is a state you can
              leave.
            </p>
          </section>
        ) : (
          <>
            {/* -------------------------------------------- left dock ---- */}
            <aside className="ed-left" aria-label="Scene panels">
              {mode === "sculpt" ? (
                <>
                  <div className="ed-panel-head">
                    <span>SCULPT LIBRARY</span>
                    <span className="hint">{view.sculpt.library.length}</span>
                  </div>
                  <ul className="ed-library">
                    {view.sculpt.library.map((item) => (
                      <li key={item.artifactId}>
                        <span className="ed-lib-name">{item.artifactId}</span>
                        <span className="ed-lib-digest">{item.digestShort}</span>
                        <span className="ed-lib-count">×{item.mountCount} mounted</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ed-panel-head">
                    <span>RUN HISTORY</span>
                  </div>
                  <p className="ed-run-history">{view.sculpt.runOutcome}</p>
                </>
              ) : mode === "run" ? (
                <>
                  <div className="ed-panel-head">
                    <span>RUNTIME</span>
                  </div>
                  <dl className="ed-facts">
                    <dt>Session</dt>
                    <dd className="ok">open</dd>
                    <dt>Play state</dt>
                    <dd>{view.run.playState}</dd>
                    <dt>Tick</dt>
                    <dd>{view.run.tick}</dd>
                    <dt>Objects</dt>
                    <dd>{view.run.objectCount} mounted</dd>
                    <dt>Frame digest</dt>
                    <dd className="mono">{view.run.frameDigestShort ?? "—"}</dd>
                  </dl>
                  <div className="ed-panel-head">
                    <span>SIMULATED BODIES</span>
                    <span className="hint">{view.run.bodies.length}</span>
                  </div>
                  <ul className="ed-bodies">
                    {view.run.bodies.map((body) => (
                      <li key={body.instanceId}>
                        <span className="ed-body-name">{body.instanceId}</span>
                        <span className="mono">{body.translation}</span>
                        <span className="ed-body-state">{body.state}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ed-panel-head">
                    <span>REPLAY</span>
                  </div>
                  <p className="ed-note-block">
                    Every session records its advances and ends with a digest. Replay
                    re-runs the exact sequence; a differing digest refuses, never
                    smoothed over.
                  </p>
                </>
              ) : mode === "plugins" ? (
                <>
                  <div className="ed-panel-head">
                    <span>LOADED</span>
                    <span className="hint">{view.plugins.loaded.length}</span>
                  </div>
                  <p className="ed-note-block">
                    No plugin is loaded on this surface. The host and its isolation
                    rules live behind the plugin capability registry.
                  </p>
                  <div className="ed-panel-head">
                    <span>REGISTRY</span>
                    <span className="hint">{view.plugins.registry.length}</span>
                  </div>
                  <ul className="ed-registry">
                    {view.plugins.registry.map((row) => (
                      <li key={row.id}>
                        <span className="mono">{row.id}</span>
                        <span className="ed-registry-meta">
                          v{row.version} · {row.summary}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <div className="ed-panel-head">
                    <span>{mode === "compose" ? "SCENE INSTANCES" : "SCENE"}</span>
                    <span className="hint">{view.tree.length}</span>
                  </div>
                  <ul className="ed-tree" aria-label="Scene tree">
                    {view.tree.map((row) => (
                      <li
                        key={row.id}
                        className={row.selected ? "is-selected" : undefined}
                        style={{ paddingLeft: `${10 + row.depth * 14}px` }}
                      >
                        {row.selectHref === null ? (
                          <span className="ed-tree-label">{row.label}</span>
                        ) : (
                          <a className="ed-tree-label" href={row.selectHref}>
                            {row.label}
                          </a>
                        )}
                        <span className="ed-tree-kind">{row.kindLabel}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="ed-panel-head">
                    <span>LAYERS</span>
                    <span className="hint">{view.layers.length}</span>
                  </div>
                  <ul className="ed-layers">
                    {view.layers.map((layer) => (
                      <li key={layer.id}>
                        <span>{layer.label}</span>
                        <span className="ed-layer-detail">{layer.detail}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </aside>

            {/* ---------------------------------------- viewport column --- */}
            <section className="ed-viewport-col" aria-label="Viewport">
              <div className="ed-viewtabs" role="tablist" aria-label="Viewport source">
                {view.viewport.sources.map((source) => (
                  <ShellButton
                    key={source.id}
                    control={source}
                    className="ed-viewtab"
                    role="tab"
                    selected={source.id === selectedViewportSource?.id}
                    controls={VIEWPORT_PANEL_ID}
                  />
                ))}
              </div>
              <div
                className="ed-canvas"
                id={VIEWPORT_PANEL_ID}
                role="tabpanel"
                {...(selectedViewportSource === undefined
                  ? {}
                  : { "aria-labelledby": selectedViewportSource.id })}
              >
                <div className="ed-canvas-chips">
                  <span className="ed-chip">
                    <span className="dot" aria-hidden="true" />
                    {view.project.name}
                  </span>
                  <span className="ed-chip mono">
                    {view.run.objectCount} objects
                  </span>
                  <span className="ed-chip mono ed-chip-selected">{selectedInstanceId}</span>
                </div>
                {scene === null ? (
                  <div className="ed-canvas-refusal">
                    <p className="reason mono">{view.compose.refusalCode}</p>
                    <p>{view.compose.refusalMessage}</p>
                    <p>{viewportCopy.notComposable}</p>
                  </div>
                ) : (
                  <EditorViewport scene={scene} selectedInstanceId={selectedInstanceId} />
                )}
              </div>

              {/* ------------------------------------------- dock -------- */}
              <div className="ed-dock">
                <div className="ed-dock-strip">
                  <div role="tablist" aria-label="Dock panels" className="ed-dock-tabs">
                    {dockTabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        id={`dock-${tab}`}
                        aria-selected={shownDockTab === tab}
                        aria-controls={`dock-panel-${tab}`}
                        className="ed-dock-tab"
                        data-kind="view"
                        onClick={() => setDockTab(tab)}
                      >
                        {DOCK_TAB_LABELS[tab]}
                        {tab === "changes" && view.changes.review !== null && (
                          <span className="ed-badge">{view.changes.review.rows.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {shownDockTab === "changes" && (
                    <div className="ed-dock-bulk">
                      <ShellButton control={view.changes.rejectAll} className="ed-ghost" />
                      <ShellButton control={view.changes.acceptAll} className="ed-primary" />
                    </div>
                  )}
                </div>

                <div className="ed-dock-body">
                  {shownDockTab === "changes" && (
                    <div role="tabpanel" id="dock-panel-changes" aria-labelledby="dock-changes">
                      {view.changes.review === null ? (
                        <p className="ed-note-block">
                          No reviewable proposal: {view.changes.reviewRefusal ?? "nothing to review"}.
                        </p>
                      ) : (
                        <>
                          <p className="ed-dock-lede">
                            This render saved through propose/apply. Apply is E1 and
                            all-or-nothing: the whole proposal below was applied as
                            one edit, which is why single-row decisions refuse.
                          </p>
                          <table className="ed-changes">
                            <thead>
                              <tr>
                                <th>PROPERTY</th>
                                <th>CURRENT</th>
                                <th>PROPOSED</th>
                                <th>STATE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {view.changes.review.rows.map((row) => (
                                <tr key={row.index}>
                                  <td className="mono">
                                    <span className={`ed-cr-badge ed-cr-${row.badge}`}>
                                      {row.badgeGlyph}
                                    </span>
                                    <span className="ed-cr-path">{row.path}</span>
                                    <span className="ed-cr-leaf">{row.leaf}</span>
                                  </td>
                                  <td className="mono ed-cr-current">{row.before}</td>
                                  <td className="mono ed-cr-proposed">{row.after}</td>
                                  <td className="mono">applied</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="ed-dock-foot mono">
                            PROPOSED BY session save · {view.changes.review.origin}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {shownDockTab === "assets" && (
                    <div role="tabpanel" id="dock-panel-assets" aria-labelledby="dock-assets">
                      <ul className="ed-assets">
                        {view.sculpt.library.map((item) => (
                          <li key={item.artifactId}>
                            <span className="mono">{item.artifactId}</span>
                            <span className="mono ed-asset-digest">{item.digestShort}</span>
                            <span>mounted ×{item.mountCount}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="ed-note-block">
                        One artifact, reconstructed deterministically at seed{" "}
                        {view.sculpt.seed}; no invented file sizes or thumbnails.
                      </p>
                    </div>
                  )}
                  {shownDockTab === "console" && (
                    <div role="tabpanel" id="dock-panel-console" aria-labelledby="dock-console">
                      <ol className="ed-console">
                        {view.console.map((row, index) => (
                          <li key={index} className={`ed-console-${row.level}`}>
                            <span className="ed-console-level">{row.level.toUpperCase()}</span>
                            <span className="mono">{row.text}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {shownDockTab === "evidence" && (
                    <div role="tabpanel" id="dock-panel-evidence" aria-labelledby="dock-evidence">
                      <table className="ed-evidence">
                        <thead>
                          <tr>
                            <th>RUN</th>
                            <th>DIGEST</th>
                            <th>BOUND TO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {view.evidence.map((row) => (
                            <tr key={row.id}>
                              <td>{row.label}</td>
                              <td className="mono">{row.digest}</td>
                              <td className="mono">{row.boundTo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {shownDockTab === "timeline" && (
                    <div role="tabpanel" id="dock-panel-timeline" aria-labelledby="dock-timeline">
                      <p className="ed-dock-lede">
                        Socket values are advanced by the kernel and read back as
                        frozen observations — this surface authors no timeline.
                      </p>
                      <ul className="ed-sockets">
                        {view.animate.sockets.length === 0 ? (
                          <li className="ed-note-block">
                            Nothing selected, so no driven sockets to show.
                          </li>
                        ) : (
                          view.animate.sockets.map((socket) => (
                            <li key={socket.id}>
                              <span className="mono">{socket.id}</span>
                              <span className="mono">{socket.value}</span>
                              <span className="ed-socket-node">{socket.kindLabel}</span>
                            </li>
                          ))
                        )}
                      </ul>
                      <ShellButton control={view.animate.authoring} className="ed-ghost" />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ---------------------------------------------- inspector --- */}
            <aside className="ed-inspector" aria-label="Inspector">
              {mode === "sculpt" ? (
                <>
                  <div className="ed-panel-head">
                    <span>SCULPT OBJECT</span>
                    <span className="hint">deterministic</span>
                  </div>
                  <div className="ed-insp-section">
                    <h3>BUILD PASSES</h3>
                    <ol className="ed-passes">
                      {view.sculpt.passes.map((pass) => (
                        <li key={pass.id}>
                          <span className="ed-pass-check" aria-hidden="true" />
                          {pass.id}
                          <span className="ed-pass-n">{pass.position}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="ed-insp-section">
                    <h3>EVIDENCE</h3>
                    <dl className="ed-facts">
                      {view.sculpt.evidence.map((field) => (
                        <div key={field.id} className="ed-fact-row">
                          <dt>{field.label}</dt>
                          <dd className={field.mono ? "mono" : undefined}>{field.value}</dd>
                        </div>
                      ))}
                      <div className="ed-fact-row">
                        <dt>Seed</dt>
                        <dd className="mono">{view.sculpt.seed}</dd>
                      </div>
                    </dl>
                  </div>
                  <p className="ed-insp-foot">{view.sculpt.runOutcome}</p>
                  <ShellButton control={view.sculpt.sculptObject} className="ed-primary ed-insp-cta" />
                </>
              ) : mode === "ship" ? (
                <>
                  <div className="ed-panel-head">
                    <span>DELIVERY HANDOFF</span>
                    <span className="hint">contract</span>
                  </div>
                  <ul className="ed-targets">
                    {view.ship.targets.map((target) => (
                      <li key={target.id}>
                        <span className="mono">{target.id}</span>
                        <span>{target.state}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="ed-note-block">
                    A handoff is data, not authority. Creating one never uploads,
                    signs, spends, or approves a release — an independent adapter
                    does that.
                  </p>
                  <ShellButton control={view.ship.exportHandoff} className="ed-primary ed-insp-cta" />
                </>
              ) : mode === "plugins" ? (
                <>
                  <div className="ed-panel-head">
                    <span>PLUGIN HOST</span>
                    <span className="hint">isolation</span>
                  </div>
                  <p className="ed-note-block">
                    The host exposes a capability table, not a hook bus. A plugin may
                    only claim IDs already in the registry — a new capability needs a
                    public contract first, not a new manifest string.
                  </p>
                  <ShellButton control={view.plugins.loadPlugin} className="ed-primary ed-insp-cta" />
                </>
              ) : (
                <>
                  <div className="ed-panel-head">
                    <span>{mode === "run" ? "LIVE VALUES" : "PROPERTIES"}</span>
                    <span className="hint">
                      {mode === "run" ? "read only" : "1 selected"}
                    </span>
                  </div>
                  {view.inspector.map((section) => (
                    <div key={section.id} className="ed-insp-section">
                      <h3>
                        {section.title}
                        {section.hint !== null && <span className="hint"> {section.hint}</span>}
                      </h3>
                      <dl className="ed-facts">
                        {section.fields.map((field) => (
                          <div key={field.id} className="ed-fact-row">
                            <dt>{field.label}</dt>
                            <dd className={field.mono ? "mono" : undefined}>{field.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                  {mode === "compose" && (
                    <>
                      <div className="ed-insp-section">
                        <h3>
                          WORLD TRANSFORMS<span className="hint"> computed</span>
                        </h3>
                        <ul className="ed-compose-rows">
                          {view.compose.instances.map((instance) => (
                            <li key={instance.instanceId}>
                              <span className="mono">{instance.instanceId}</span>
                              <span className="mono ed-compose-parent">
                                {instance.parentInstanceId === null
                                  ? "root"
                                  : `under ${instance.parentInstanceId}`}
                                {" · d"}
                                {instance.depth}
                              </span>
                              <span className="mono">[{instance.worldTranslation}]</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="ed-insp-section">
                        <h3>
                          EVIDENCE<span className="hint"> recomputable</span>
                        </h3>
                        <dl className="ed-facts">
                          <div className="ed-fact-row">
                            <dt>Scene digest</dt>
                            <dd className="mono">{view.project.sceneDigestShort ?? "—"}</dd>
                          </div>
                          <div className="ed-fact-row">
                            <dt>Artifact bytes</dt>
                            <dd className="mono">unchanged</dd>
                          </div>
                        </dl>
                      </div>
                      <p className="ed-note-block">
                        Placement never rewrites the artifact — its evidence binds its
                        exact bytes. Placement is axis-aligned in v1, and a child
                        transform reads relative to its parent.
                      </p>
                    </>
                  )}
                  {mode === "run" ? (
                    <>
                      <div className="ed-insp-section">
                        <h3>Server session frame</h3>
                        <dl className="ed-facts">
                          <div className="ed-fact-row">
                            <dt>Backend</dt>
                            <dd className="mono">{view.viewport.frame.backend}</dd>
                          </div>
                          <div className="ed-fact-row">
                            <dt>Surface</dt>
                            <dd className="mono">{view.viewport.frame.surface ?? "—"}</dd>
                          </div>
                          <div className="ed-fact-row">
                            <dt>Pixels drawn</dt>
                            <dd className="mono">
                              {String(view.viewport.frame.pixelsDrawn ?? false)}
                            </dd>
                          </div>
                          <div className="ed-fact-row">
                            <dt>Frame</dt>
                            <dd className="mono">{view.viewport.frame.frame}</dd>
                          </div>
                          <div className="ed-fact-row">
                            <dt>Draw calls</dt>
                            <dd className="mono">{view.viewport.frame.drawCalls}</dd>
                          </div>
                        </dl>
                      </div>
                      <p className="ed-note-block">{viewportCopy.honesty}</p>
                      <p className="ed-note-block">
                        Frozen snapshots: the session steps only through the Play
                        control, and each step is a real kernel advance.
                      </p>
                    </>
                  ) : (
                    <form method="get" action="/editor" className="ed-edit-form">
                      {deepLinkFields.map((field) => (
                        <input key={field.name} type="hidden" name={field.name} value={field.value} />
                      ))}
                      <div className="ed-field">
                        <label htmlFor="ed-sel">{view.edit.selection.label}</label>
                        <select id="ed-sel" name="sel" defaultValue={selectedInstanceId}>
                          {view.run.bodies.map((body) => (
                            <option key={body.instanceId} value={body.instanceId}>
                              {body.instanceId}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="ed-field">
                        <label htmlFor="ed-tx">Translation (x,y,z)</label>
                        <input
                          id="ed-tx"
                          name={
                            view.edit.translation.binding?.kind === "form-field"
                              ? view.edit.translation.binding.field
                              : ""
                          }
                          defaultValue={
                            view.run.bodies.find((body) => body.instanceId === selectedInstanceId)
                              ?.translation.replaceAll(" ", "") ?? "0,0,0"
                          }
                        />
                      </div>
                      <div className="ed-field">
                        <label htmlFor="ed-objects">{view.edit.objects.label}</label>
                        <input
                          id="ed-objects"
                          name="objects"
                          type="number"
                          min={view.edit.objectBounds.min}
                          max={view.edit.objectBounds.max}
                          defaultValue={view.run.objectCount}
                        />
                      </div>
                      <button id={view.edit.apply.id} className="ed-primary" type="submit" data-kind="live">
                        {view.edit.apply.label}
                      </button>
                    </form>
                  )}
                </>
              )}
            </aside>
          </>
        )}

        {/* ------------------------------------------------ assistant ---- */}
        <aside
          className="ed-assistant"
          aria-label="Assistant"
          data-assistant={kids ? "denied" : assistantOpen ? "open" : "closed"}
        >
          <div className="ed-assistant-head">
            <span className="dot" aria-hidden="true" />
            <span>Assistant</span>
            <span className="ed-assistant-model mono">
              {kids ? "denied" : view.assistant.modelLabel}
            </span>
          </div>
          {kids ? (
            <div className="ed-assistant-lock">
              <p className="reason mono">{view.assistant.kidsDenyCode}</p>
              <p>
                Kids denies third-party model routes by default. Nothing crosses over
                from Game or Website.
              </p>
            </div>
          ) : (
            <>
              <p className="ed-note-block">
                No model provider adapter is configured on this surface, so nothing
                composes and nothing is sent. Every edit an assistant ever makes
                arrives as a proposal you review — it never writes to the scene
                directly.
              </p>
              <div className="ed-assistant-sees">
                {view.assistant.sees.map((fact) => (
                  <span key={fact} className="ed-chip">{fact}</span>
                ))}
              </div>
              <div className="ed-assistant-composer">
                <p className="ed-assistant-placeholder">Ask, or describe what to build…</p>
                <div className="ed-assistant-modes" role="group" aria-label="Assistant mode">
                  {view.assistant.modes.map((control) => (
                    <ShellButton
                      key={control.id}
                      control={control}
                      className="ed-assistant-mode"
                      pressed={assistantMode === control.id}
                      onClick={() => setAssistantMode(control.id)}
                    />
                  ))}
                  <ShellButton control={view.assistant.send} className="ed-primary" />
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* -------------------------------------------------- status bar --- */}
      <footer className="ed-status" aria-label="Editor status">
        <span className="ed-status-ready">
          <span className="dot" aria-hidden="true" />
          {view.statusBar.readiness}
        </span>
        <span className="mono">{profilePin}</span>
        <span className="ed-status-spacer" />
        <span className="mono">{view.statusBar.docLabel}</span>
        <span className="mono ed-status-entitle">
          {view.entitlement.mode === "preview" ? "preview session" : view.entitlement.basis}
        </span>
      </footer>

      {/* ---------------------------------------------------- palette ---- */}
      {paletteOpen && (
        <div className="ed-palette-scrim">
          <div className="ed-palette" role="dialog" aria-modal="true" aria-label="Command palette">
            <input
              ref={paletteRef}
              className="ed-palette-input"
              placeholder="Type a command…"
              aria-label="Filter commands"
            />
            {paletteGroups.map((group) => {
              const rows = view.palette.filter((row) => row.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group} className="ed-palette-group">
                  <p className="ed-palette-group-name">{group}</p>
                  {rows.map((row) => (
                    <div key={row.control.id} className="ed-palette-row">
                      <ShellButton
                        control={row.control}
                        className="ed-palette-action"
                        onClick={
                          row.control.id === "palette-open-compose"
                            ? () => {
                                enterMode("compose");
                                setPaletteOpen(false);
                              }
                            : undefined
                        }
                      />
                      {row.cliVerb !== null && (
                        <span className="mono ed-palette-verb">{row.cliVerb}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            <p className="ed-palette-foot">
              Everything here is also a CLI verb — the editor and the CLI drive the
              same protocol.
            </p>
            <button
              type="button"
              className="ed-ghost ed-palette-close"
              data-kind="view"
              onClick={() => {
                setPaletteOpen(false);
                paletteReturnFocus.current?.focus();
              }}
            >
              Close <kbd>ESC</kbd>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------- refusal legend ------ */}
      <div className="ed-legend" hidden>
        {view.refusalLegend.map((entry) => (
          <p key={entry.code} id={legendId(entry.code)}>
            {entry.code}: {entry.message}
          </p>
        ))}
      </div>
    </div>
  );
}
