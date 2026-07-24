# @sceneaxi/profile-kids

**MVP = refuse/isolation only; no Kids UI/product.**

Kids policy stub. The compiled policy records the locked full-isolation planes
and refuses shared or runtime-switchable modes. `evaluateKidsIsolation` checks
that boundary and refuses unknown planes.

The current LLM-route allowlist is empty. `evaluateKidsLlmRoute` refuses every
route, with a stable deny-by-default reason for third-party routes. The package
also executable-refuses external data planes, all commerce, non-Kids catalogs,
and every network destination (the MVP allowlist is empty). The package
does not encode an age band, purchaser/learner model, curriculum, or
jurisdiction; those remain separate decisions.
