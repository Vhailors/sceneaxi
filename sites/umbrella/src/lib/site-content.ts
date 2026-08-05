/**
 * Product copy for the umbrella's marketing surfaces (sceneaxi#157).
 *
 * The surfaces this still serves are `/profiles`, `/engine`, `/docs`, `/pricing`,
 * `/account`, and the shared shell. That content is data, so it lives here in pure
 * TypeScript — the hermetic gate type-checks this module and `tests/sites/` asserts it,
 * which is what keeps a marketing sentence from quietly making a claim the contracts do
 * not.
 *
 * One rule governs everything below: **derive, do not restate.** Anything site-kit or
 * the identity plane already publishes is read at render time (starter allotment,
 * creator share, capability tiers, the live open path and its presentation vocabulary,
 * credit packs, the SDK archive's own facts). Nothing here re-types those numbers.
 *
 * sceneaxi#203 replaced the default route's feature tour, and the copy that only that
 * tour rendered — the sculpt-pass cards, the propose/apply diff illustration, the
 * terminal transcript, the CLI exit-code cards, and the family map — was removed with
 * it rather than left here reading as shipped product copy. Restating a contract this
 * tier may not import is only honest while a test pins the restatement to its owner and
 * a route renders it; an unrendered copy is neither.
 *
 * What is deliberately *not* here: installer names, download sizes, or digests for any
 * artifact this repository does not build; subscription tiers or seat prices; any
 * shipping claim; and any link to a Kids surface.
 */

/** A section kicker: the mono `01 — SCULPT` above a heading. */
export interface SectionMark {
  readonly n: string;
  readonly label: string;
}

/** One profile card on the overview. */
export interface ProfileCard {
  readonly name: string;
  readonly tag: string;
  readonly accent: "accent" | "web" | "iso";
  readonly desc: string;
  readonly points: readonly string[];
  /** Where the card links, or `null` for a card that must not be a link. */
  readonly href: string | null;
}

/**
 * The three profiles.
 *
 * Kids is described and never linked: it is a separate origin with its own identity,
 * and `resolveFamilyLinks` has no Kids entry to resolve, so its card carries no `href`
 * rather than a link this deployment cannot honestly produce.
 */
export const PROFILE_CARDS: readonly ProfileCard[] = Object.freeze([
  Object.freeze({
    name: "Game",
    tag: "Playable",
    accent: "accent" as const,
    desc: "Deterministic kernel session with save, step, and replay. Every run ends with a digest you can check.",
    points: Object.freeze([
      "Command/snapshot kernel session",
      "Animation sockets on the sculpt hierarchy",
      "Replay refuses on digest drift",
    ]),
    href: "/profiles",
  }),
  Object.freeze({
    name: "Web experience",
    tag: "Embeddable",
    accent: "web" as const,
    desc: "Interactive scenes and site chrome consumed as versioned packages. Not a CMS and not an app builder — deliberately.",
    points: Object.freeze([
      "Interactive experiences and shells",
      "Pinned, versioned packages",
      "Refuses out-of-scope SaaS patterns",
    ]),
    href: "/profiles",
  }),
  Object.freeze({
    name: "Kids",
    tag: "Isolated",
    accent: "iso" as const,
    desc: "A separate domain and origin with its own identity, storage, telemetry, and model routing. This site links to it from nowhere.",
    points: Object.freeze([
      "No shared login or cookie",
      "Third-party model defaults denied",
      "Nothing in the tree may depend on it",
    ]),
    href: null,
  }),
]);

/** One standing rule on the engine surface. */
export interface EngineNote {
  readonly title: string;
  readonly body: string;
  /** Selects a `.note-card-*` tint; each variant here has one in the stylesheet. */
  readonly tone: "plain" | "info" | "accent";
}

/**
 * The four standing engine rules.
 *
 * The renderer note states the settled ADR 0017 decision and the bound on it, read
 * from `LIVE_OPEN_PRESENTATION` at render time rather than paraphrased here.
 */
export const ENGINE_NOTES: readonly EngineNote[] = Object.freeze([
  Object.freeze({
    title: "Boundaries are executable",
    body: "A dependency matrix declares what each package may import, and the gate fails when a line is crossed. Nothing in the tree may depend on the Kids profile — that is enforced, not documented.",
    tone: "plain" as const,
  }),
  Object.freeze({
    title: "Text stays canonical",
    body: "No editor database becomes the source of truth. Every index or cache is a rebuildable projection of the text documents — delete it and you lose time, never work.",
    tone: "plain" as const,
  }),
  Object.freeze({
    title: "Plugins claim, they don't hook",
    body: "A plugin declares registered capability IDs in a manifest at a fixed path. Unknown IDs, engine imports, or an entrypoint that escapes its package are refused before any code runs.",
    tone: "accent" as const,
  }),
]);

