/** Named refusals of the Three presentation core; every path fails closed. */
export type ThreePresentationErrorCode =
  | "already-mounted"
  | "capture-unavailable"
  | "capture-unsupported"
  | "invalid-canvas"
  | "invalid-camera"
  | "invalid-renderable"
  | "invalid-viewport"
  | "no-frame-scheduler"
  | "not-mounted";

export class ThreePresentationError extends Error {
  constructor(
    readonly code: ThreePresentationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ThreePresentationError";
  }
}
