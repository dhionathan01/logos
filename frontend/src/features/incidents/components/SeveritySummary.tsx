import type { IncidentSummary, Severity } from "../../../api/types";
import { SEVERITIES, SEVERITY_META } from "../labels";
import styles from "./SeveritySummary.module.css";

interface SeveritySummaryProps {
  summary: IncidentSummary | undefined;
  selected: Severity[];
  onToggle: (severity: Severity) => void;
}

/** Contadores de incidentes ativos por criticidade; cada um também é um filtro de um clique. */
export function SeveritySummary({ summary, selected, onToggle }: SeveritySummaryProps) {
  const unassigned = summary?.by_status.open;

  return (
    <section className={styles.summary} aria-label="Resumo de incidentes ativos">
      {SEVERITIES.map((severity) => {
        const { label, icon: Icon } = SEVERITY_META[severity];
        const count = summary?.active_by_severity[severity];
        const isSelected = selected.includes(severity);
        return (
          <button
            key={severity}
            type="button"
            className={`${styles.card} ${styles[severity]}`}
            aria-pressed={isSelected}
            onClick={() => onToggle(severity)}
          >
            <span className={styles.label}>
              <Icon size={16} aria-hidden="true" />
              Criticidade {label.toLowerCase()}
            </span>
            <span className={`${styles.count} tabular`}>{count ?? "–"}</span>
            <span className={styles.caption}>
              {isSelected ? "Filtrando · clique para remover" : "ativos"}
            </span>
          </button>
        );
      })}
      <div className={`${styles.card} ${styles.neutral}`}>
        <span className={styles.label}>Aguardando analista</span>
        <span className={`${styles.count} tabular`}>{unassigned ?? "–"}</span>
        <span className={styles.caption}>abertos sem responsável</span>
      </div>
    </section>
  );
}
