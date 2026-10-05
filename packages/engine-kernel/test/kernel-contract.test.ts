import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { open, replay } from "@sceneaxi/engine-kernel";

type Shape = { pattern?: string; maximum?: number; minimum?: number; maxLength?: number; maxItems?: number; properties?: Record<string, Shape>; items?: Shape; oneOf?: readonly Shape[]; required?: readonly string[] };

const schema = JSON.parse(readFileSync(new URL("../../schemas/contracts/kernel-session.schema.json",import.meta.url),"utf8")) as Shape;

const child=(s:Shape,key:string)=>{const v=s.properties?.[key];

if(!v)throw Error("Contract property absent: "+key);

return v;};

const item=(s:Shape)=>{if(!s.items)throw Error("Contract items absent");

return s.items;};

describe("numeric/union/version JSON contract lockstep",()=>{
  it("pins the deliberately supported same-major version table and rejects unsupported majors",()=>{
    const save=open({productId:"contract",seed:1},{nowMs:()=>1}).save();

    for(const field of ["kernelVersion","bomVersion"] as const){const pattern=child(schema,field).pattern;

if(!pattern)throw Error("Version pattern absent");const regex=new RegExp(pattern);

      for(const version of ["0.0.0","0.1.9","0.999.999"]){expect(regex.test(version)).toBe(true);expect(replay({...save,[field]:version},{nowMs:()=>1}).observe().digest).toBe(save.terminalDigest);}

      for(const version of ["1.0.0","99.0.0","00.0.0"]){expect(regex.test(version)).toBe(false);expect(()=>replay({...save,[field]:version},{nowMs:()=>1})).toThrow();}
    }
  });
  it("pins ID/entity/coordinate/event budgets to the executable kernel oracles",()=>{
    const manifest=child(schema,"productManifest");expect(child(manifest,"productId").maxLength).toBe(128);expect(child(manifest,"seed")).toMatchObject({minimum:-Number.MAX_SAFE_INTEGER,maximum:Number.MAX_SAFE_INTEGER});
    const entities=child(manifest,"entities");expect(entities.maxItems).toBe(4096);

for(const field of ["x","y"])expect(child(item(entities),field)).toMatchObject({minimum:-1000000,maximum:1000000});expect(child(item(entities),"id").maxLength).toBe(128);expect(child(schema,"events").maxItems).toBe(100000);
  });
  it("pins two-component commands, bounded clocks and action as a required union arm",()=>{
    const event=item(child(schema,"events")),command=child(event,"command");

    for(const field of ["axis","position"]){const pair=child(command,field);expect(pair.maxItems).toBe(2);expect(item(pair)).toMatchObject({minimum:-1000000,maximum:1000000});}

    expect(child(child(event,"clock"),"tick")).toMatchObject({minimum:1,maximum:Number.MAX_SAFE_INTEGER});expect(child(child(event,"clock"),"deltaMs")).toMatchObject({minimum:0,maximum:60000});expect(command.oneOf?.map(arm=>arm.required)).toContainEqual(["type","actionId"]);
  });
});
