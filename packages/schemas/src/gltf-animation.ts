import { digestSculptJson } from "./sculpt-json.js";

export type GltfAnimationPath = "translation" | "rotation" | "scale";
export type GltfAnimationInterpolation = "LINEAR" | "STEP";
export type GltfAnimationChannel = Readonly<{
  node: number;
  path: GltfAnimationPath;
  interpolation: GltfAnimationInterpolation;
  times: readonly number[];
  values: readonly number[];
}>;
export type GltfAnimationClip = Readonly<{ name: string; channels: readonly GltfAnimationChannel[]; duration: number }>;
export type GltfAnimationPose = Readonly<{ node: number; translation?: readonly [number, number, number]; rotation?: readonly [number, number, number, number]; scale?: readonly [number, number, number] }>;
export type GltfAnimationEvaluation = Readonly<{ poses: readonly GltfAnimationPose[]; digest: string }>;


function at(values: readonly number[], index: number) {
  const value = values[index];
  if (value === undefined) throw new Error("Validated animation samples must contain the expected components.");
  return value;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function slerp(a: readonly number[], b: readonly number[], t: number): readonly [number, number, number, number] {
  let cosine = at(a, 0) * at(b, 0) + at(a, 1) * at(b, 1) + at(a, 2) * at(b, 2) + at(a, 3) * at(b, 3);
  const end = cosine < 0 ? b.map((value) => -value) : b;
  cosine = Math.abs(cosine);
  if (cosine > 0.9995) {
    const value = a.map((component, index) => lerp(component, at(end, index), t));
    const length = Math.hypot(...value);
    return Object.freeze(value.map((component) => component / length) as [number, number, number, number]);
  }
  const angle = Math.acos(Math.min(1, cosine));
  const left = Math.sin((1 - t) * angle) / Math.sin(angle);
  const right = Math.sin(t * angle) / Math.sin(angle);
  return Object.freeze(a.map((value, index) => value * left + at(end, index) * right) as [number, number, number, number]);
}

export function evaluateGltfAnimation(clip: GltfAnimationClip, time: number): GltfAnimationEvaluation {
  if (!Number.isFinite(time)) throw new Error("Animation time must be finite.");
  const poses = new Map<number, { translation?: readonly [number, number, number]; rotation?: readonly [number, number, number, number]; scale?: readonly [number, number, number] }>();
  for (const channel of clip.channels) {
    if (channel.times.length === 0) continue;
    const width = channel.path === "rotation" ? 4 : 3;
    let left = -1;
    for (let index = 0; index < channel.times.length; index += 1) {
      if (at(channel.times, index) > time) break;
      left = index;
    }
    if (left < 0) left = 0;
    const right = Math.min(left + 1, channel.times.length - 1);
    const fraction = channel.interpolation === "STEP" || left === right
      ? 0
      : Math.max(0, Math.min(1, (time - at(channel.times, left)) / (at(channel.times, right) - at(channel.times, left))));
    const start = channel.values.slice(left * width, left * width + width);
    const end = channel.values.slice(right * width, right * width + width);
    const value = channel.path === "rotation"
      ? slerp(start, end, fraction)
      : Object.freeze(start.map((component, index) => lerp(component, at(end, index), fraction)) as [number, number, number]);
    const pose = poses.get(channel.node) ?? {};
    if (channel.path === "translation") pose.translation = value as readonly [number, number, number];
    else if (channel.path === "rotation") pose.rotation = value as readonly [number, number, number, number];
    else pose.scale = value as readonly [number, number, number];
    poses.set(channel.node, pose);
  }
  const sampled = Object.freeze([...poses].sort(([a], [b]) => a - b).map(([node, pose]) => Object.freeze({ node, ...pose })));
  return Object.freeze({ poses: sampled, digest: digestSculptJson(sampled) });
}
