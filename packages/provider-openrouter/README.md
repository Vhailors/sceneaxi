# @sceneaxi/provider-openrouter

Thin OpenRouter adapter behind `@sceneaxi/authoring-core`'s Model Provider Port
(sceneaxi#46). It requires an exact provider/model/quantization/version pin and
a deterministic `allowFallbacks: false`, `temperature: 0` eval configuration.

The package owns no credentials and performs no network I/O: callers inject a
transport. Repository tests use recorded fixtures only. The adapter is a
third-party route, so the port's non-overridable Kids denial runs before its
transport. This is adapter plumbing, not a production LLM-readiness claim.
