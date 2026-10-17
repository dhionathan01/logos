import { MessagesSquare } from "lucide-react";

import { useRealtimeStatus } from "../../realtime/realtimeStore";
import { useSession } from "../auth/useSession";
import { useChatHistory } from "./api";
import styles from "./ChatToggle.module.css";
import { chatUiStore, useChatUi } from "./chatUiStore";

export function ChatToggle() {
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

  const label = [
    isOpen ? "Fechar chat da central" : "Abrir chat da central",
    unread > 0 && `${unread} mensagens novas`,
    waitingForMe > 0 && `${waitingForMe} pedidos aguardando sua resposta`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={isOpen}
      aria-label={label}
      title={label}
      onClick={chatUiStore.toggle}
    >
      <span className={styles.icon}>
        <MessagesSquare size={18} aria-hidden="true" />
        <span className={styles.live} data-status={status} aria-hidden="true" />
      </span>
      <span className={styles.label}>Central</span>
      {waitingForMe > 0 ? (
        <span className={`${styles.badge} ${styles.urgent}`} aria-hidden="true">
          {waitingForMe}
        </span>
      ) : (
        unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )
      )}
    </button>
  );
}
