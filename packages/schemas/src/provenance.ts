/**
 * Runtime-unforgeable provenance for values that may only originate inside a
 * trusted module.
 *
 * SceneAxi's fail-closed contracts are *structural*: a value is accepted when it
 * has the right shape. That is the correct default for anything crossing an
 * untrusted boundary, because shape is all a wire format carries. It is the
 * wrong default for a value whose whole meaning is "a trusted step produced
 * me" — a resolved admin identity, a signature-verified webhook — because the
 * shape of such a value is public, so any in-process caller can build one by
 * hand or reach it with an `as` cast.
 *
 * A witness closes that gap by remembering the **object identity** of every
 * value the trusted module issued, in a `WeakSet` no importer can reach. Nothing
 * is written onto the value, so structural validation, `Object.freeze`, and
 * `snapshotPlainRecord` all keep working unchanged — and, because identity is
 * what is remembered, every way of producing a look-alike produces a *different*
 * object and is refused: a plain literal, a spread copy, `Object.assign` into a
 * fresh target, `structuredClone`, a JSON round-trip, and a `Proxy` wrapper
 * alike. A symbol-keyed brand would not do this; spread and `Object.assign` copy
 * own enumerable symbol keys.
 *
 * The guarantee is deliberately in-process and non-transferable: a witness
 * cannot survive serialization, which is exactly right for evidence that means
 * "this process verified it". Anything that must cross a process boundary needs
 * a signature, not a witness.
 */

/**
 * The trusted module keeps the whole witness private and exports only what a
 * consumer needs — usually just a `holds` predicate. Handing out `issue` is
 * handing out the authority to mint the evidence.
 */
export type ProvenanceWitness<Value extends object> = Readonly<{
  /**
   * Freeze `value` and record it as issued. Returns the same object, so the
   * caller's reference is the witnessed one; a later copy of it is not.
   */
  issue<Issued extends Value>(value: Issued): Issued;
  /** Whether this exact object is one this witness issued. */
  holds(value: unknown): value is Value;
}>;

export function createProvenanceWitness<
  Value extends object,
>(): ProvenanceWitness<Value> {
  const issued = new WeakSet<object>();
  return Object.freeze({
    issue<Issued extends Value>(value: Issued): Issued {
      const frozen = Object.freeze(value);
      issued.add(frozen);
      return frozen;
    },
    holds(value: unknown): value is Value {
      if (value === null) return false;
      if (typeof value !== "object" && typeof value !== "function") {
        return false;
      }
      return issued.has(value as object);
    },
  });
}
