import { describe, expect, it } from "vitest";
import { computeDigest, open, replay } from "@sceneaxi/engine-kernel";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

it("keeps the kernel digest runtime browser-safe without Node crypto imports", () => {
    const directory = mkdtempSync(join(tmpdir(), "sceneaxi-kernel-browser-"));
    const loader = join(directory, "deny-crypto.mjs");
    writeFileSync(loader, `import { registerHooks } from "node:module";
      import { existsSync } from "node:fs";
      import { fileURLToPath, pathToFileURL } from "node:url";
      import { join } from "node:path";
      const root = ${JSON.stringify(process.cwd())};
      registerHooks({ resolve(specifier, context, next) {
        if (specifier === "crypto" || specifier === "node:crypto") throw Error("kernel digest runtime must be browser-safe");
        if (specifier.startsWith("@sceneaxi/")) {
          const [name, ...rest] = specifier.slice(10).split("/");
          specifier = pathToFileURL(join(root, "packages", name, "src", rest.length ? rest.join("/") + ".ts" : "index.ts")).href;
        } else if (specifier.endsWith(".js") && context.parentURL) {
          const source = new URL(specifier.slice(0, -3) + ".ts", context.parentURL);
          if (source.protocol === "file:" && existsSync(fileURLToPath(source))) specifier = source.href;
        }
        return next(specifier, context);
      }});`);

    try {
      const digestSource = new URL("../src/index.ts", import.meta.url).href;
      const output = execFileSync(process.execPath, ["--experimental-transform-types", "--import", loader, "--input-type=module", "-e", `import { computeDigest } from ${JSON.stringify(digestSource)}; console.log(computeDigest(0, 0, []));`], { encoding: "utf8" });
      expect(output.trim()).toBe("sha256:cda0711dbb7d296bdd0db3c2d7539eb412a93128e819dcd7ac997f7c664b1355");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
});

describe("LF-01 original three-argument digest", () => {
    it.each([{ "tick": 0, "seed": 0, "entities": [], "digest": "sha256:cda0711dbb7d296bdd0db3c2d7539eb412a93128e819dcd7ac997f7c664b1355" }, { "tick": 7, "seed": 42, "entities": [{ "id": "雪🚀", "x": -12, "y": 0 }, { "id": "a", "x": 1.5, "y": 0 }], "digest": "sha256:54cf93448d2acf1c3a3ae22701767694b6d14f6f0dbbe0f79b44144777e16e10" }, { "tick": 7, "seed": 42, "entities": [{ "id": "a", "x": 1.5, "y": 0 }, { "id": "雪🚀", "x": -12, "y": 0 }], "digest": "sha256:9771cf096655109bb5612b6671aff6831ccbc41346af467481d16a9c61477d6a" }])("pins original Git16f312 vector $digest", ({ tick, seed, entities, digest }) => {
        expect(computeDigest(tick, seed, entities)).toBe(digest);
    });
    it("keeps caller order, projects only id/x/y and does not mutate", () => {
        const entities = Object.freeze([Object.freeze({ id: "z", x: -3, y: 2, ignored: true }), Object.freeze({ id: "a", x: 0, y: 1 })]);
        expect(computeDigest(1, 2, entities)).not.toBe(computeDigest(1, 2, [...entities].reverse()));
        expect(computeDigest(1, 2, entities)).toBe(computeDigest(1, 2, entities.map(({ id, x, y }) => ({ id, x, y }))));
        expect(entities[0]?.id).toBe("z");
    });
    it("matches current no-rarity public session snapshots through save/replay", () => {
        const session = open({ productId: "legacy-digest", seed: 42, entities: [{ id: "z", x: -2, y: 1 }, { id: "a", x: 4, y: 0 }] }, { nowMs: () => 0 });

        for (const tick of [0, 1, 2]) {
            if (tick > 0)
                session.advance({ tick, deltaMs: 16 });
            const snapshot = session.observe();
            expect(computeDigest(snapshot.tick, snapshot.seed, snapshot.entities)).toBe(snapshot.digest);
        }

        expect(replay(session.save(), { nowMs: () => 0 }).observe()).toEqual(session.observe());
    });
});

it("refuses a missing entity array rather than silently hashing an empty map", () => {
    expect(() => runInNewContext("digest(0, 0, null)", { digest: computeDigest })).toThrow(TypeError);
});
