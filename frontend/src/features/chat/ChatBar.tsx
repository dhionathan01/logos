import { ChevronDown, ChevronUp, MessagesSquare } from "lucide-react";

import { useRealtimeStatus } from "../../realtime/realtimeStore";
import { useSession } from "../auth/useSession";
import { useChatHistory } from "./api";
import styles from "./ChatBar.module.css";
import { chatUiStore, useChatUi } from "./chatUiStore";

const STATUS_TEXT = {
  open: "Ao vivo · todos os analistas veem esta conversa",
  reconnecting: "Reconectando… as mensagens perdidas chegam ao voltar",
  connecting: "Conectando…",
} as const;

/**
 * Barra fixa no rodapé: sempre à vista, avisa com uma bolinha quando há mensagem nova ou
 * pedido de passagem esperando você, e abre o chat por cima dela.
 */
export function ChatBar({ controls }: { controls: string }) {
  const { isOpen, unread } = useChatUi();
  const { user } = useSession();
  const status = useRealtimeStatus();
  const history = useChatHistory();

  const waitingForMe =
    history.data?.items.filter(
      (message) =>
        message.kind === "handover" &&
        message.handover?.status === "pending" &&
        message.handover.owner.id === user?.id,
    ).length ?? 0;

  const attention =
    waitingForMe > 0
      ? {
          level: "urgent",
          text: `${waitingForMe} ${waitingForMe === 1 ? "pedido aguarda" : "pedidos aguardam"} sua resposta`,
        }
      : unread > 0 && !isOpen
        ? {
            level: "unread",
            text: `${unread > 99 ? "99+" : unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}`,
          }
        : null;

  const statusText =
    STATUS_TEXT[status === "open" || status === "reconnecting" ? status : "connecting"];

  return (
    <button
      type="button"
      className={styles.bar}
      aria-expanded={isOpen}
      aria-controls={controls}
      onClick={chatUiStore.toggle}
    >
      <span className={styles.icon}>
        <MessagesSquare size={20} aria-hidden="true" />
        <span className={styles.live} data-status={status} aria-hidden="true" />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>Chat da central</span>
        <span className={styles.subtitle} data-level={attention?.level}>
          {attention && !isOpen ? attention.text : statusText}
        </span>
      </span>
      {attention && <span className={styles.dot} data-level={attention.level} aria-hidden="true" />}
      {isOpen ? (
        <ChevronDown size={18} aria-hidden="true" className={styles.chevron} />
      ) : (
        <ChevronUp size={18} aria-hidden="true" className={styles.chevron} />
      )}
    </button>
  );
}
