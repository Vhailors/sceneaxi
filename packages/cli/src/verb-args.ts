/**
 * Verb-local argument parsing (flags with values + positionals).
 * Global flags are stripped by the dispatcher before verbs see argv.
 */

export type VerbArgs = {
  readonly flags: ReadonlyMap<string, string>;
  /**
   * Every occurrence of each valued flag, in argv order. `flags` keeps the
   * last occurrence (last-wins); verbs that accept a flag more than once
   * (e.g. `--artifact`) read it from here instead.
   */
  readonly repeated: ReadonlyMap<string, readonly string[]>;
  /** Boolean-style flags present without a value (e.g. --force). */
  readonly switches: ReadonlySet<string>;
  readonly positionals: readonly string[];
};

/**
 * Parse remaining argv after the command path.
 * Supports `--flag value`, `--flag=value`, and bare positionals.
 * Bare `-x` short flags without known global handling are treated as unknown
 * by the caller when not in the verb's allow list.
 */
export function parseVerbArgs(tokens: readonly string[]): VerbArgs {
  const flags = new Map<string, string>();
  const repeated = new Map<string, string[]>();
  const switches = new Set<string>();
  const positionals: string[] = [];

  const record = (name: string, value: string): void => {
    flags.set(name, value);
    const seen = repeated.get(name);
    if (seen === undefined) repeated.set(name, [value]);
    else seen.push(value);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) continue;

    if (token === "--") {
      positionals.push(...tokens.slice(i + 1));
      break;
    }

    if (token.startsWith("--") && token.includes("=")) {
      const eq = token.indexOf("=");
      const name = token.slice(0, eq);
      const value = token.slice(eq + 1);
      record(name, value);
      continue;
    }

    if (token.startsWith("--")) {
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        record(token, next);
        i += 1;
      } else {
        switches.add(token);
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      // Short flag cluster or short with value — treat as switch; verbs refuse unknowns.
      switches.add(token);
      continue;
    }

    positionals.push(token);
  }

  return {
    flags,
    repeated: new Map(
      [...repeated].map(([name, values]) => [name, Object.freeze(values)]),
    ),
    switches,
    positionals: Object.freeze(positionals),
  };
}

/** Every occurrence of a repeatable valued flag, in argv order. */
export function repeatedFlag(args: VerbArgs, name: string): readonly string[] {
  return args.repeated.get(name) ?? [];
}

/** Require a string flag; return error message if missing (or empty unless allowed). */
export function requireFlag(
  args: VerbArgs,
  name: string,
  options: { readonly allowEmpty?: boolean } = {},
): { ok: true; value: string } | { ok: false; message: string } {
  const value = args.flags.get(name);
  if (value === undefined) {
    return {
      ok: false,
      message: `Missing required flag ${name}`,
    };
  }
  if (value.length === 0 && options.allowEmpty !== true) {
    return {
      ok: false,
      message: `Missing required flag ${name}`,
    };
  }
  return { ok: true, value };
}
