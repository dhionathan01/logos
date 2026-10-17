import { SeverityBadge } from "../../incidents/components/Badges";
import type { SeverityStats } from "../api";
import { formatCount, formatMinutes } from "../format";
import { Meter } from "./Meter";
import styles from "./SeveritySla.module.css";

/** Meta x realizado por criticidade: o supervisor vê onde o SLA está sendo perdido. */
export function SeveritySla({ severities }: { severities: SeverityStats[] }) {
  return (
    <ul className={styles.list}>
      {severities.map((item) => (
        <li key={item.severity} className={styles.item}>
          <div className={styles.header}>
            <SeverityBadge severity={item.severity} />
            <span className={styles.volume}>
              {formatCount(item.total)} ocorrências · {formatCount(item.closed)} fechadas
            </span>
          </div>

          <dl className={styles.metrics}>
            <div>
              <dt>Resposta (meta {formatMinutes(item.response_target_minutes)})</dt>
              <dd>
                <span className={styles.average}>
                  média {formatMinutes(item.avg_response_minutes)}
                </span>
                <Meter
                  value={item.response_sla_rate}
                  label={`Resposta no prazo, criticidade ${item.severity}`}
                />
              </dd>
            </div>
            <div>
              <dt>Resolução (meta {formatMinutes(item.resolution_target_minutes)})</dt>
              <dd>
                <span className={styles.average}>
                  média {formatMinutes(item.avg_resolution_minutes)}
                </span>
                <Meter
                  value={item.resolution_sla_rate}
                  label={`Resolução no prazo, criticidade ${item.severity}`}
                />
              </dd>
            </div>
          </dl>

          {item.breaching_now > 0 && (
            <p className={styles.breaching}>
              {formatCount(item.breaching_now)}{" "}
              {item.breaching_now === 1 ? "ativo já passou" : "ativos já passaram"} do prazo
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
