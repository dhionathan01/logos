import { CATEGORY_META } from "../../incidents/labels";
import type { CategoryStats } from "../api";
import { formatCount, formatMinutes, formatPercent } from "../format";
import styles from "./CategoryBreakdown.module.css";
import { Meter } from "./Meter";

/** Que tipo mais ocorre (barra) e como é tratado (taxa, tempo, SLA). Uma cor só: a barra é volume. */
export function CategoryBreakdown({ categories }: { categories: CategoryStats[] }) {
  const max = Math.max(1, ...categories.map((item) => item.total));

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Categoria</th>
          <th scope="col">Ocorrências</th>
          <th scope="col">Resolvidos</th>
          <th scope="col">Tempo médio</th>
          <th scope="col">No SLA</th>
        </tr>
      </thead>
      <tbody>
        {categories.map((item) => {
          const { label, icon: Icon } = CATEGORY_META[item.category];
          return (
            <tr key={item.category}>
              <th scope="row">
                <span className={styles.category}>
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </span>
              </th>
              <td>
                <span className={styles.barCell}>
                  <span className={styles.bar} style={{ width: `${(item.total / max) * 100}%` }} />
                  <span className="tabular">{formatCount(item.total)}</span>
                </span>
              </td>
              <td className="tabular">{formatPercent(item.resolution_rate)}</td>
              <td className="tabular">{formatMinutes(item.avg_resolution_minutes)}</td>
              <td>
                <Meter value={item.resolution_sla_rate} label={`SLA cumprido em ${label}`} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