/** One stage in the change pipeline strip. */
export interface PipelineStage {
  readonly n: string;
  readonly name: string;
  readonly desc: string;
  readonly bar: "ok" | "accent" | "info" | "iso";
}

/** How a change travels, from intake to a recorded run. */
export const PIPELINE: readonly PipelineStage[] = Object.freeze([
  Object.freeze({
    n: "01",
    name: "Intake",
    desc: "References plus a brief and its must-include list.",
    bar: "ok" as const,
  }),
  Object.freeze({
    n: "02",
    name: "Reconstruct",
    desc: "Deterministic passes into an object sculpt spec.",
    bar: "ok" as const,
  }),
  Object.freeze({
    n: "03",
    name: "Artifact",
    desc: "Canonical bytes, a fixed seed, and a bound digest.",
    bar: "accent" as const,
  }),
  Object.freeze({
    n: "04",
    name: "Compose",
    desc: "Instances placed into one openable scene.",
    bar: "iso" as const,
  }),
  Object.freeze({
    n: "05",
    name: "Propose",
    desc: "A readable diff against the current document.",
    bar: "accent" as const,
  }),
  Object.freeze({
    n: "06",
    name: "Run",
    desc: "One kernel session, recorded and replayable.",
    bar: "info" as const,
  }),
]);

/** One documented reason a sculpt is refused rather than delivered. */
export interface RefusalCode {
  readonly code: string;
  readonly what: string;
}

/**
 * Reconstruction refusal codes.
 *
 * These are the stable codes documented in `packages/authoring-core/README.md`. They
 * are shown because a refusal is a product feature here, not an error state to hide.
 */
export const REFUSAL_CODES: readonly RefusalCode[] = Object.freeze([
  Object.freeze({
    code: "invalid-intake",
    what: "The intake does not match the versioned contract. Nothing was attempted.",
  }),
  Object.freeze({
    code: "unsupported-intake-mode",
    what: "A valid envelope in a mode reconstruction does not support yet.",
  }),
  Object.freeze({
    code: "quality-gate-refused",
    what: "A named gate failed — component budget, hierarchy depth, or physical extent.",
  }),
  Object.freeze({
    code: "offline-agent-nondeterministic",
    what: "Two runs of identical input produced different output, so the result was discarded.",
  }),
  Object.freeze({
    code: "artifact-invalid",
    what: "The finished artifact failed its own validator, including a recomputed emit digest.",
  }),
]);

/** One durable fact about how credits behave on the account and checkout surfaces. */
export interface CreditLedgerFact {
  readonly title: string;
  readonly body: string;
}

/**
 * The credit model, in the product's own words (decision D5).
 *
 * The accepted archive assumes a seat subscription. SceneAxi has an **append-only credit
 * ledger** instead, and that difference is not cosmetic: it is why a balance is derived
 * rather than stored, why nothing on an account surface offers to edit one, and why a
 * retry of a settled purchase adds nothing a second time. These sentences exist so the
 * account and checkout surfaces describe that model from one place — a page that
 * paraphrased it would be the place a seat price eventually reappears.
 *
 * Nothing here restates a figure. Amounts, packs, and balances come from the billing
 * plane at render time.
 */
export const CREDIT_LEDGER_COPY = Object.freeze({
  model:
    "Credits are an append-only ledger, not a subscription and not a stored number you can edit. Every grant, purchase, and debit is one entry, and a balance is what those entries add up to — which is why an account has no balance field for anything to overwrite and why the history behind a figure can always be re-derived. There is no seat, no plan, no tier, and nothing that renews: you buy credits once and they do not expire.",
  balanceIsDerived:
    "This figure is the sum of the ledger's entries at the moment the page rendered, not a stored value. Nothing on this page can write to it.",
  unreadableLedger:
    "The ledger is the only source of truth for a balance, so a ledger this deployment cannot read refuses here rather than showing a number it could not verify. An unreadable ledger is never treated as a balance of zero.",
  retryIsNotASecondCharge:
    "Submitting a settled checkout again adds nothing a second time: the purchase is matched to the ledger entry it already produced, so a refreshed or resubmitted page cannot double-credit an account or double-charge it.",
});

