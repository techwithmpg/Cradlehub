export const OPTIMIZATION_CHANGED_EVENT = "cradlehub:optimization-changed";
const CHANNEL_NAME = "cradlehub:optimization-sync";

export type OptimizationChangedDetail = {
  branchId?: string;
  date?: string;
  reason?: string;
  sourceSnapshotVersion?: string;
  summary?: unknown;
};

export function notifyOptimizationChanged(detail: OptimizationChangedDetail = {}): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent<OptimizationChangedDetail>(OPTIMIZATION_CHANGED_EVENT, { detail }));

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(detail);
      channel.close();
    } catch {
      // Ignore BroadcastChannel errors in restricted privacy contexts.
    }
  }
}

export function subscribeOptimizationSyncChannel(
  onMessage: (detail: OptimizationChangedDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handleWindowEvent = (event: Event) => {
    const custom = event as CustomEvent<OptimizationChangedDetail>;
    onMessage(custom.detail ?? {});
  };
  window.addEventListener(OPTIMIZATION_CHANGED_EVENT, handleWindowEvent);

  let channel: BroadcastChannel | null = null;
  const handleChannelMessage = (event: MessageEvent<OptimizationChangedDetail>) => {
    onMessage(event.data ?? {});
  };
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.addEventListener("message", handleChannelMessage);
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener(OPTIMIZATION_CHANGED_EVENT, handleWindowEvent);
    if (channel) {
      channel.removeEventListener("message", handleChannelMessage);
      channel.close();
    }
  };
}
