/** Kernel refusal type, kept separate so low-level seams can refuse without importing a session. */
export class KernelSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KernelSessionError";
  }
}
