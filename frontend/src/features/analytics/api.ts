import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { request } from "../../api/httpClient";
import type { components } from "../../api/schema";
import { type PeriodFilter, periodToRange } from "../../shared/period/period";

export type AnalyticsReport = components["schemas"]["AnalyticsReport"];
export type CategoryStats = components["schemas"]["CategoryStats"];
export type SeverityStats = components["schemas"]["SeverityStats"];
export type AnalystStats = components["schemas"]["AnalystStats"];
export type DailyPoint = components["schemas"]["DailyPoint"];

const REFRESH_INTERVAL_MS = 60_000;

export const analyticsKeys = {
  all: ["analytics"] as const,
  report: (period: PeriodFilter) => [...analyticsKeys.all, period] as const,
};

export function fetchReport(period: PeriodFilter, signal?: AbortSignal) {
  const query = new URLSearchParams({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const { reportedFrom, reportedTo } = periodToRange(period, Date.now());
  if (reportedFrom) query.set("reported_from", reportedFrom);
  if (reportedTo) query.set("reported_to", reportedTo);
  return request<AnalyticsReport>("/analytics", { query, signal });
}

/** Indicadores mudam devagar: atualiza a cada minuto e mantém o painel anterior ao trocar o período. */
export function useAnalytics(period: PeriodFilter) {
  return useQuery({
    queryKey: analyticsKeys.report(period),
    queryFn: ({ signal }) => fetchReport(period, signal),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
}
