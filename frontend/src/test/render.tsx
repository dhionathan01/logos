import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";

import { configureAuth } from "../api/httpClient";
import type { Incident } from "../api/types";
import { sessionStore } from "../features/auth/sessionStore";

export const ANA = {
  id: "11111111-1111-1111-1111-111111111111",
  username: "ana",
  display_name: "Ana Souza",
};
export const BRUNO = {
  id: "22222222-2222-2222-2222-222222222222",
  username: "bruno",
  display_name: "Bruno Lima",
};

export function signInAs(user = ANA): void {
  configureAuth(sessionStore.token, () => sessionStore.end("expired"));
  sessionStore.start({ access_token: "token", token_type: "bearer", expires_in: 3600, user });
}

export function renderWithProviders(ui: ReactElement, { route = "/" } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}

let sequence = 0;

export function buildIncident(overrides: Partial<Incident> = {}): Incident {
  sequence += 1;
  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, "0")}`,
    title: `Incidente ${sequence}`,
    description: "",
    category: "mechanical_failure",
    severity: "medium",
    status: "open",
    vehicle_id: `CAM-${String(sequence).padStart(4, "0")}`,
    location: "BR-116, km 212",
    resolution_note: null,
    assignee: null,
    version: 1,
    reported_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    first_claimed_at: null,
    closed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
