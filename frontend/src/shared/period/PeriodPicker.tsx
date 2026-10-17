import { CalendarDays } from "lucide-react";

import { Chip, ChipGroup } from "../components/Chips";
import { PERIOD_LABEL, type PeriodFilter, type PeriodPreset, todayAsInputValue } from "./period";
import styles from "./PeriodPicker.module.css";

interface PeriodPickerProps {
  label: string;
  options: PeriodPreset[];
  value: PeriodFilter;
  onChange: (period: PeriodFilter) => void;
}

/** Atalhos primeiro (o que se usa quase sempre) e intervalo personalizado sob demanda. */
export function PeriodPicker({ label, options, value, onChange }: PeriodPickerProps) {
  return (
    <ChipGroup label={label}>
      {options.map((preset) => (
        <Chip
          key={preset}
          pressed={value.preset === preset}
          onClick={() => onChange(selectPreset(preset, value))}
        >
          {preset === "custom" && <CalendarDays size={14} aria-hidden="true" />}
          {PERIOD_LABEL[preset]}
        </Chip>
      ))}
      {value.preset === "custom" && <CustomRange period={value} onChange={onChange} />}
    </ChipGroup>
  );
}

function selectPreset(preset: PeriodPreset, current: PeriodFilter): PeriodFilter {
  if (preset !== "custom") return { preset, from: "", to: "" };
  if (current.preset === "custom") return current;
  const today = todayAsInputValue();
  return { preset, from: today, to: today };
}

function CustomRange({
  period,
  onChange,
}: {
  period: PeriodFilter;
  onChange: (period: PeriodFilter) => void;
}) {
  const today = todayAsInputValue();
  return (
    <span className={styles.range}>
      <label>
        <span className="visually-hidden">De</span>
        <input
          type="date"
          value={period.from}
          max={period.to || today}
          onChange={(event) => onChange({ ...period, from: event.target.value })}
        />
      </label>
      <span aria-hidden="true">até</span>
      <label>
        <span className="visually-hidden">Até</span>
        <input
          type="date"
          value={period.to}
          min={period.from || undefined}
          max={today}
          onChange={(event) => onChange({ ...period, to: event.target.value })}
        />
      </label>
    </span>
  );
}
