import { CalendarDays } from "lucide-react";
import { useId } from "react";

import { Dropdown, DropdownOption } from "../components/Dropdown";
import { PERIOD_LABEL, type PeriodFilter, type PeriodPreset, todayAsInputValue } from "./period";
import styles from "./PeriodPicker.module.css";

interface PeriodPickerProps {
  label: string;
  options: PeriodPreset[];
  value: PeriodFilter;
  /** Atalho que a tela usa quando nada foi escolhido; não conta como filtro aplicado. */
  defaultPreset?: PeriodPreset;
  onChange: (period: PeriodFilter) => void;
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/** Atalhos primeiro (o que se usa quase sempre) e intervalo de datas sob demanda. */
export function PeriodPicker({
  label,
  options,
  value,
  defaultPreset = "all",
  onChange,
}: PeriodPickerProps) {
  const name = useId();
  return (
    <Dropdown
      label={label}
      summary={summarizePeriod(value)}
      isActive={value.preset !== defaultPreset}
    >
      {(close) => (
        <>
          {options.map((preset) => (
            <DropdownOption
              key={preset}
              type="radio"
              name={name}
              checked={value.preset === preset}
              onChange={() => {
                onChange(selectPreset(preset, value));
                // O intervalo precisa das datas: mantém aberto para preenchê-las.
                if (preset !== "custom") close();
              }}
            >
              {preset === "custom" && <CalendarDays size={14} aria-hidden="true" />}
              {PERIOD_LABEL[preset]}
            </DropdownOption>
          ))}
          {value.preset === "custom" && <CustomRange period={value} onChange={onChange} />}
        </>
      )}
    </Dropdown>
  );
}

function summarizePeriod(period: PeriodFilter): string {
  if (period.preset !== "custom") return PERIOD_LABEL[period.preset];
  const from = period.from ? formatInputDate(period.from) : "";
  const to = period.to ? formatInputDate(period.to) : "";
  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (from) return `desde ${from}`;
  if (to) return `até ${to}`;
  return PERIOD_LABEL.custom;
}

function formatInputDate(value: string): string {
  return shortDate.format(new Date(`${value}T00:00:00`));
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
    <div className={styles.range}>
      <label>
        <span>De</span>
        <input
          type="date"
          value={period.from}
          max={period.to || today}
          onChange={(event) => onChange({ ...period, from: event.target.value })}
        />
      </label>
      <label>
        <span>Até</span>
        <input
          type="date"
          value={period.to}
          min={period.from || undefined}
          max={today}
          onChange={(event) => onChange({ ...period, to: event.target.value })}
        />
      </label>
    </div>
  );
}
