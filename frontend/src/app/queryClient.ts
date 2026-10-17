import { QueryClient } from "@tanstack/react-query";

import { ApiError, NetworkError } from "../api/httpClient";

const MAX_QUERY_RETRIES = 3;
const MAX_MUTATION_RETRIES = 2;

/** Erros do cliente (4xx) não melhoram tentando de novo; rede e 5xx podem. */
function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && error.status >= 500;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2_000,
        retry: (failureCount, error) => isRetryable(error) && failureCount < MAX_QUERY_RETRIES,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Seguro repetir: toda escrita leva a versão lida, então nunca é aplicada duas vezes.
        retry: (failureCount, error) =>
          error instanceof NetworkError && failureCount < MAX_MUTATION_RETRIES,
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
      },
    },
  });
}
