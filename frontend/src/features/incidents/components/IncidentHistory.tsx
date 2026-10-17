import { Spinner } from "../../../shared/components/Spinner";
import { describeEvent, resolutionNoteOf } from "../eventDescription";
import { useIncidentEvents } from "../hooks";
import { formatDateTime } from "../time";
import styles from "./IncidentHistory.module.css";

/** Linha do tempo da trilha de auditoria: quem fez o quê e quando. */
export function IncidentHistory({ incidentId }: { incidentId: string }) {
  const events = useIncidentEvents(incidentId);

  if (events.isPending) {
    return (
      <p className={styles.message}>
        <Spinner size={12} /> Carregando histórico…
      </p>
    );
  }
  if (events.isError) {
    return <p className={styles.message}>Não foi possível carregar o histórico agora.</p>;
  }

  return (
    <ol className={styles.timeline}>
      {events.data.map((event) => {
        const note = resolutionNoteOf(event);
        return (
          <li key={event.id} className={styles.item} data-type={event.event_type}>
            <span className={styles.dot} aria-hidden="true" />
            <p className={styles.description}>{describeEvent(event)}</p>
            {note && <p className={styles.note}>“{note}”</p>}
            <time dateTime={event.occurred_at} className={styles.time}>
              {formatDateTime(event.occurred_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
