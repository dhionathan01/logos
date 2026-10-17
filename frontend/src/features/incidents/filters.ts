import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { Category, IncidentStatus, Severity } from "../../api/types";
import { ACTIVE_STATUSES, CATEGORIES, SEVERITIES, STATUSES } from "./labels";
import { type PeriodFilter, parsePeriod, periodToRange } from "./period";

export interface IncidentFilters {
  severity: Severity[];
  category: Category[];
  status: IncidentStatus[];
  search: string;
  period: PeriodFilter;
}

function pickAllowed<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return allowed.filter((value) => values.includes(value));
}

/**
 * Filtros vivem na URL: dá para compartilhar uma visão ("só alta criticidade")
 * e o botão voltar do navegador funciona. Valores desconhecidos são ignorados.
 */
export function parseFilters(params: URLSearchParams): IncidentFilters {
  const status = pickAllowed(params.getAll("status"), STATUSES);
  return {
    severity: pickAllowed(params.getAll("severity"), SEVERITIES),
    category: pickAllowed(params.getAll("category"), CATEGORIES),
    // Gestão por exceção: sem filtro explícito, a fila mostra só o que ainda exige ação.
    status: status.length > 0 ? status : ACTIVE_STATUSES,
    search: (params.get("q") ?? "").slice(0, 100),
    period: parsePeriod(params),
  };
}

export function toApiQuery(filters: IncidentFilters, now = Date.now()): URLSearchParams {
  const query = new URLSearchParams();
  filters.severity.forEach((value) => query.append("severity", value));
  filters.category.forEach((value) => query.append("category", value));
  filters.status.forEach((value) => query.append("status", value));
  if (filters.search.trim()) query.set("search", filters.search.trim());
  const { reportedFrom, reportedTo } = periodToRange(filters.period, now);
  if (reportedFrom) query.set("reported_from", reportedFrom);
  if (reportedTo) query.set("reported_to", reportedTo);
  return query;
}

export function hasCustomFilters(filters: IncidentFilters): boolean {
  const isDefaultStatus =
    filters.status.length === ACTIVE_STATUSES.length &&
    ACTIVE_STATUSES.every((status) => filters.status.includes(status));
  return (
    filters.severity.length > 0 ||
    filters.category.length > 0 ||
    !isDefaultStatus ||
    filters.search.trim() !== "" ||
    filters.period.preset !== "all"
  );
}

type ListKey = "severity" | "category" | "status";

export function useIncidentFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const toggle = useCallback(
    (key: ListKey, value: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          const selected: string[] =
            key === "status" ? parseFilters(current).status : next.getAll(key);
          const updated = selected.includes(value)
            ? selected.filter((item) => item !== value)
            : [...selected, value];
          next.delete(key);
          updated.forEach((item) => next.append(key, item));
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setSearch = useCallback(
    (search: string) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (search) next.set("q", search);
          else next.delete("q");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setPeriod = useCallback(
    (period: PeriodFilter) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          ["period", "from", "to"].forEach((key) => next.delete(key));
          if (period.preset !== "all") next.set("period", period.preset);
          if (period.preset === "custom") {
            if (period.from) next.set("from", period.from);
            if (period.to) next.set("to", period.to);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams();
        const selectedIncident = current.get("incident");
        if (selectedIncident) next.set("incident", selectedIncident);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return { filters, toggle, setSearch, setPeriod, clear };
}
