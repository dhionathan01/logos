import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  HelpCircle,
  type LucideIcon,
  Undo2,
  UserCheck,
} from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";

import type { ChatMessage } from "../../api/types";
import { Button } from "../../shared/components/Button";
import styles from "./MessageItem.module.css";

type Notice = NonNullable<ChatMessage["notice"]>;
type HandoverStatus = NonNullable<ChatMessage["handover"]>["status"];

const NOTICE_ICON: Record<
  Notice,
  { icon: LucideIcon; tone: "neutral" | "warning" | "danger" | "success" }
> = {
  new_high_severity: { icon: AlertOctagon, tone: "danger" },
  claimed: { icon: UserCheck, tone: "neutral" },
  resumed: { icon: UserCheck, tone: "neutral" },
  released: { icon: Undo2, tone: "neutral" },
  closed: { icon: CheckCircle2, tone: "success" },
  marked_inconclusive: { icon: HelpCircle, tone: "neutral" },
  claim_conflict: { icon: AlertTriangle, tone: "warning" },
  handover_requested: { icon: ArrowLeftRight, tone: "neutral" },
  handover_accepted: { icon: ArrowLeftRight, tone: "success" },
  handover_declined: { icon: ArrowLeftRight, tone: "neutral" },
  handover_cancelled: { icon: ArrowLeftRight, tone: "neutral" },
  delegated: { icon: ArrowLeftRight, tone: "neutral" },
};

const HANDOVER_STATUS_LABEL: Record<HandoverStatus, string> = {
  pending: "Aguardando resposta",
  accepted: "Aceito",
  declined: "Recusado",
  cancelled: "Cancelado",
};

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });

interface MessageItemProps {
  message: ChatMessage;
  currentUserId: string | undefined;
  isActing: boolean;
  onHandoverAction: (handoverId: string, action: "accept" | "decline" | "cancel") => void;
}

export const MessageItem = memo(function MessageItem({
  message,
  currentUserId,
  isActing,
  onHandoverAction,
}: MessageItemProps) {
  const time = (
    <time dateTime={message.created_at} className={styles.time}>
      {timeFormatter.format(new Date(message.created_at))}
    </time>
  );

  if (message.kind === "user") {
    const isMine = message.author?.id === currentUserId;
    return (
      <li className={`${styles.user} ${isMine ? styles.mine : ""}`}>
        <span className={styles.meta}>
          <strong>{isMine ? "Você" : (message.author?.display_name ?? "Analista removido")}</strong>
          {time}
        </span>
        <p className={styles.bubble}>{message.body}</p>
        {message.incident && <IncidentChip incident={message.incident} />}
      </li>
    );
  }

  if (message.kind === "handover" && message.handover) {
    const { handover } = message;
    const isOwner = handover.owner.id === currentUserId;
    const isRequester = handover.requester.id === currentUserId;
    const isPending = handover.status === "pending";
    return (
      <li className={`${styles.handover} ${isPending && isOwner ? styles.forMe : ""}`}>
        <span className={styles.meta}>
          <ArrowLeftRight size={14} aria-hidden="true" />
          <strong>Pedido de passagem</strong>
          {time}
        </span>
        <p>{message.body}</p>
        {message.incident && <IncidentChip incident={message.incident} />}
        <div className={styles.handoverFooter}>
          <span className={styles.status} data-status={handover.status}>
            {HANDOVER_STATUS_LABEL[handover.status]}
          </span>
          {isPending && isOwner && (
            <span className={styles.actions}>
              <Button
                size="sm"
                variant="ghost"
                disabled={isActing}
                onClick={() => onHandoverAction(handover.id, "decline")}
              >
                Recusar
              </Button>
              <Button
                size="sm"
                isLoading={isActing}
                onClick={() => onHandoverAction(handover.id, "accept")}
              >
                Passar para {handover.requester.display_name.split(" ")[0]}
              </Button>
            </span>
          )}
          {isPending && isRequester && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isActing}
              onClick={() => onHandoverAction(handover.id, "cancel")}
            >
              Cancelar pedido
            </Button>
          )}
        </div>
      </li>
    );
  }

  const notice = message.notice ? NOTICE_ICON[message.notice] : NOTICE_ICON.claimed;
  const Icon = notice.icon;
  return (
    <li className={styles.system} data-tone={notice.tone}>
      <Icon size={14} aria-hidden="true" className={styles.systemIcon} />
      <span className={styles.systemBody}>
        {message.body}
        {message.incident && (
          <>
            {" "}
            <Link to={`/?incident=${message.incident.id}`} className={styles.inlineLink}>
              Abrir
            </Link>
          </>
        )}
      </span>
      {time}
    </li>
  );
});

function IncidentChip({ incident }: { incident: NonNullable<ChatMessage["incident"]> }) {
  return (
    <Link
      to={`/?incident=${incident.id}`}
      className={styles.incident}
      data-severity={incident.severity}
    >
      <span className={styles.severityDot} aria-hidden="true" />
      <span className={styles.incidentTitle}>{incident.title}</span>
      <span className={styles.incidentVehicle}>{incident.vehicle_id}</span>
    </Link>
  );
}
