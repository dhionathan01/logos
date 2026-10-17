const HOUR = 60 * 60_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodPreset = "all" | "1h" | "6h" | "24h" | "7d" | "custom";

export interface PeriodFilter {
  preset: PeriodPreset;
  /** Datas do intervalo personalizado (AAAA-MM-DD, no fuso do analista). */
  from: string;
  to: string;
}

export const ALL_TIME: PeriodFilter = { preset: "all", from: "", to: "" };

export const PERIOD_PRESETS: { value: PeriodPreset; label: string; durationMs?: number }[] = [
  { value: "all", label: "Todo o período" },
  { value: "1h", label: "Última hora", durationMs: HOUR },
  { value: "6h", label: "6 h", durationMs: 6 * HOUR },
  { value: "24h", label: "24 h", durationMs: 24 * HOUR },
  { value: "7d", label: "7 dias", durationMs: 7 * 24 * HOUR },
  { value: "custom", label: "Personalizado" },
];

function isValidDate(value: string | null): value is string {
  return value !== null && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/** Lê o período da URL; valores inválidos voltam para "todo o período". */
export function parsePeriod(params: URLSearchParams): PeriodFilter {
  const preset = PERIOD_PRESETS.find((option) => option.value === params.get("period"))?.value;
  if (!preset || preset === "all") return ALL_TIME;
  if (preset !== "custom") return { preset, from: "", to: "" };

  const from = params.get("from");
  const to = params.get("to");
  const validFrom = isValidDate(from) ? from : "";
  const validTo = isValidDate(to) ? to : "";
  // Intervalo invertido é quase sempre engano de digitação: ordena em vez de rejeitar.
  if (validFrom && validTo && validFrom > validTo) {
    return { preset, from: validTo, to: validFrom };
  }
  return { preset, from: validFrom, to: validTo };
}

/** Converte o período em instantes ISO para a API, relativo ao momento da busca. */
export function periodToRange(
  period: PeriodFilter,
  now: number,
): { reportedFrom?: string; reportedTo?: string } {
  if (period.preset === "all") return {};
  if (period.preset === "custom") {
    return {
      reportedFrom: period.from ? new Date(`${period.from}T00:00:00`).toISOString() : undefined,
      reportedTo: period.to ? new Date(`${period.to}T23:59:59.999`).toISOString() : undefined,
    };
  }
  const durationMs = PERIOD_PRESETS.find((option) => option.value === period.preset)?.durationMs;
  return durationMs ? { reportedFrom: new Date(now - durationMs).toISOString() } : {};
}

export function todayAsInputValue(now = new Date()): string {
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
