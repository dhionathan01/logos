import { formatPercent } from "../format";
import styles from "./Meter.module.css";

/** Proporção contra um total: trilho e preenchimento do mesmo matiz, valor sempre em texto. */
export function Meter({ value, label }: { value: number | null | undefined; label: string }) {
  const percent = value == null ? 0 : Math.round(value * 100);
  return (
    <span className={styles.meter}>
      <span
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value == null ? undefined : percent}
        aria-valuetext={formatPercent(value)}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
      <span className={`${styles.value} tabular`}>{formatPercent(value)}</span>
    </span>
  );
}
