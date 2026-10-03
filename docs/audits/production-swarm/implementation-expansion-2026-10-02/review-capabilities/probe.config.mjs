import base from "../unsigned-project-build/focused.config.ts";

export default { ...base, test: { ...base.test, include: ["docs/audits/production-swarm/implementation-expansion-2026-10-02/review-capabilities/*.test.mjs"] } };
