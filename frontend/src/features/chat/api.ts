import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, request } from "../../api/httpClient";
import type { Analyst, ChatHistory, ChatMessage, Handover, Incident } from "../../api/types";
import { incidentKeys } from "../incidents/api";
import { mergeMessage, prependOlder } from "./chatCache";

const PAGE_SIZE = 50;

export const chatKeys = {
  history: ["chat", "history"] as const,
  analysts: ["analysts"] as const,
  handovers: (incidentId: string) => [...incidentKeys.detail(incidentId), "handovers"] as const,
};

export function useChatHistory() {
  return useQuery({
    queryKey: chatKeys.history,
    queryFn: ({ signal }) =>
      request<ChatHistory>("/chat/messages", {
        query: new URLSearchParams({ limit: String(PAGE_SIZE) }),
        signal,
      }),
    // O stream mantém o histórico atualizado; não refaz a busca a cada foco da janela.
    staleTime: Infinity,
  });
}

export function useLoadOlderMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beforeId: number) =>
      request<ChatHistory>("/chat/messages", {
        query: new URLSearchParams({ limit: String(PAGE_SIZE), before_id: String(beforeId) }),
      }),
    onSuccess: (older) =>
      queryClient.setQueryData<ChatHistory>(chatKeys.history, (current) =>
        prependOlder(current, older),
      ),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; incident_id?: string | null }) =>
      request<ChatMessage>("/chat/messages", { method: "POST", body: payload }),
    onSuccess: (message) =>
      queryClient.setQueryData<ChatHistory>(chatKeys.history, (current) =>
        mergeMessage(current, message),
      ),
  });
}

export function useAnalysts() {
  return useQuery({
    queryKey: chatKeys.analysts,
    queryFn: ({ signal }) => request<Analyst[]>("/users", { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useIncidentHandovers(incidentId: string) {
  return useQuery({
    queryKey: chatKeys.handovers(incidentId),
    queryFn: ({ signal }) =>
      request<Handover[]>(`/incidents/${incidentId}/handover-requests`, { signal }),
  });
}

type HandoverAction = "accept" | "decline" | "cancel";

const ACTION_FEEDBACK: Record<HandoverAction, string> = {
  accept: "Incidente passado para quem pediu.",
  decline: "Pedido recusado. O incidente continua com você.",
  cancel: "Pedido cancelado.",
};

/** Ações sobre pedidos de passagem; o stream avisa todos os outros analistas. */
export function useHandoverAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ handoverId, action }: { handoverId: string; action: HandoverAction }) =>
      request<Handover>(`/handover-requests/${handoverId}/${action}`, { method: "POST" }),
    onSuccess: (handover, { action }) => {
      toast.success(ACTION_FEEDBACK[action]);
      void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(handover.incident_id) });
    },
    onError: notifyError,
  });
}

export function useRequestHandover(incidentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      request<Handover>(`/incidents/${incidentId}/handover-requests`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: () => {
      toast.success("Pedido enviado. O responsável foi avisado no chat.");
      void queryClient.invalidateQueries({ queryKey: chatKeys.handovers(incidentId) });
    },
    onError: notifyError,
  });
}

export function useDelegate(incidentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { to_user_id: string; version: number }) =>
      request<Incident>(`/incidents/${incidentId}/delegate`, { method: "POST", body: payload }),
    onSuccess: () => {
      toast.success("Incidente delegado.");
      void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
    },
    onError: notifyError,
  });
}

function notifyError(error: Error) {
  if (error instanceof ApiError) toast.warning(error.problem.title, { description: error.message });
  else toast.error("Sem conexão: a ação não foi enviada.");
}
