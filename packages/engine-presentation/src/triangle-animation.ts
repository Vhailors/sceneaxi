/** Numeric playback contract; SDK pin: this file intentionally ships beside three-sculpt.ts.
 * CUBICSPLINE values are glTF [in tangent, value, out tangent] triples per key.
 * Quaternion results are normalized; tangents are derivatives, not unit quaternions.
 */
import { evaluateGltfAnimation, type GltfAnimationClip } from "@sceneaxi/schemas";

export type ThreeTriangleAnimationClip = Omit<GltfAnimationClip, "channels"> & Readonly<{
  channels: readonly (Omit<GltfAnimationClip["channels"][number], "interpolation"> & Readonly<{ interpolation: "STEP" | "LINEAR" | "CUBICSPLINE" }>)[];
}>;

export function evaluateTriangleAnimation(clip: ThreeTriangleAnimationClip, time: number) {
  const channels = clip.channels.map(channel => {
    if (channel.interpolation !== "CUBICSPLINE") return { ...channel, interpolation: channel.interpolation };
    const width = channel.path === "rotation" ? 4 : 3;

    const at = (index: number) => { const value = channel.values[index];

 if (value === undefined) throw Error("Incomplete cubic animation");

 return value; };

    let left = 0;

    for (let i = 1; i < channel.times.length; i++) if ((channel.times[i] ?? Infinity) <= time) left = i;
    const right = Math.min(left + 1, channel.times.length - 1);
    const start = channel.times[left] ?? 0, end = channel.times[right] ?? start;
    const dt = end - start;
    const t = dt === 0 ? 0 : Math.max(0, Math.min(1, (time - start) / dt));
    const h00 = 2*t*t*t - 3*t*t + 1, h10 = t*t*t - 2*t*t + t;
    const h01 = -2*t*t*t + 3*t*t, h11 = t*t*t - t*t;
    let values = Array.from({ length: width }, (_, i) => h00 * at(left*width*3+width+i) + h10*dt*at(left*width*3+width*2+i) + h01*at(right*width*3+width+i) + h11*dt*at(right*width*3+i));

    if (channel.path === "rotation") {
      const length = Math.hypot(...values);

      if (!Number.isFinite(length) || length < 1e-8) throw Error("Degenerate cubic quaternion");
      values = values.map(value => value / length);
    }

    return { ...channel, interpolation: "STEP" as const, times: [0], values };
  });

  return evaluateGltfAnimation({ ...clip, channels }, time);
}
