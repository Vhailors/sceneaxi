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
 * to inert, withdraws the command palette and its rows — the opener demoted with
 * the policy's own code, ⌘K opening nothing, any open overlay closed — and keeps exactly
 * the controls that leave the state live: a refuse-only state is a state you can
 * leave and nothing else. That is the same refuse-only behaviour the desktop
 * chrome records, and every code and state it prints comes off the view.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  EditorShellControl,
  EditorShellView,
  MountableScene,
  WebExperienceEditorView,
} from "@sceneaxi/site-kit";
import { EditorViewport } from "./editor-viewport.js";
import { WebExperienceEditor } from "./web-experience-editor.js";

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

/**
 * The query-parameter name a live form control submits under, taken from the
 * control's own binding so the transport is never respelled in JSX.
 */
const fieldName = (control: EditorShellControl): string =>
  control.binding !== null && control.binding.kind === "form-field"
    ? control.binding.field
    : "";

/**
 * The mode the reader is working in, read by every href the shell renders.
 *
 * Mode is view state and switches client-side, so a server-rendered href cannot
 * know it: the page was built in whatever mode the URL named. Every `live`
 * control is a full-page navigation, so without this the reader is dropped back
 * into the URL's mode on the very click they made — Run's own Play control would
 * navigate away from the panel that shows its result. Carrying it changes no
 * engine behaviour: `mode` names no session operation, and the server renders the
 * same session in all seven.
 */
const ActiveModeContext = createContext<ModeId | null>(null);

/**
 * The same href in the mode the reader is in. Only a link that already carries
 * the parameter is rewritten, so the wordmark's `/` and any other off-editor
 * destination is handed back untouched.
 */
function hrefInMode(href: string, mode: ModeId | null): string {
  if (mode === null) return href;
  const [path, query] = href.split("?");
  if (path === undefined || query === undefined) return href;
  const params = new URLSearchParams(query);
  if (!params.has("mode")) return href;
  params.set("mode", mode);
  return `${path}?${params.toString()}`;
}

/** The one panel every viewport-source tab controls. */
const VIEWPORT_PANEL_ID = "ed-viewport-panel";
/**
 * One dock panel exists at a time, so every dock tab controls the one panel
 * element the body always renders — an `aria-controls` per tab would name four
 * IDREFs of which three resolve to nothing.
 */
const DOCK_PANEL_ID = "ed-dock-panel";

/**
 * Every interactive element goes through this one helper, so a control cannot
 * reach the document without its kind and its refusal wiring — the invariant
 * the desktop chrome enforces with its own `button()` helper.
 */
