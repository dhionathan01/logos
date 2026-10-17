import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/** Mesmo sinal que o React Query usa para pausar e retomar requisições. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
