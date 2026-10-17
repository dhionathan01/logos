import { useSyncExternalStore } from "react";

import type { StreamStatus } from "./eventStream";

type Listener = () => void;

const listeners = new Set<Listener>();
let status: StreamStatus = "closed";

/** Estado da conexão em tempo real, lido pela interface e pelo intervalo de polling. */
export const realtimeStore = {
  getStatus: (): StreamStatus => status,
  setStatus(next: StreamStatus) {
    if (next === status) return;
    status = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  isLive: () => status === "open",
};

export function useRealtimeStatus(): StreamStatus {
  return useSyncExternalStore(realtimeStore.subscribe, realtimeStore.getStatus);
}
