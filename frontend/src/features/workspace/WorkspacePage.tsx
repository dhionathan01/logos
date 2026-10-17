import { ClipboardCheck, Inbox } from "lucide-react";
import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { Incident, IncidentStatus } from "../../api/types";
import { Spinner } from "../../shared/components/Spinner";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import {
  ALL_TIME,
  DASHBOARD_PERIODS,
  type PeriodFilter,
  parsePeriod,
  writePeriod,
} from "../../shared/period/period";
import { PeriodPicker } from "../../shared/period/PeriodPicker";
import { useAnalytics } from "../analytics/api";
import { formatCount, formatMinutes, formatPercent } from "../analytics/format";
import { useSession } from "../auth/useSession";
import {
  ErrorState,
  ListSkeleton,
  MessageState,
  StaleDataBanner,
} from "../incidents/components/BoardStates";
import { IncidentDrawer } from "../incidents/components/IncidentDrawer";
import { IncidentRow } from "../incidents/components/IncidentRow";
import { PaginationBar } from "../incidents/components/PaginationBar";
import type { IncidentFilters, IncidentSort } from "../incidents/filters";
import { useChangeStatus, useIncidents, usePendingIncidentIds } from "../incidents/hooks";
import { type PageSize, type Pagination, parsePagination } from "../incidents/pagination";
import { formatTime, useNow } from "../incidents/time";
import styles from "./WorkspacePage.module.css";

type Tab = "active" | "closed";

const TABS: Record<Tab, { label: string; status: IncidentStatus[]; sort: IncidentSort }> = {
  // O que está comigo agora: ordem de prioridade, como na fila.
  active: { label: "Em andamento", status: ["investigating", "inconclusive"], sort: "priority" },
  // O que concluí: o mais recente primeiro.
  closed: { label: "Concluídos", status: ["closed"], sort: "recent" },
};

const DEFAULT_PERIOD = "30d";
const FIRST_PAGE: Pagination = { page: 1, pageSize: 25, showAll: false };

/**
 * Meu ambiente: os incidentes que estão com o analista logado e os que ele concluiu,
 * com os números pessoais do período. Cada analista vê o seu.
 */
