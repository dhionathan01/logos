import { AlertTriangle, CheckCircle2, RefreshCw, SearchX } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import { formatTime } from "../time";
import styles from "./BoardStates.module.css";

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} role="status" aria-label="Carregando incidentes">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <span className={styles.bone} style={{ width: 64 }} />
          <span className={styles.bone} style={{ width: `${40 + ((index * 17) % 35)}%` }} />
          <span className={styles.bone} style={{ width: 48, marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  isRetrying,
  onRetry,
}: {
  message: string;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className={styles.state} role="alert">
      <AlertTriangle size={32} className={styles.errorIcon} aria-hidden="true" />
      <h2>Não foi possível carregar os incidentes</h2>
      <p>{message}</p>
      <Button icon={<RefreshCw size={16} />} isLoading={isRetrying} onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function EmptyState({
  hasFilters,
  onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div className={styles.state}>
        <SearchX size={32} aria-hidden="true" />
        <h2>Nenhum incidente com esses filtros</h2>
        <p>Ajuste ou limpe os filtros para ver a fila completa.</p>
        <Button variant="secondary" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.state}>
      <CheckCircle2 size={32} className={styles.successIcon} aria-hidden="true" />
      <h2>Nenhum incidente ativo</h2>
      <p>A operação está em dia. Novos incidentes aparecem aqui automaticamente.</p>
    </div>
  );
}

/** Falha ao atualizar, mas há dados anteriores: mostra-os com aviso, em vez de uma tela de erro. */
export function StaleDataBanner({ updatedAt }: { updatedAt: number }) {
  return (
    <div className={styles.stale} role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      Não foi possível atualizar a fila. Exibindo dados de {formatTime(updatedAt)}; tentando de novo
      automaticamente.
    </div>
  );
}
