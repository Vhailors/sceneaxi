import { SITE_STARTER_CREDIT_ALLOTMENT } from "@sceneaxi/site-kit";

export interface HelpDoc {
  readonly slug: string;
  readonly title: string;
  readonly sections: readonly { readonly heading: string; readonly body: string }[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

export const HELP_DOCS: readonly HelpDoc[] = Object.freeze([
  {
    slug: "getting-started",
    title: "Getting started",
    sections: [
      { heading: "Install the desktop app", body: "Get the desktop app from the /engine page." },
      { heading: "Open a scene", body: "Open a scene at /open. This public path does not require an account or credits." },
      { heading: "Sign in and edit", body: "Sign in at /login to access the entitled web editor. The editor requires a valid session and the configured identity and credits plane." },
    ],
    links: [
      { label: "Engine downloads", href: "/engine" },
      { label: "Open a scene", href: "/open" },
      { label: "Sign in", href: "/login" },
      { label: "Web editor", href: "/editor" },
    ],
  },
  {
    slug: "credits-and-pricing",
    title: "Credits and pricing",
    sections: [
      { heading: "Credits", body: "Credits are an append-only ledger, not a subscription or seat plan. A balance is derived from its entries, and credits do not expire." },
      { heading: "Starter allotment", body: `Each new user receives ${SITE_STARTER_CREDIT_ALLOTMENT} credits once, on the first authenticated balance read. A repeated grant attempt adds nothing.` },
      { heading: "Refunds", body: "Full TEST-mode credit-pack refunds can append a negative ledger adjustment when the original grant and matching evidence are present. Partial refunds are not reconciled to the ledger. LIVE refunds are not available. Other refund policy is not yet decided." },
      { heading: "Prices", body: "Credit-pack prices shown by the site come from the billing catalog. Live price identifiers and live-mode activation are not yet decided." },
    ],
    links: [
      { label: "Credit packs", href: "/pricing" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    slug: "cli",
    title: "Command-line interface",
    sections: [
      { heading: "Commands", body: "Run sceneaxi --help to see project, scene, asset, profile, catalog, evidence, desktop, demo, and protocol, plus the global --json, --help, and --version flags. Group and verb help show their available commands and usage." },
      { heading: "Free and BYO-AI", body: "The CLI costs zero credits. Local authoring can use your own AI provider through an explicitly configured provider; missing policy, adapter, or capability refuses rather than selecting a default." },
    ],
    links: [
      { label: "Engine SDK", href: "/engine" },
      { label: "CLI contract", href: "https://github.com/Vhailors/sceneaxi/blob/main/packages/cli/README.md" },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    sections: [
      { heading: "Can I open a scene without signing in?", body: "Yes. The public /open path needs no account and consumes no credits." },
      { heading: "Does the web editor require sign-in?", body: "The web editor is an entitled surface. Hosted sign-in and the identity provider must be configured; otherwise access refuses by name." },
      { heading: "Do CLI commands use hosted AI or credits by default?", body: "No. The CLI is free, and provider use is explicit. It does not fall back to a third-party model default." },
      { heading: "Are refund and live pricing policies final?", body: "No. The documented TEST full-refund behavior is bounded. Broader refund policy and live prices are not yet decided." },
    ],
    links: [
      { label: "Open a scene", href: "/open" },
      { label: "Credits and pricing", href: "/docs/credits-and-pricing" },
      { label: "Sign in", href: "/login" },
    ],
  },
]);
