import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { request } from "../../api/httpClient";
import type { TokenResponse } from "../../api/types";
import { sessionStore } from "./sessionStore";

export function useSession() {
  const { session, logoutReason } = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getState,
  );
  const queryClient = useQueryClient();

  return {
    user: session?.user ?? null,
    isAuthenticated: session !== null,
    logoutReason,
    logout: () => {
      sessionStore.end("manual");
      queryClient.clear();
    },
  };
}

export interface Credentials {
  username: string;
  password: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (credentials: Credentials) =>
      request<TokenResponse>("/auth/login", { method: "POST", body: credentials }),
    onSuccess: (response) => sessionStore.start(response),
  });
}
