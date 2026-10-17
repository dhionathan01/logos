import { AlertOctagon, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { AnalyticsReport } from "../api";
import { formatCount, formatMinutes, formatPercent } from "../format";
import styles from "./KpiRow.module.css";

/** Números principais do período: cada um é um cartão, não um gráfico. */
export function KpiRow({ overview }: { overview: AnalyticsReport["overview"] }) {
  return (
    <section className={styles.row} aria-label="Indicadores do período">
      <Tile label="Incidentes registrados" value={formatCount(overview.total)}>
        {formatCount(overview.active)} ainda ativos
      </Tile>
      <Tile label="Taxa de resolução" value={formatPercent(overview.resolution_rate)}>
        {formatCount(overview.closed)} fechados
        {overview.inconclusive > 0 && ` · ${formatCount(overview.inconclusive)} inconclusivos`}
      </Tile>
      <Tile label="Tempo médio de resposta" value={formatMinutes(overview.avg_response_minutes)}>
        SLA de resposta cumprido em {formatPercent(overview.response_sla_rate)}
      </Tile>
      <Tile label="Tempo médio de resolução" value={formatMinutes(overview.avg_resolution_minutes)}>
        SLA de resolução cumprido em {formatPercent(overview.resolution_sla_rate)}
      </Tile>
      <div
        className={`${styles.tile} ${overview.breaching_now > 0 ? styles.alert : ""}`}
        aria-live="polite"
      >
        <span className={styles.label}>
          {overview.breaching_now > 0 && <AlertOctagon size={14} aria-hidden="true" />}
          Fora do SLA agora
        </span>
        <span className={styles.value}>{formatCount(overview.breaching_now)}</span>
        <span className={styles.caption}>
          {overview.breaching_now > 0 ? (
            <Link to="/" className={styles.link} viewTransition>
              Ver fila <ArrowRight size={12} aria-hidden="true" />
            </Link>
          ) : (
            "Nenhum ativo além do prazo"
          )}
        </span>
      </div>
    </section>
  );
}

function Tile({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.caption}>{children}</span>
    </div>
  );
}
