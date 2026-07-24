import { describe, expect, it } from "vitest";
import { parseUnambiguousJson } from "@sceneaxi/schemas";

describe("unambiguous JSON parser", () => {
  it("returns parsed values for unique-member JSON", () => {
    expect(parseUnambiguousJson('{"outer":{"value":1}}')).toEqual({
      ok: true,
      value: { outer: { value: 1 } },
    });
  });

  it("refuses escaped duplicate members with their path", () => {
    expect(
      parseUnambiguousJson('{"outer":{"source":1,"sour\\u0063e":2}}'),
    ).toMatchObject({
      ok: false,
      code: "duplicate-json-member",
      path: "$.outer.source",
    });
  });

  it("refuses malformed JSON separately from duplicate members", () => {
    expect(parseUnambiguousJson("{")).toMatchObject({
      ok: false,
      code: "parse-error",
    });
  });
});