export function WorkspacePage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "concluidos" ? "closed" : "active";
  const period = parsePeriod(params, DEFAULT_PERIOD);
  const pagination = parsePagination(params);
  const now = useNow();
  const isOnline = useOnlineStatus();
  const pendingIds = usePendingIncidentIds();
  const changeStatus = useChangeStatus();

  const filtersFor = (target: Tab): IncidentFilters => ({
    severity: [],
    category: [],
    status: TABS[target].status,
    search: "",
    // Em andamento é "agora"; só os concluídos respeitam o período.
    period: target === "closed" ? period : ALL_TIME,
    pagination: target === tab ? pagination : FIRST_PAGE,
    assignee: user ? [user.id] : [],
    sort: TABS[target].sort,
  });
  // As duas listas são consultadas: a aba ao lado mostra a contagem sem precisar abrir.
  const lists = {
    active: useIncidents(filtersFor("active")),
    closed: useIncidents(filtersFor("closed")),
  };
  const current = lists[tab];
  const page = current.data;

  const analytics = useAnalytics(period);
  const mine = analytics.data?.by_analyst.find((row) => row.analyst.id === user?.id);

  const update = useCallback(
    (change: (next: URLSearchParams) => void, replace = true) =>
      setParams(
        (currentParams) => {
          const next = new URLSearchParams(currentParams);
          change(next);
          return next;
        },
        { replace },
      ),
    [setParams],
  );

  const selectTab = (target: Tab) =>
    update((next) => {
      next.delete("page");
      if (target === "closed") next.set("tab", "concluidos");
      else next.delete("tab");
    }, false);
  const changePeriod = (next: PeriodFilter) =>
    setParams((currentParams) => writePeriod(withoutPage(currentParams), next, DEFAULT_PERIOD), {
      replace: true,
    });
  const setPage = (target: number) =>
    update((next) => (target > 1 ? next.set("page", String(target)) : next.delete("page")), false);
  const setPageSize = (size: PageSize) =>
    update((next) => {
      next.delete("page");
      next.set("size", String(size));
    });
  const setShowAll = (showAll: boolean) =>
    update((next) => {
      next.delete("page");
      if (showAll) next.set("all", "1");
      else next.delete("all");
    });
  const openIncident = useCallback(
    (incident: Incident) => update((next) => next.set("incident", incident.id), false),
    [update],
  );
  const closeIncident = useCallback(() => update((next) => next.delete("incident")), [update]);
  const claim = useCallback(
    (incident: Incident) => changeStatus.mutate({ incident, target: "investigating" }),
    [changeStatus],
  );

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1 className={styles.title}>Meu ambiente</h1>
          <p className={styles.subtitle} aria-live="polite">
            {user?.display_name}
            {" · "}
            {current.isFetching ? (
              <span className={styles.refreshing}>
                <Spinner size={10} /> atualizando
              </span>
            ) : page ? (
              `atualizado às ${formatTime(current.dataUpdatedAt)}`
            ) : (
              "carregando…"
            )}
          </p>
        </div>
        <div className={styles.period}>
          <PeriodPicker
            label="Período"
            options={DASHBOARD_PERIODS}
            value={period}
            defaultPreset={DEFAULT_PERIOD}
            onChange={changePeriod}
          />
        </div>
      </header>

      <section className={styles.stats} aria-label="Meus números">
        <Stat label="Comigo agora" value={formatCountOrDash(lists.active.data?.total)}>
          em investigação ou inconclusivos
        </Stat>
        <Stat label="Concluídos" value={formatCountOrDash(lists.closed.data?.total)}>
          {period.preset === "all" ? "desde o início" : "ocorridos no período"}
        </Stat>
        <Stat
          label="Tempo médio de resolução"
          value={mine ? formatMinutes(mine.avg_resolution_minutes) : "—"}
        >
          desde a ocorrência até fechar
        </Stat>
        <Stat
          label="Resolvidos no prazo"
          value={mine ? formatPercent(mine.resolution_sla_rate) : "—"}
        >
          {mine ? `dos ${formatCount(mine.closed)} que você fechou` : "sem conclusões no período"}
        </Stat>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Meus incidentes">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls="workspace-panel"
            className={styles.tab}
            onClick={() => selectTab(key)}
          >
            {TABS[key].label}
            <span className={styles.count}>{lists[key].data?.total ?? "…"}</span>
          </button>
        ))}
      </div>

      {current.isError && page && <StaleDataBanner updatedAt={current.dataUpdatedAt} />}

      <section
        id="workspace-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className={styles.list}
        aria-busy={current.isPlaceholderData || undefined}
        data-dimmed={current.isPlaceholderData || undefined}
        data-scroll={pagination.showAll || undefined}
        tabIndex={pagination.showAll ? 0 : undefined}
      >
        {current.isPending ? (
          <ListSkeleton rows={4} />
        ) : !page ? (
          <ErrorState
            message={current.error?.message ?? "Erro desconhecido."}
            isRetrying={current.isFetching}
            onRetry={() => void current.refetch()}
          />
        ) : page.items.length === 0 ? (
          tab === "active" ? (
            <MessageState icon={<Inbox size={32} aria-hidden="true" />} title="Nada com você agora">
              <p>
                Os incidentes que você assumir aparecem aqui até serem concluídos.{" "}
                <Link to="/" viewTransition>
                  Ir para a fila
                </Link>
              </p>
            </MessageState>
          ) : (
            <MessageState
              icon={<ClipboardCheck size={32} aria-hidden="true" />}
              title="Nenhum incidente concluído no período"
            >
              <p>Escolha um período maior para ver seu histórico.</p>
            </MessageState>
          )
        ) : (
          <ul className={styles.rows}>
            {page.items.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                now={now}
                isPending={pendingIds.has(incident.id)}
                isOffline={!isOnline}
                currentUserId={user?.id}
                onOpen={openIncident}
                onClaim={claim}
              />
            ))}
          </ul>
        )}
      </section>

      {page && page.total > 0 && (
        <PaginationBar
          pagination={pagination}
          total={page.total}
          shown={page.items.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onShowAllChange={setShowAll}
        />
      )}

      <IncidentDrawer incidentId={params.get("incident")} onClose={closeIncident} />
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statCaption}>{children}</span>
    </div>
  );
}

function formatCountOrDash(value: number | undefined): string {
  return value === undefined ? "—" : formatCount(value);
}

function withoutPage(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("page");
  return next;
}
