import type { Category } from "../../../api/types";
import { CATEGORIES, CATEGORY_META } from "../../incidents/labels";
import type { AnalystStats } from "../api";
import { formatCount, formatMinutes } from "../format";
import { HEAT_STEPS, heatStep } from "../heat";
import styles from "./AnalystComparison.module.css";
import { Meter } from "./Meter";

export function AnalystComparison({ analysts }: { analysts: AnalystStats[] }) {
  if (analysts.length === 0) {
    return <p className={styles.empty}>Nenhum incidente assumido no período.</p>;
  }

  const maxCell = Math.max(
    1,
    ...analysts.flatMap((analyst) => CATEGORIES.map((c) => analyst.by_category[c] ?? 0)),
  );

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className="visually-hidden">Desempenho por analista</caption>
        <thead>
          <tr>
            <th scope="col">Analista</th>
            <th scope="col">Assumidos</th>
            <th scope="col">Resolvidos</th>
            <th scope="col">Tempo médio</th>
            <th scope="col">No SLA</th>
          </tr>
        </thead>
        <tbody>
          {analysts.map((item) => (
            <tr key={item.analyst.id}>
              <th scope="row">{item.analyst.display_name}</th>
              <td className="tabular">{formatCount(item.assigned)}</td>
              <td>
                <Meter
                  value={item.resolution_rate}
                  label={`Resolvidos por ${item.analyst.display_name}`}
                />
              </td>
              <td className="tabular">{formatMinutes(item.avg_resolution_minutes)}</td>
              <td>
                <Meter
                  value={item.resolution_sla_rate}
                  label={`SLA cumprido por ${item.analyst.display_name}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.heatmap}>
        <h3 className={styles.heatTitle}>Quem assume que tipo de incidente</h3>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Analista</span>
              </th>
              {CATEGORIES.map((category) => {
                const { label, shortLabel, icon: Icon } = CATEGORY_META[category];
                return (
                  <th key={category} scope="col" title={label} aria-label={label}>
                    <Icon size={16} aria-hidden="true" />
                    <span className={styles.columnLabel} aria-hidden="true">
                      {shortLabel}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {analysts.map((item) => (
              <tr key={item.analyst.id}>
                <th scope="row">{item.analyst.display_name}</th>
                {CATEGORIES.map((category: Category) => {
                  const value = item.by_category[category] ?? 0;
                  const step = heatStep(value, maxCell);
                  return (
                    <td
                      key={category}
                      className={styles.cell}
                      data-step={step}
                      title={`${item.analyst.display_name} · ${CATEGORY_META[category].label}: ${value}`}
                    >
                      {value > 0 ? formatCount(value) : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className={styles.scale} aria-hidden="true">
          <span>menos</span>
          {Array.from({ length: HEAT_STEPS }, (_, index) => (
            <span key={index} className={styles.swatch} data-step={index + 1} />
          ))}
          <span>mais</span>
        </div>
      </div>
    </div>
  );
}
