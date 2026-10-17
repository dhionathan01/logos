import { request } from "../../api/httpClient";
import type {
  Incident,
  IncidentCreate,
  IncidentPage,
  IncidentSummary,
  IncidentUpdate,
  StatusChange,
} from "../../api/types";
import { type IncidentFilters, toApiQuery } from "./filters";

/** Fábrica de chaves de cache: invalidar `all` atualiza listas, detalhes e contadores. */
export const incidentKeys = {
  all: ["incidents"] as const,
  lists: () => [...incidentKeys.all, "list"] as const,
  list: (filters: IncidentFilters) => [...incidentKeys.lists(), filters] as const,
  details: () => [...incidentKeys.all, "detail"] as const,
  detail: (id: string) => [...incidentKeys.details(), id] as const,
  summary: () => [...incidentKeys.all, "summary"] as const,
};

export const incidentsApi = {
  list: (filters: IncidentFilters, signal?: AbortSignal) =>
    request<IncidentPage>("/incidents", { query: toApiQuery(filters), signal }),

  get: (id: string, signal?: AbortSignal) => request<Incident>(`/incidents/${id}`, { signal }),

  summary: (signal?: AbortSignal) => request<IncidentSummary>("/incidents/summary", { signal }),

  create: (payload: IncidentCreate, idempotencyKey: string) =>
    request<Incident>("/incidents", {
      method: "POST",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  update: (id: string, payload: IncidentUpdate) =>
    request<Incident>(`/incidents/${id}`, { method: "PATCH", body: payload }),

  changeStatus: (id: string, change: StatusChange) =>
    request<Incident>(`/incidents/${id}/status`, { method: "PATCH", body: change }),

  remove: (id: string, version: number) =>
    request<void>(`/incidents/${id}`, {
      method: "DELETE",
      query: new URLSearchParams({ version: String(version) }),
    }),
};
