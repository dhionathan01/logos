import type { ChatHistory, ChatMessage } from "../../api/types";

/**
 * Insere uma mensagem no histórico em cache.
 * - Deduplica pelo id: a mesma mensagem pode chegar pela resposta do POST, pelo stream
 *   e pelo replay após reconexão.
 * - Mensagens que citam um pedido de passagem atualizam o cartão original do pedido
 *   (ex.: "aceito" muda o status exibido no cartão "Bruno pediu para assumir").
 */
export function mergeMessage(history: ChatHistory | undefined, message: ChatMessage): ChatHistory {
  const items = history?.items ?? [];
  const updated = message.handover
    ? items.map((item) =>
        item.handover?.id === message.handover?.id ? { ...item, handover: message.handover } : item,
      )
    : items;

  const withMessage = updated.some((item) => item.id === message.id)
    ? updated.map((item) => (item.id === message.id ? message : item))
    : [...updated, message];

  return {
    items: withMessage.sort((a, b) => a.id - b.id),
    has_more: history?.has_more ?? false,
  };
}

export function prependOlder(history: ChatHistory | undefined, older: ChatHistory): ChatHistory {
  const known = new Set(history?.items.map((item) => item.id));
  return {
    items: [...older.items.filter((item) => !known.has(item.id)), ...(history?.items ?? [])],
    has_more: older.has_more,
  };
}
