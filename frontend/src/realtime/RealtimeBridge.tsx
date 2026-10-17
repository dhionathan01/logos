import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import type { ChatHistory, ChatMessage } from "../api/types";
import { analyticsKeys } from "../features/analytics/api";
import { sessionStore } from "../features/auth/sessionStore";
import { useSession } from "../features/auth/useSession";
import { mergeMessage } from "../features/chat/chatCache";
import { chatKeys } from "../features/chat/api";
import { chatUiStore } from "../features/chat/chatUiStore";
import { incidentKeys } from "../features/incidents/api";
import { openEventStream } from "./eventStream";
import { realtimeStore } from "./realtimeStore";

const INVALIDATE_DEBOUNCE_MS = 250;

/**
 * Liga o stream SSE ao cache do React Query enquanto há sessão (ADR-0014):
 * mensagens entram no chat sem nova requisição; mudanças em incidentes invalidam
 * fila, detalhe e painel (agrupadas, para uma rajada de eventos virar uma busca só).
 */
export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let invalidateTimer: number | undefined;
    let wasLive = false;

    const refreshIncidents = () => {
      window.clearTimeout(invalidateTimer);
      invalidateTimer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: incidentKeys.all });
        void queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
      }, INVALIDATE_DEBOUNCE_MS);
    };

    const handleMessage = (message: ChatMessage) => {
      queryClient.setQueryData<ChatHistory>(chatKeys.history, (current) =>
        current ? mergeMessage(current, message) : current,
      );
      if (message.handover) {
        void queryClient.invalidateQueries({
          queryKey: chatKeys.handovers(message.handover.incident_id),
        });
      }
      if (message.author?.id === userId) return;
      chatUiStore.messageArrived();
      // Pedido direcionado a mim chama atenção quando o chat está fechado
      // (aberto, o próprio cartão destacado no chat já cumpre esse papel).
      if (
        !chatUiStore.getState().isOpen &&
        message.handover?.status === "pending" &&
        message.handover.owner.id === userId
      ) {
        toast.info(message.body, {
          action: { label: "Responder", onClick: () => chatUiStore.open() },
        });
      }
    };

    const close = openEventStream({
      url: "/api/stream",
      getToken: sessionStore.token,
      onUnauthorized: () => sessionStore.end("expired"),
      onStatus: (status) => {
        realtimeStore.setStatus(status);
        // Ao reconectar, eventos de incidente perdidos não têm replay: revalida tudo.
        if (status === "open" && wasLive) refreshIncidents();
        if (status === "open") wasLive = true;
      },
      onEvent: (event) => {
        if (event.type === "chat.message") handleMessage(event.data as ChatMessage);
        if (event.type === "incident.changed") refreshIncidents();
      },
    });

    return () => {
      window.clearTimeout(invalidateTimer);
      close();
    };
  }, [queryClient, userId]);

  return null;
}
