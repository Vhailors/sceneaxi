# @sceneaxi/profile-kids

Kids policy stub. The compiled policy records the locked full-isolation planes
and refuses shared or runtime-switchable modes. `evaluateKidsIsolation` checks
that boundary and refuses unknown planes.

The current LLM-route allowlist is empty. `evaluateKidsLlmRoute` refuses every
route, with a stable deny-by-default reason for third-party routes. The package
does not encode an age band, purchaser/learner model, curriculum, or
jurisdiction; those remain separate decisions.
