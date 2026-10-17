import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { Category, IncidentStatus, Severity } from "../../api/types";
import {
  type PeriodFilter,
  parsePeriod,
  periodToRange,
  writePeriod,
} from "../../shared/period/period";
import { ACTIVE_STATUSES, CATEGORIES, SEVERITIES, STATUSES } from "./labels";
import { type PageSize, type Pagination, paginationToQuery, parsePagination } from "./pagination";

export interface IncidentFilters {
  severity: Severity[];
  category: Category[];
  status: IncidentStatus[];
  search: string;
  period: PeriodFilter;
  pagination: Pagination;
}

/** Preferências de exibição: sobrevivem a "limpar filtros". */
const DISPLAY_PARAMS = ["incident", "size", "all"];

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
    pagination: parsePagination(params),
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
  const { limit, offset } = paginationToQuery(filters.pagination);
  query.set("limit", String(limit));
  query.set("offset", String(offset));
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

/** Um filtro novo muda o conjunto de resultados: a página atual pode nem existir mais. */
function withoutPage(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("page");
  return next;
}

export function useIncidentFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const toggle = useCallback(
    (key: ListKey, value: string) => {
      setParams(
        (current) => {
          const next = withoutPage(current);
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
          const next = withoutPage(current);
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
      setParams((current) => writePeriod(withoutPage(current), period), { replace: true });
    },
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams();
        DISPLAY_PARAMS.forEach((key) => {
          const value = current.get(key);
          if (value) next.set(key, value);
        });
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  // Mudar de página entra no histórico: o botão voltar retorna à página anterior.
  const setPage = useCallback(
    (page: number) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (page > 1) next.set("page", String(page));
        else next.delete("page");
        return next;
      }),
    [setParams],
  );

  const setPageSize = useCallback(
    (size: PageSize) =>
      setParams(
        (current) => {
          const next = withoutPage(current);
          next.set("size", String(size));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setShowAll = useCallback(
    (showAll: boolean) =>
      setParams(
        (current) => {
          const next = withoutPage(current);
          if (showAll) next.set("all", "1");
          else next.delete("all");
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return { filters, toggle, setSearch, setPeriod, clear, setPage, setPageSize, setShowAll };
}
