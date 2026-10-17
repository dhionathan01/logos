import type { Category, IncidentStatus, Severity } from "../../../api/types";
import { CATEGORY_META, SEVERITY_META, STATUS_LABEL } from "../labels";
import styles from "./Badges.module.css";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, icon: Icon } = SEVERITY_META[severity];
  return (
    <span className={`${styles.severity} ${styles[severity]}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`${styles.status} ${styles[`status_${status}`]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CategoryLabel({ category }: { category: Category }) {
  const { label, icon: Icon } = CATEGORY_META[category];
  return (
    <span className={styles.category}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}
