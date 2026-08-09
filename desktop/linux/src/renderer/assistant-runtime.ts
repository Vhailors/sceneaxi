export type DesktopAssistantRuntimeSignal = Readonly<{
  runtime: "none" | "local";
  message?: string;
}>;

export type DesktopAssistantRuntimeState =
  | Readonly<{ status: "refused"; message: string }>
  | Readonly<{ status: "mounted"; controlsBound: boolean }>;

export function desktopAssistantRuntimeSignal(
  state: DesktopAssistantRuntimeState,
): DesktopAssistantRuntimeSignal {
  if (state.status === "refused") {
    return Object.freeze({ runtime: "none" as const, message: state.message });
  }
  return state.controlsBound
    ? Object.freeze({ runtime: "local" as const })
    : Object.freeze({
        runtime: "none" as const,
        message:
          "the assistant controls could not be bound to the mounted presentation runtime.",
      });
}
