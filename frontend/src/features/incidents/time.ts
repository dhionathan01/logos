import { useEffect, useState } from "react";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Incidente de criticidade alta aberto há mais que isso merece destaque. */
export const HIGH_SEVERITY_ATTENTION_MS = 30 * MINUTE;

export function elapsedSince(isoDate: string, now: number): number {
  return Math.max(0, now - new Date(isoDate).getTime());
}

/** Tempo compacto para leitura rápida: "agora", "12 min", "2 h 05", "3 d". */
export function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < MINUTE) return "agora";
  if (elapsedMs < HOUR) return `${Math.floor(elapsedMs / MINUTE)} min`;
  if (elapsedMs < DAY) {
    const hours = Math.floor(elapsedMs / HOUR);
    const minutes = Math.floor((elapsedMs % HOUR) / MINUTE);
    return `${hours} h ${String(minutes).padStart(2, "0")}`;
  }
  return `${Math.floor(elapsedMs / DAY)} d`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" });

const shortTimeFormatter = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });
const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export const formatDateTime = (value: string | number) => dateTimeFormatter.format(new Date(value));
export const formatTime = (value: number) => timeFormatter.format(new Date(value));

/** Horário curto para a lista: "hoje 14:32", "ontem 09:10" ou "12/10 18:05". */
export function formatOccurrence(isoDate: string, now: number): string {
  const date = new Date(isoDate);
  const today = new Date(now);
  const yesterday = new Date(now - DAY);
  const time = shortTimeFormatter.format(date);
  if (date.toDateString() === today.toDateString()) return `hoje ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `ontem ${time}`;
  return `${dayMonthFormatter.format(date)} ${time}`;
}

/** Relógio compartilhado que faz os tempos "há X min" avançarem sem recarregar dados. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
