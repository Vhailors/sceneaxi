# @sceneaxi/engine-presentation

Backend-hidden Presentation Runtime seam (`mount / present / capture / dispose`)
for read-only kernel snapshots.

`createNullPresentationRuntime()` provides a lifecycle-real null backend for
kernel and end-to-end paths. It mounts and disposes normally, accepts no-op
frames, and returns no capture. It refuses `present`, `capture`, and `dispose`
while detached, and refuses a second `mount` while mounted. It does not expose
or select a renderer backend.

The double-gated Stage 1 proof still decides real renderer composition later;
this null runtime is not evidence for Three.js, PlayCanvas, or any other choice.
