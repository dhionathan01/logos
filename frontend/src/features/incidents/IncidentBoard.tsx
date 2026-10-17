import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { Incident, Severity } from "../../api/types";
import { Button } from "../../shared/components/Button";
import { Spinner } from "../../shared/components/Spinner";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useSession } from "../auth/useSession";
import { ErrorState, EmptyState, ListSkeleton, StaleDataBanner } from "./components/BoardStates";
import { FilterBar } from "./components/FilterBar";
import { IncidentDrawer } from "./components/IncidentDrawer";
import { IncidentRow } from "./components/IncidentRow";
import { NewIncidentDialog } from "./components/NewIncidentDialog";
import { PaginationBar } from "./components/PaginationBar";
import { SeveritySummary } from "./components/SeveritySummary";
import { hasCustomFilters, useIncidentFilters } from "./filters";
import { totalPages } from "./pagination";
import { useChangeStatus, useIncidents, useIncidentSummary, usePendingIncidentIds } from "./hooks";
import styles from "./IncidentBoard.module.css";
import { formatTime, useNow } from "./time";

export function IncidentBoard() {
  const {
    filters,
    toggle,
    setSearch,
    setAssignee,
    setPeriod,
    clear,
    setPage,
    setPageSize,
    setShowAll,
  } = useIncidentFilters();
  const [params, setParams] = useSearchParams();
  const [isCreating, setIsCreating] = useState(false);
  const { user } = useSession();
  const isOnline = useOnlineStatus();
  const now = useNow();

  const incidents = useIncidents(filters);
  const summary = useIncidentSummary();
  const changeStatus = useChangeStatus();
  const pendingIds = usePendingIncidentIds();

  const selectedId = params.get("incident");
  const openIncident = useCallback(
    (incident: Incident) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("incident", incident.id);
        return next;
      }),
    [setParams],
  );
  const closeIncident = useCallback(
    () =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("incident");
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const claim = useCallback(
    (incident: Incident) => changeStatus.mutate({ incident, target: "investigating" }),
    [changeStatus],
  );

  const page = incidents.data;
  const showStaleWarning = incidents.isError && page !== undefined;

  return (
    <div className={styles.board}>
      <div className={styles.heading}>
        <div>
          <h1 className={styles.title}>Fila de incidentes</h1>
          <p className={styles.subtitle} aria-live="polite">
            {page ? (
              <>
                {page.total} {page.total === 1 ? "incidente" : "incidentes"}
                {" · "}
                {incidents.isFetching ? (
                  <span className={styles.refreshing}>
                    <Spinner size={10} /> atualizando
                  </span>
                ) : (
                  `atualizado às ${formatTime(incidents.dataUpdatedAt)}`
                )}
              </>
            ) : (
              "Carregando a fila…"
            )}
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setIsCreating(true)}>
          Novo incidente
        </Button>
      </div>

      <SeveritySummary
        summary={summary.data}
        selected={filters.severity}
        onToggle={(severity: Severity) => toggle("severity", severity)}
      />

      <FilterBar
        filters={filters}
        onToggleCategory={(category) => toggle("category", category)}
        onToggleStatus={(status) => toggle("status", status)}
        onSearch={setSearch}
        onAssigneeChange={setAssignee}
        onPeriodChange={setPeriod}
        onClear={clear}
      />

      {showStaleWarning && <StaleDataBanner updatedAt={incidents.dataUpdatedAt} />}

      <section
        className={styles.list}
        aria-label="Incidentes ordenados por prioridade"
        aria-busy={incidents.isPlaceholderData || undefined}
        data-dimmed={incidents.isPlaceholderData || undefined}
        data-scroll={filters.pagination.showAll || undefined}
        tabIndex={filters.pagination.showAll ? 0 : undefined}
      >
        {incidents.isPending ? (
          <ListSkeleton />
        ) : !page ? (
          <ErrorState
            message={incidents.error?.message ?? "Erro desconhecido."}
            isRetrying={incidents.isFetching}
            onRetry={() => void incidents.refetch()}
          />
        ) : page.items.length === 0 && page.total > 0 ? (
          // A fila encolheu (incidentes fechados) e esta página ficou vazia.
          <div className={styles.pageGone}>
            <p>Esta página não tem mais incidentes; a fila diminuiu desde que você chegou aqui.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(totalPages(page.total, filters.pagination.pageSize))}
            >
              Ir para a última página
            </Button>
          </div>
        ) : page.items.length === 0 ? (
          <EmptyState hasFilters={hasCustomFilters(filters)} onClearFilters={clear} />
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
          pagination={filters.pagination}
          total={page.total}
          shown={page.items.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          onShowAllChange={setShowAll}
        />
      )}

      <IncidentDrawer incidentId={selectedId} onClose={closeIncident} />
      <NewIncidentDialog open={isCreating} onClose={() => setIsCreating(false)} />
    </div>
  );
}
