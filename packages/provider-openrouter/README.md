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

`createFixtureTransport` is an ordinary `OpenRouterTransport` that replays
recorded response envelopes, so a caller gets the whole adapter and port path —
pinning, attestation, response parsing, tool-argument validation — with no
credential, no `fetch`, and nothing that varies between runs. An operation with
no recorded response refuses (`OPENROUTER_FIXTURE_NOT_RECORDED`) rather than
returning a blank envelope a consumer would read as a model that answered
nothing. It attests the model it was built with, not the one it was asked for, so
a mismatched pin still refuses at the adapter.

Spending credits on a hosted call is a separate, default-off decision owned by
`@sceneaxi/billing` (`runMeteredModelCall`); this package never reads a balance.
`tests/e2e/hosted-ai-metering-golden.test.ts` wires the two together.
