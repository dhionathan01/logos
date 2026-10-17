import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../shared/components/Button";
import { Spinner } from "../../shared/components/Spinner";
import {
  DASHBOARD_PERIODS,
  type PeriodFilter,
  parsePeriod,
  writePeriod,
} from "../../shared/period/period";
import { PeriodPicker } from "../../shared/period/PeriodPicker";
import { formatTime } from "../incidents/time";
import { useAnalytics } from "./api";
import styles from "./AnalyticsPage.module.css";
import { AnalystComparison } from "./components/AnalystComparison";
import { CategoryBreakdown } from "./components/CategoryBreakdown";
import { DailyTrendChart } from "./components/DailyTrendChart";
import { KpiRow } from "./components/KpiRow";
import { SeveritySla } from "./components/SeveritySla";

const DEFAULT_PERIOD = "30d";

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params, DEFAULT_PERIOD);
  const analytics = useAnalytics(period);
  const report = analytics.data;

  const changePeriod = (next: PeriodFilter) =>
    setParams((current) => writePeriod(current, next, DEFAULT_PERIOD), { replace: true });

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1 className={styles.title}>Painel analítico</h1>
          <p className={styles.subtitle} aria-live="polite">
            {analytics.isFetching ? (
              <span className={styles.refreshing}>
                <Spinner size={10} /> atualizando indicadores
              </span>
            ) : report ? (
              `Indicadores por data de ocorrência · atualizado às ${formatTime(analytics.dataUpdatedAt)}`
            ) : (
              "Carregando indicadores…"
            )}
          </p>
        </div>
      </header>

      {/* Um único filtro, acima de tudo o que ele afeta: todos os números concordam entre si. */}
      <PeriodPicker
        label="Período"
        options={DASHBOARD_PERIODS}
        value={period}
        onChange={changePeriod}
      />

      {analytics.isError && report && (
        <p className={styles.stale} role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          Não foi possível atualizar. Exibindo os indicadores de{" "}
          {formatTime(analytics.dataUpdatedAt)}.
        </p>
      )}

      {analytics.isPending ? (
        <div className={styles.loading} role="status" aria-label="Carregando indicadores">
          {Array.from({ length: 3 }, (_, index) => (
            <span key={index} className={styles.placeholder} />
          ))}
        </div>
      ) : !report ? (
        <div className={styles.error} role="alert">
          <AlertTriangle size={28} aria-hidden="true" />
          <h2>Não foi possível carregar os indicadores</h2>
          <p>{analytics.error?.message}</p>
          <Button
            icon={<RefreshCw size={16} />}
            isLoading={analytics.isFetching}
            onClick={() => void analytics.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div
          className={styles.content}
          data-dimmed={analytics.isPlaceholderData || undefined}
          aria-busy={analytics.isPlaceholderData || undefined}
        >
          <KpiRow overview={report.overview} />

          <Panel
            title="Registrados × resolvidos por dia"
            description="Se a linha de resolvidos fica abaixo da de registrados por vários dias, a fila está crescendo."
          >
            <DailyTrendChart points={report.daily} />
          </Panel>

          <div className={styles.columns}>
            <Panel
              title="Por categoria"
              description="Que tipo de incidente mais ocorre e quanto dele é resolvido dentro do prazo."
            >
              <CategoryBreakdown categories={report.by_category} />
            </Panel>
            <Panel
              title="SLA por criticidade"
              description="Prazos medidos desde a ocorrência: resposta até alguém assumir, resolução até fechar."
            >
              <SeveritySla severities={report.by_severity} />
            </Panel>
          </div>

          <Panel
            title="Analistas"
            description="Volume, resolução e prazo por pessoa, e a especialidade de cada uma por tipo de incidente."
          >
            <AnalystComparison analysts={report.by_analyst} />
          </Panel>
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHeader}>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}
