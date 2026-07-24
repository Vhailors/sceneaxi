# @sceneaxi/provider-openrouter

Thin OpenRouter adapter behind `@sceneaxi/authoring-core`'s Model Provider Port
(sceneaxi#46). It requires an exact provider/model/quantization/version pin and
a deterministic `allowFallbacks: false`, `temperature: 0` eval configuration.
The injected transport receives that full descriptor and must return the
executed descriptor it attested; the adapter rejects missing or mismatched
provider, model, quantization, or version evidence.

The package owns no credentials and implements no network transport: callers
inject one. Repository tests use recorded fixtures only. The adapter is a
third-party route, so the port's non-overridable Kids denial runs before its
transport. This is adapter plumbing, not a production LLM-readiness claim.
