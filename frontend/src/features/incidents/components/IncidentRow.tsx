import { CloudOff, Truck, UserRound } from "lucide-react";
import { memo } from "react";

import type { Incident } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Spinner } from "../../../shared/components/Spinner";
import { HIGH_SEVERITY_ATTENTION_MS, elapsedSince, formatElapsed, formatOccurrence } from "../time";
import { CategoryLabel, SeverityBadge, StatusBadge } from "./Badges";
import styles from "./IncidentRow.module.css";

interface IncidentRowProps {
  incident: Incident;
  now: number;
  isPending: boolean;
  isOffline: boolean;
  currentUserId: string | undefined;
  onOpen: (incident: Incident) => void;
  onClaim: (incident: Incident) => void;
}

export const IncidentRow = memo(function IncidentRow({
  incident,
  now,
  isPending,
  isOffline,
  currentUserId,
  onOpen,
  onClaim,
}: IncidentRowProps) {
  // Fechado: mostra quanto levou para resolver (fixo), não um tempo que cresce para sempre.
  const resolvedIn =
    incident.status === "closed" && incident.closed_at
      ? elapsedSince(incident.reported_at, Date.parse(incident.closed_at))
      : null;
  const elapsed = resolvedIn ?? elapsedSince(incident.reported_at, now);
  const needsAttention =
    incident.severity === "high" &&
    incident.status === "open" &&
    elapsed > HIGH_SEVERITY_ATTENTION_MS;
  const isMine = incident.assignee?.id === currentUserId;

  return (
    <li
      className={[
        styles.row,
        styles[incident.severity],
        incident.status === "closed" && styles.closed,
        isPending && styles.pending,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={isPending || undefined}
    >
      <button
        type="button"
        className={styles.main}
        onClick={() => onOpen(incident)}
        aria-label={`Abrir incidente: ${incident.title}`}
      >
        <span className={styles.severity}>
          <SeverityBadge severity={incident.severity} />
        </span>

        <span className={styles.body}>
          <span className={styles.title}>{incident.title}</span>
          <span className={styles.meta}>
            <CategoryLabel category={incident.category} />
            <span className={styles.metaItem}>
              <Truck size={14} aria-hidden="true" />
              {incident.vehicle_id}
            </span>
            <span className={`${styles.metaItem} ${styles.location}`}>{incident.location}</span>
          </span>
        </span>

        <span className={styles.when}>
          <span
            className={`${styles.elapsed} tabular ${needsAttention ? styles.attention : ""}`}
            title={needsAttention ? "Alta criticidade aberta há mais de 30 minutos" : undefined}
          >
            <span className="visually-hidden">
              {resolvedIn !== null ? "Resolvido em " : "Aberto há "}
            </span>
            {resolvedIn !== null && (
              <span className={styles.resolvedPrefix} aria-hidden="true">
                resolvido em{" "}
              </span>
            )}
            {formatElapsed(elapsed)}
          </span>
          <time dateTime={incident.reported_at} className={`${styles.occurredAt} tabular`}>
            <span className="visually-hidden">Ocorrido </span>
            {formatOccurrence(incident.reported_at, now)}
          </time>
        </span>

        <span className={styles.state}>
          {isPending ? (
            <span className={styles.syncing}>
              {isOffline ? <CloudOff size={14} aria-hidden="true" /> : <Spinner size={12} />}
              {isOffline ? "Aguardando conexão" : "Salvando…"}
            </span>
          ) : (
            <StatusBadge status={incident.status} />
          )}
          {incident.assignee && (
            <span className={styles.assignee}>
              <UserRound size={12} aria-hidden="true" />
              {isMine ? "Você" : incident.assignee.display_name}
            </span>
          )}
        </span>
      </button>

      <span className={styles.action}>
        {incident.status === "open" && (
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => onClaim(incident)}
          >
            Assumir
          </Button>
        )}
      </span>
    </li>
  );
});