/** The four properties an account or checkout surface may state about credits. */
export const CREDIT_LEDGER_FACTS: readonly CreditLedgerFact[] = Object.freeze([
  Object.freeze({
    title: "Append-only",
    body: "Entries are added, never edited or deleted. That is enforced in the billing code and again by a database trigger, so a balance cannot be quietly rewritten from either side.",
  }),
  Object.freeze({
    title: "Bought once, not rented",
    body: "A credit pack is a one-time purchase. Credits do not expire, nothing renews, and no part of this product is sold by the seat or by the month.",
  }),
  Object.freeze({
    title: "Spent only where it is stated",
    body: "Hosted AI generation debits credits. The engine SDK download, the CLI, the docs, the public open path, and bringing your own AI provider debit nothing at all.",
  }),
  Object.freeze({
    title: "Provisioned by the deployment",
    body: "A credit account is created once by the deployment's own store when a user authenticates. Payment events never invent an account, so an absent account refuses rather than appearing with a balance nobody granted.",
  }),
]);

/** A question and its answer on the pricing surface. */
export interface FaqEntry {
  readonly q: string;
  readonly a: string;
}

/**
 * Pricing questions.
 *
 * Every answer is one the repository can stand behind: the licence has not been
 * granted, live charging is held, catalog purchase is inert, and Three is the settled
 * product presentation core. None of them promises a plan, a seat price, or a date.
 */
export const PRICING_FAQ: readonly FaqEntry[] = Object.freeze([
  Object.freeze({
    q: "Is the engine open source?",
    a: "No. The SDK archive is source-available for evaluation and its packages are UNLICENSED — no licence file ships with the download, and no right to use, modify, copy, or redistribute is granted beyond evaluating it. A grant of rights is a separate decision that has not been made.",
  }),
  Object.freeze({
    q: "Can I install it from a registry?",
    a: "Not yet. These are private 0.0.0 bootstrap packages and this repository holds no registry publish authority, so there is no supported external install. Read the consumption contract in the archive before pinning anything.",
  }),
  Object.freeze({
    q: "Does anything leave my machine?",
    a: "Not on the free path. The CLI and your own provider key stay local, and the Model Provider Port refuses a missing policy, adapter, or capability rather than falling back to a default. Hosted AI is opt-in and is the path that meters credits.",
  }),
  Object.freeze({
    q: "What happens to my scenes if my credits run out?",
    a: "They are text documents on your disk and stay openable. Credits gate hosted work, never your files: no editor database becomes the source of truth, and that is a contract rather than a courtesy.",
  }),
  Object.freeze({
    q: "Can I sell what I sculpt?",
    a: "Selling through either storefront is not open. Catalog listings show a price and the creator share, but a purchase is structurally inert while marketplace activation remains an open captain decision, and both storefronts refuse it by name.",
  }),
  Object.freeze({
    q: "Are these charges real money?",
    a: "Credit-pack checkout runs against Stripe test mode on this deployment. Live mode needs an explicit captain authorization and the billing port refuses it without one, so a deployment cannot drift into charging by configuration alone.",
  }),
]);

/** A documentation rail group: a heading and the entries under it. */
export interface DocsRailGroup {
  readonly title: string;
  readonly items: ReadonlyArray<{ readonly name: string; readonly href: string }>;
}

/** The footer's link columns. */
export interface FooterColumn {
  readonly title: string;
  readonly items: ReadonlyArray<{ readonly name: string; readonly href: string }>;
}

/**
 * Footer navigation.
 *
 * Every entry resolves to a route this site actually serves. The accepted screen has
 * columns for changelogs, roadmaps, and company pages that do not exist here; a link
 * to a 404 is a broken promise, so those entries are not rendered.
 */
export const FOOTER_COLUMNS: readonly FooterColumn[] = Object.freeze([
  Object.freeze({
    title: "Product",
    items: Object.freeze([
      Object.freeze({ name: "Overview", href: "/" }),
      Object.freeze({ name: "Profiles", href: "/profiles" }),
      Object.freeze({ name: "Engine SDK", href: "/engine" }),
      Object.freeze({ name: "Pricing", href: "/pricing" }),
      Object.freeze({ name: "Login", href: "/login" }),
      Object.freeze({ name: "Account", href: "/account" }),
    ]),
  }),
  Object.freeze({
    title: "Developers",
    items: Object.freeze([
      Object.freeze({ name: "Contracts", href: "/docs" }),
      Object.freeze({ name: "Editor", href: "/editor" }),
      Object.freeze({ name: "Download", href: "/engine" }),
    ]),
  }),
]);

/** The shared early-access marker shown in the hero badge and the footer. */
export const RELEASE_MARKER = "Early access · 0.0.0";