function ShellButton({
  control,
  className,
  demotedRefusal,
  profileRefusal,
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
  /** A non-Kids profile may also narrow desktop chrome without changing its policy code. */
  readonly profileRefusal?: string | undefined;
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
  const inert =
    control.kind === "inert" ||
    demotedRefusal !== undefined ||
    profileRefusal !== undefined;
  const refusal =
    control.kind === "inert"
      ? control.refusal
      : (demotedRefusal ?? profileRefusal ?? null);
  const binding = control.binding;
  const activeMode = useContext(ActiveModeContext);

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
      <a id={control.id} href={hrefInMode(binding.href, activeMode)} {...shared}>
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
  initialProfile,
  viewportCopy,
  webView,
}: {
  readonly view: EditorShellView;
  readonly scene: MountableScene | null;
  readonly selectedInstanceId: string;
  readonly deepLinkFields: ReadonlyArray<{ readonly name: string; readonly value: string }>;
  readonly initialProfile: "game" | "web";
  readonly webView: WebExperienceEditorView;
  /**
   * The viewport copy is owned by `src/lib/editor-viewport.ts` and arrives as a
   * prop because a client component must not import the Node-bearing site-kit
   * root barrel that module reads its vocabulary from.
   */
  readonly viewportCopy: Readonly<{ lede: string; honesty: string; notComposable: string }>;
}) {
  // The mode the request's URL state names, so a live control's own navigation
  // comes back in the mode the reader was working in.
  const [mode, setMode] = useState<ModeId>(view.activeModeId);
  const [dockTab, setDockTab] = useState<DockTabId>("changes");
  const [profile, setProfile] = useState<ProfileId>(initialProfile);
  const [assistantOpen, setAssistantOpen] = useState(view.assistant.state === "open");
  const [assistantMode, setAssistantMode] = useState(view.assistant.defaultModeId);
  const [paletteRequested, setPaletteRequested] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const paletteRef = useRef<HTMLInputElement | null>(null);
  const paletteReturnFocus = useRef<HTMLElement | null>(null);

  const fallbackMode = view.modes[0];
  if (fallbackMode === undefined) {
    throw new Error("The editor shell view carries no modes.");
  }
  const activeMode =
    view.modes.find((candidate) => candidate.id === mode) ?? fallbackMode;
  const kids = profile === "kids";
  const web = profile === "web";
  /**
   * The palette is part of the editor body the refuse-only profile withdraws, so
   * Kids is what decides whether it is open at all — not a second piece of state
   * a keystroke could set behind the lock. Everything the overlay offers, the
   * live play row included, is therefore unreachable while Kids is selected.
   */
  const paletteOpen = paletteRequested && !kids;
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

  // ⌘K / Ctrl+K opens the palette; Escape closes it and returns focus. Under the
  // Kids lock the shortcut opens nothing, the same as the demoted opener.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (kids) return;
        if (web) return;
        event.preventDefault();
        // Only the keystroke that opens the palette records where focus came
        // from. While it is open the rest of the chrome is `inert`, so
        // `activeElement` is the palette's own input — capturing that would
        // hand the close effect an element React is about to unmount.
        if (!paletteOpen) {
          paletteReturnFocus.current = document.activeElement as HTMLElement;
        }
        setPaletteRequested(true);
      } else if (event.key === "Escape" && paletteOpen) {
        setPaletteRequested(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen, kids, web]);

  /**
   * Focus moves in this effect rather than in the close handlers, because the
   * regions the return target lives in carry `inert` while the palette is open:
   * a synchronous `focus()` from a handler runs before React has committed that
   * attribute away, and focusing into an inert subtree is a no-op. Here the
   * commit has already happened, so the opener really takes focus back.
   */
  useEffect(() => {
    if (paletteOpen) {
      paletteRef.current?.focus();
      return;
    }
    setPaletteQuery("");
    paletteReturnFocus.current?.focus();
    paletteReturnFocus.current = null;
  }, [paletteOpen]);

  // Entering the refuse-only profile withdraws the request too, so leaving it
  // again returns to the editor rather than to a palette held open behind it.
  useEffect(() => {
    if (kids || web) setPaletteRequested(false);
  }, [kids, web]);

  const profilePin =
    view.profiles.find((chip) => chip.id === profile)?.statusPin ??
    view.statusBar.profilePin;

  /**
   * The rows the typed filter leaves, matched on what the row shows: its label
   * and the CLI verb printed beside it. An input that advertises filtering has
   * to filter, so this is real client work over view data — it decides nothing
   * about what a row is, only whether this reader asked to see it.
   */
  const paletteNeedle = paletteQuery.trim().toLowerCase();
  const paletteRows =
    paletteNeedle === ""
      ? view.palette
      : view.palette.filter((row) =>
          `${row.control.label} ${row.cliVerb ?? ""}`.toLowerCase().includes(paletteNeedle),
        );

  /** Palette groups in the view's own mint order — the view decides the set. */
  const paletteGroups = paletteRows.reduce<readonly string[]>(
    (groups, row) => (groups.includes(row.group) ? groups : [...groups, row.group]),
    [],
  );

  const dockTabs = activeMode.dockTabs;
  const shownDockTab: DockTabId = dockTabs.includes(dockTab) ? dockTab : (dockTabs[0] ?? "console");

  return (
    /*
      Every href the shell renders is rebuilt in the mode the reader is in, so a
      live control's own navigation returns to the mode it was clicked from.
    */
    <ActiveModeContext value={mode}>
      <div className="edshell" data-mode={mode} data-profile={profile}>
        {/*
          The chrome depicts an application, so it draws no page title — but the
          route is still a document, and its panel heads are its second level.
          The name is carried for assistive technology only.
        */}
        <h1 className="ed-shell-title">SceneAxi Engine Desktop editor</h1>
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
        <header className="ed-titlebar" aria-label="Editor title bar" inert={paletteOpen}>
          <a className="ed-wordmark" href="/" aria-label="SceneAxi home" data-kind="view">
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
            <span className="ed-project-save">{view.changes.savedLabel}</span>
          </div>
          <div className="ed-title-actions">
            <ShellButton
              control={view.paletteOpener}
              className="ed-search"
              demotedRefusal={kids ? view.kidsLock.code : undefined}
              profileRefusal={web ? webView.desktopOnlyRefusal.code : undefined}
              onClick={(event) => {
                paletteReturnFocus.current = event.currentTarget;
                setPaletteRequested(true);
              }}
            >
              {view.paletteOpener.label} <kbd>⌘K</kbd>
            </ShellButton>
            <ShellButton
              control={view.assistant.toggle}
              className="ed-assistant-toggle"
              demotedRefusal={kids ? view.kidsLock.code : undefined}
              profileRefusal={web ? webView.desktopOnlyRefusal.code : undefined}
              pressed={assistantOpen}
              onClick={() => setAssistantOpen((open) => !open)}
            >
              <span className="dot" aria-hidden="true" />
              Assistant
            </ShellButton>
          </div>
        </header>

        <div className="ed-body" inert={paletteOpen}>
          {/* ---------------------------------------------- mode rail ------ */}
          <nav className="ed-rail" aria-label="Editor modes">
            <span className="ed-rail-mark" aria-hidden="true" />
            {view.modes.map((entry) => (
              <ShellButton
                key={entry.control.id}
                control={entry.control}
                className="ed-rail-mode"
                demotedRefusal={kids ? view.kidsLock.code : undefined}
                profileRefusal={web ? webView.desktopOnlyRefusal.code : undefined}
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
          ) : web ? (
            <WebExperienceEditor view={webView} scene={scene} />
          ) : (
            <>
              {/* -------------------------------------------- left dock ---- */}
              <aside className="ed-left" aria-label="Scene panels">
                {mode === "sculpt" ? (
                  <>
                    <h2 className="ed-panel-head">
                      <span>SCULPT LIBRARY</span>
                      <span className="hint">{view.sculpt.library.length}</span>
                    </h2>
                    <ul className="ed-library">
                      {view.sculpt.library.map((item) => (
                        <li key={item.artifactId}>
                          <span className="ed-lib-name">{item.artifactId}</span>
                          <span className="ed-lib-digest">{item.digestShort}</span>
                          <span className="ed-lib-count">×{item.mountCount} mounted</span>
                        </li>
                      ))}
                    </ul>
                    <h2 className="ed-panel-head">
                      <span>RUN HISTORY</span>
                    </h2>
                    <p className="ed-run-history">{view.sculpt.runOutcome}</p>
                  </>
                ) : mode === "run" ? (
                  <>
                    <h2 className="ed-panel-head">
                      <span>RUNTIME</span>
                    </h2>
                    {/*
                      The transport for both is a link back to /editor: play and
                      step run on the server, and stopping ends this session
                      rather than pausing an advanced one, which is what each
                      control's binding declares.
                    */}
                    <div className="ed-run-controls">
                      <ShellButton control={view.run.playPause} className="ed-primary" />
                      <ShellButton control={view.run.reset} className="ed-ghost" />
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
                    <h2 className="ed-panel-head">
                      <span>SIMULATED BODIES</span>
                      <span className="hint">{view.run.bodies.length}</span>
                    </h2>
                    <ul className="ed-bodies">
                      {view.run.bodies.map((body) => (
                        <li key={body.instanceId}>
                          <span className="ed-body-name">{body.instanceId}</span>
                          <span className="mono">{body.translation}</span>
                          <span className="ed-body-state">{body.state}</span>
                        </li>
                      ))}
                    </ul>
                    <h2 className="ed-panel-head">
                      <span>REPLAY</span>
                    </h2>
                    <p className="ed-note-block">
                      Every session records its advances and ends with a digest. Replay
                      re-runs the exact sequence; a differing digest refuses, never
                      smoothed over.
                    </p>
                  </>
                ) : mode === "plugins" ? (
                  <>
                    <h2 className="ed-panel-head">
                      <span>LOADED</span>
                      <span className="hint">{view.plugins.loaded.length}</span>
                    </h2>
                    <p className="ed-note-block">
                      No plugin is loaded on this surface. The host and its isolation
                      rules live behind the plugin capability registry.
                    </p>
                    <h2 className="ed-panel-head">
                      <span>REGISTRY</span>
                      <span className="hint">{view.plugins.registry.length}</span>
                    </h2>
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
                    <h2 className="ed-panel-head">
                      <span>{mode === "compose" ? "SCENE INSTANCES" : "SCENE"}</span>
                      <span className="hint">{view.tree.length}</span>
                    </h2>
                    <ul className="ed-tree" aria-label="Scene tree">
                      {view.tree.map((row) => (
                        <li
                          key={row.id}
                          className={row.selected ? "is-selected" : undefined}
                          style={{ paddingLeft: `${10 + row.depth * 14}px` }}
                        >
                          {row.select === null ? (
                            <span className="ed-tree-label">{row.label}</span>
                          ) : (
                            <ShellButton control={row.select} className="ed-tree-label" />
                          )}
                          <span className="ed-tree-kind">{row.kindLabel}</span>
                        </li>
                      ))}
                    </ul>
                    <h2 className="ed-panel-head">
                      <span>LAYERS</span>
                      <span className="hint">{view.layers.length}</span>
                    </h2>
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

                {/*
                  The viewport's own copy rides with the viewport in every mode,
                  not only in Run: what the canvas draws and what it deliberately
                  does not do is true of every mode, and the ADR 0017 core it names
                  is the same core throughout.
                */}
                <div className="ed-viewport-note">
                  <p className="ed-viewport-lede">{viewportCopy.lede}</p>
                  <p>{viewportCopy.honesty}</p>
                  {view.deepLink !== null && (
                    <p className="ed-viewport-deeplink">
                      <span className="mono">
                        {view.deepLink.source} · {view.deepLink.itemId}
                        {view.deepLink.artifactRef === null
                          ? ""
                          : ` · ${view.deepLink.artifactRef}`}
                      </span>{" "}
                      {view.deepLink.note}
                    </p>
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
                          aria-controls={DOCK_PANEL_ID}
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

                  <div
                    className="ed-dock-body"
                    id={DOCK_PANEL_ID}
                    role="tabpanel"
                    tabIndex={0}
                    aria-labelledby={`dock-${shownDockTab}`}
                  >
                    {shownDockTab === "changes" && (
                      <div>
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
                            <p className="ed-dock-lede">{view.changes.persistenceNote}</p>
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
                                {view.changes.review.rows.map((row) => {
                                  const decision = view.changes.rowDecisions.find(
                                    (candidate) => candidate.index === row.index,
                                  );
                                  return (
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
                                      <td className="mono">
                                        <span className="ed-cr-state">applied</span>
                                        {decision !== undefined && (
                                          <span className="ed-cr-decisions">
                                            <ShellButton
                                              control={decision.reject}
                                              className="ed-cr-decide"
                                            >
                                              <span aria-hidden="true">✕</span>
                                              <span className="ed-cr-decide-name">
                                                {decision.reject.label}
                                              </span>
                                            </ShellButton>
                                            <ShellButton
                                              control={decision.accept}
                                              className="ed-cr-decide"
                                            >
                                              <span aria-hidden="true">✓</span>
                                              <span className="ed-cr-decide-name">
                                                {decision.accept.label}
                                              </span>
                                            </ShellButton>
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
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
                      <div>
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
                      <div>
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
                      <div>
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
                      <div>
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
                    <h2 className="ed-panel-head">
                      <span>SCULPT OBJECT</span>
                      <span className="hint">deterministic</span>
                    </h2>
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
                    <h2 className="ed-panel-head">
                      <span>DELIVERY HANDOFF</span>
                      <span className="hint">contract</span>
                    </h2>
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
                    <h2 className="ed-panel-head">
                      <span>PLUGIN HOST</span>
                      <span className="hint">isolation</span>
                    </h2>
                    <p className="ed-note-block">
                      The host exposes a capability table, not a hook bus. A plugin may
                      only claim IDs already in the registry — a new capability needs a
                      public contract first, not a new manifest string.
                    </p>
                    <ShellButton control={view.plugins.loadPlugin} className="ed-primary ed-insp-cta" />
                  </>
                ) : (
                  <>
                    <h2 className="ed-panel-head">
                      <span>{mode === "run" ? "LIVE VALUES" : "PROPERTIES"}</span>
                      <span className="hint">
                        {mode === "run" ? "read only" : "1 selected"}
                      </span>
                    </h2>
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
                        {/* A submit is a navigation too, so it carries the mode
                            the reader is in, exactly like every link above. */}
                        <input type="hidden" name="mode" value={mode} />
                        {/*
                          A form control is an interactive element too, so each one
                          wears the id and the kind its minted control declares —
                          the accounting index and the DOM then name the same four
                          live edit controls instead of one.
                        */}
                        <div className="ed-field">
                          <label htmlFor={view.edit.selection.id}>
                            {view.edit.selection.label}
                          </label>
                          <select
                            id={view.edit.selection.id}
                            data-kind={view.edit.selection.kind}
                            name={fieldName(view.edit.selection)}
                            defaultValue={selectedInstanceId}
                          >
                            {view.run.bodies.map((body) => (
                              <option key={body.instanceId} value={body.instanceId}>
                                {body.instanceId}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="ed-field">
                          <label htmlFor={view.edit.translation.id}>Translation (x,y,z)</label>
                          <input
                            id={view.edit.translation.id}
                            data-kind={view.edit.translation.kind}
                            name={fieldName(view.edit.translation)}
                            defaultValue={
                              view.run.bodies.find((body) => body.instanceId === selectedInstanceId)
                                ?.translation.replaceAll(" ", "") ?? "0,0,0"
                            }
                          />
                        </div>
                        <div className="ed-field">
                          <label htmlFor={view.edit.objects.id}>{view.edit.objects.label}</label>
                          <input
                            id={view.edit.objects.id}
                            data-kind={view.edit.objects.kind}
                            name={fieldName(view.edit.objects)}
                            type="number"
                            min={view.edit.objectBounds.min}
                            max={view.edit.objectBounds.max}
                            defaultValue={view.run.objectCount}
                          />
                        </div>
                        <button
                          id={view.edit.apply.id}
                          className="ed-primary"
                          type="submit"
                          data-kind={view.edit.apply.kind}
                        >
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
          {!web && <aside
            className="ed-assistant"
            aria-label="Assistant"
            data-assistant={
              kids ? view.assistant.kidsState : assistantOpen ? view.assistant.state : "closed"
            }
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
          </aside>}
        </div>

        {/* -------------------------------------------------- status bar --- */}
        <footer className="ed-status" aria-label="Editor status" inert={paletteOpen}>
          <span className="ed-status-ready">
            <span className="dot" aria-hidden="true" />
            {view.statusBar.readiness}
          </span>
          <span className="mono">{profilePin}</span>
          <span className="mono">{view.changes.persistencePin}</span>
          <span className="ed-status-spacer" />
          <span className="mono">{view.statusBar.docLabel}</span>
          <span className="mono ed-status-entitle">
            {view.entitlement.mode === "preview" ? "preview session" : view.entitlement.basis}
          </span>
        </footer>

        {/* ---------------------------------------------------- palette ---- */}
        {paletteOpen && !web && (
          <div className="ed-palette-scrim">
            <div className="ed-palette" role="dialog" aria-modal="true" aria-label="Command palette">
              <input
                ref={paletteRef}
                className="ed-palette-input"
                placeholder="Type a command…"
                aria-label="Filter commands"
                data-kind="view"
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
              />
              {paletteRows.length === 0 && (
                <p className="ed-palette-empty">No command matches “{paletteQuery.trim()}”.</p>
              )}
              {paletteGroups.map((group) => {
                const rows = paletteRows.filter((row) => row.group === group);
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
                                  setPaletteRequested(false);
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
                onClick={() => setPaletteRequested(false)}
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
          <p id={legendId(webView.desktopOnlyRefusal.code)}>
            {webView.desktopOnlyRefusal.code}: {webView.desktopOnlyRefusal.message}
          </p>
        </div>
      </div>
    </ActiveModeContext>
  );
}
