import {
  type QueryClient,
  keepPreviousData,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, NetworkError } from "../../api/httpClient";
import type { Incident, IncidentCreate, IncidentPage, IncidentStatus, User } from "../../api/types";
import { useSession } from "../auth/useSession";
import { incidentKeys, incidentsApi } from "./api";
import type { IncidentFilters } from "./filters";
import { STATUS_CHANGE_FEEDBACK } from "./labels";

const POLL_INTERVAL_MS = 5_000;
const statusMutationKey = [...incidentKeys.all, "change-status"] as const;

/**
 * Fila de incidentes com atualização periódica. O polling pausa enquanto há
 * uma alteração em andamento, para não sobrescrever a atualização otimista.
 */
export function useIncidents(filters: IncidentFilters) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: incidentKeys.list(filters),
    queryFn: ({ signal }) => incidentsApi.list(filters, signal),
    placeholderData: keepPreviousData,
    refetchInterval: () =>
      queryClient.isMutating({ mutationKey: statusMutationKey }) > 0 ? false : POLL_INTERVAL_MS,
  });
}

export function useIncidentSummary() {
  return useQuery({
    queryKey: incidentKeys.summary(),
    queryFn: ({ signal }) => incidentsApi.summary(signal),
    refetchInterval: POLL_INTERVAL_MS,
  });
}

/** Detalhe do incidente; usa o que já está nas listas como dado inicial (abre instantâneo). */
export function useIncident(id: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: incidentKeys.detail(id ?? ""),
    queryFn: ({ signal }) => incidentsApi.get(id as string, signal),
    enabled: id !== null,
    initialData: () => (id ? findInLists(queryClient, id) : undefined),
  });
}

interface StatusChangeVariables {
  incident: Incident;
  target: IncidentStatus;
  resolutionNote?: string;
}

/**
 * Mudança de status com atualização otimista:
 * 1. a tela reflete a mudança na hora;
 * 2. se a API recusar (conflito, rede), o estado volta ao que era e o analista vê o motivo;
 * 3. em conflito, a tela adota o estado atual que a API devolveu, sem outra requisição.
 */
export function useChangeStatus() {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationKey: statusMutationKey,
    mutationFn: ({ incident, target, resolutionNote }: StatusChangeVariables) =>
      incidentsApi.changeStatus(incident.id, {
        status: target,
        version: incident.version,
        resolution_note: resolutionNote || null,
      }),

    onMutate: async ({ incident, target }) => {
      await queryClient.cancelQueries({ queryKey: incidentKeys.all });
      const snapshot = snapshotIncident(queryClient, incident.id);
      replaceIncident(queryClient, applyLocally(incident, target, user));
      return { snapshot };
    },

    onSuccess: (updated, { target }) => {
      replaceIncident(queryClient, updated);
      toast.success(STATUS_CHANGE_FEEDBACK[target]);
    },

    onError: (error, { target }, context) => {
      context?.snapshot.restore();
      const current = error instanceof ApiError ? error.problem.current : undefined;

      if (current && wasAlreadyApplied(current, target, user)) {
        // A primeira tentativa foi gravada, mas a resposta se perdeu na rede: não é conflito.
        replaceIncident(queryClient, current);
        toast.success(STATUS_CHANGE_FEEDBACK[target]);
        return;
      }
      if (current) replaceIncident(queryClient, current);
      notifyFailure(error, "Não foi possível alterar o status.");
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  });
}

/** IDs com alteração em andamento (ou aguardando a conexão voltar). */
export function usePendingIncidentIds(): Set<string> {
  const ids = useMutationState({
    filters: { mutationKey: statusMutationKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as StatusChangeVariables).incident.id,
  });
  return new Set(ids);
}

export function useCreateIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: IncidentCreate;
      idempotencyKey: string;
    }) => incidentsApi.create(payload, idempotencyKey),
    onSuccess: () => {
      toast.success("Incidente registrado e adicionado à fila.");
      return queryClient.invalidateQueries({ queryKey: incidentKeys.all });
    },
  });
}

export function useUpdateSeverity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ incident, severity }: { incident: Incident; severity: Incident["severity"] }) =>
      incidentsApi.update(incident.id, { version: incident.version, severity }),
    onSuccess: (updated) => {
      replaceIncident(queryClient, updated);
      toast.success("Criticidade atualizada.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.problem.current) {
        replaceIncident(queryClient, error.problem.current);
      }
      notifyFailure(error, "Não foi possível alterar a criticidade.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  });
}

export function useDeleteIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (incident: Incident) => incidentsApi.remove(incident.id, incident.version),
    onSuccess: () => toast.success("Incidente excluído."),
    onError: (error) => notifyFailure(error, "Não foi possível excluir o incidente."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  });
}

function notifyFailure(error: Error, fallbackTitle: string): void {
  if (error instanceof ApiError && error.isConflict) {
    toast.warning(error.problem.title, { description: error.message });
  } else if (error instanceof NetworkError) {
    toast.error("Sem conexão: a alteração não foi salva.", {
      description: "Verifique a rede e tente novamente. Nada foi perdido no servidor.",
    });
  } else {
    toast.error(fallbackTitle, { description: error.message });
  }
}

function applyLocally(incident: Incident, target: IncidentStatus, user: User | null): Incident {
  const assignee =
    target === "investigating" && user
      ? { id: user.id, display_name: user.display_name }
      : target === "open"
        ? null
        : incident.assignee;
  return { ...incident, status: target, assignee };
}

function wasAlreadyApplied(current: Incident, target: IncidentStatus, user: User | null): boolean {
  if (current.status !== target) return false;
  return target !== "investigating" || current.assignee?.id === user?.id;
}

function findInLists(queryClient: QueryClient, id: string): Incident | undefined {
  for (const [, page] of queryClient.getQueriesData<IncidentPage>({
    queryKey: incidentKeys.lists(),
  })) {
    const found = page?.items.find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

function replaceIncident(queryClient: QueryClient, incident: Incident): void {
  queryClient.setQueriesData<IncidentPage>({ queryKey: incidentKeys.lists() }, (page) =>
    page
      ? { ...page, items: page.items.map((item) => (item.id === incident.id ? incident : item)) }
      : page,
  );
  queryClient.setQueryData(incidentKeys.detail(incident.id), incident);
}

function snapshotIncident(queryClient: QueryClient, id: string) {
  const lists = queryClient.getQueriesData<IncidentPage>({ queryKey: incidentKeys.lists() });
  const detail = queryClient.getQueryData<Incident>(incidentKeys.detail(id));
  return {
    restore: () => {
      lists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      queryClient.setQueryData(incidentKeys.detail(id), detail);
    },
  };
}
