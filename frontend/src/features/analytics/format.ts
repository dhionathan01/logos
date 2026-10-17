const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const countFormatter = new Intl.NumberFormat("pt-BR");
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const longDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

/** "—" quando não há base para a métrica (ex.: nenhum incidente fechado no período). */
export const EMPTY_VALUE = "—";

export function formatPercent(rate: number | null | undefined): string {
  return rate == null ? EMPTY_VALUE : percentFormatter.format(rate);
}

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** Duração legível para gestão: "45 min", "3 h 20", "2 d 4 h". */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return EMPTY_VALUE;
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  if (rounded < 24 * 60) {
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
  }
  const days = Math.floor(rounded / (24 * 60));
  const hours = Math.floor((rounded % (24 * 60)) / 60);
  return hours ? `${days} d ${hours} h` : `${days} d`;
}

/** Datas da série diária chegam como "AAAA-MM-DD", sem fuso: não passar por new Date(string). */
function parseDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
}

export const formatDay = (day: string) => dayFormatter.format(parseDay(day));
export const formatLongDay = (day: string) => longDayFormatter.format(parseDay(day));
