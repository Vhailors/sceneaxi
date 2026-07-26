/**
 * Negative fixture: declares the registered capability
 * `sceneaxi.sculpt.intake-source.v1` but exports a table entry that does not
 * satisfy that capability's public contract (no `produceIntake`, wrong
 * `contractVersion`). Declaring a real ID is not the same as implementing it,
 * so the host refuses with `capability-contract-violation` and exposes nothing.
 */
export const capabilities = Object.freeze({
  "sceneaxi.sculpt.intake-source.v1": Object.freeze({
    capabilityId: "sceneaxi.sculpt.intake-source.v1",
    contractVersion: "0.0.1",
    supportedModes: ["image+brief"],
  }),
});
