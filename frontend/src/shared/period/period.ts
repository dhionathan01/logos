const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodPreset = "all" | "1h" | "6h" | "24h" | "7d" | "30d" | "90d" | "custom";

export interface PeriodFilter {
  preset: PeriodPreset;
  /** Datas do intervalo personalizado (AAAA-MM-DD, no fuso do usuário). */
  from: string;
  to: string;
}

export const ALL_TIME: PeriodFilter = { preset: "all", from: "", to: "" };

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  all: "Todo o período",
  "1h": "Última hora",
  "6h": "6 h",
  "24h": "24 h",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  custom: "Personalizado",
};

const PRESET_DURATION_MS: Partial<Record<PeriodPreset, number>> = {
  "1h": HOUR,
  "6h": 6 * HOUR,
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
};

/** Fila: horizonte operacional (horas). Painel: horizonte de gestão (semanas). */
export const QUEUE_PERIODS: PeriodPreset[] = ["all", "1h", "6h", "24h", "7d", "custom"];
export const DASHBOARD_PERIODS: PeriodPreset[] = ["7d", "30d", "90d", "all", "custom"];

function isPreset(value: string | null): value is PeriodPreset {
  return value !== null && value in PERIOD_LABEL;
}

function isValidDate(value: string | null): value is string {
  return value !== null && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/** Lê o período da URL; valores inválidos voltam para o padrão da tela. */
export function parsePeriod(params: URLSearchParams, fallback: PeriodPreset = "all"): PeriodFilter {
  const requested = params.get("period");
  const preset = isPreset(requested) ? requested : fallback;
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

/** Grava o período na URL; o padrão da tela fica implícito, para links mais limpos. */
export function writePeriod(
  params: URLSearchParams,
  period: PeriodFilter,
  fallback: PeriodPreset = "all",
): URLSearchParams {
  const next = new URLSearchParams(params);
  ["period", "from", "to"].forEach((key) => next.delete(key));
  if (period.preset === fallback) return next;
  next.set("period", period.preset);
  if (period.preset === "custom") {
    if (period.from) next.set("from", period.from);
    if (period.to) next.set("to", period.to);
  }
  return next;
}

/** Converte o período em instantes ISO para a API, relativo ao momento da busca. */
export function periodToRange(
  period: PeriodFilter,
  now: number,
): { reportedFrom?: string; reportedTo?: string } {
  if (period.preset === "custom") {
    return {
      reportedFrom: period.from ? new Date(`${period.from}T00:00:00`).toISOString() : undefined,
      reportedTo: period.to ? new Date(`${period.to}T23:59:59.999`).toISOString() : undefined,
    };
  }
  const durationMs = PRESET_DURATION_MS[period.preset];
  return durationMs ? { reportedFrom: new Date(now - durationMs).toISOString() } : {};
}

export function todayAsInputValue(now = new Date()): string {
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
