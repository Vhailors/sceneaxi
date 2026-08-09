/** Kernel refusal type, kept separate so low-level seams can refuse without importing a session. */
export class KernelSessionError extends Error {
  constructor(
    message: string,
    /** Stable machine-readable refusal code; generic for legacy kernel errors. */
    readonly code: string = "KERNEL_SESSION_REFUSED",
  ) {
    super(message);
    this.name = "KernelSessionError";
  }
}
