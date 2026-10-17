import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";

import { useElementWidth } from "../../../shared/hooks/useElementWidth";
import type { DailyPoint } from "../api";
import { formatCount, formatDay, formatLongDay } from "../format";
import styles from "./DailyTrendChart.module.css";

const HEIGHT = 240;
const END_LABEL_MIN_GAP = 14;
const MARGIN = { top: 16, right: 56, bottom: 28, left: 36 };
const SERIES = [
  { key: "reported", label: "Registrados", color: "var(--chart-reported)" },
  { key: "closed", label: "Resolvidos", color: "var(--chart-resolved)" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

/** Eixo com números redondos: 0, 5, 10… em vez de 0, 7, 14. */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude * 4 >= value) ?? 10;
  return step * magnitude * 4;
}

export function DailyTrendChart({ points }: { points: DailyPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(containerRef);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 1);
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const maxValue = niceMax(Math.max(1, ...points.flatMap((p) => [p.reported, p.closed])));
    const x = (index: number) =>
      MARGIN.left +
      (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = (value: number) => MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
    const path = (key: SeriesKey) =>
      points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[key])}`).join(" ");
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => Math.round(maxValue * fraction));
    const labelEvery = Math.max(
      1,
      Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 70))),
    );
    return { plotWidth, plotHeight, x, y, path, ticks, labelEvery };
  }, [points, width]);

  if (points.length === 0) {
    return <p className={styles.empty}>Sem incidentes no período selecionado.</p>;
  }

  const last = points.length - 1;
  const lastPoint = points[last]!;
  const active = activeIndex !== null ? points[activeIndex] : undefined;
  // Linhas convergindo no fim: rótulos empilhados se descolam das linhas e viram ruído.
  // Nesse caso ficam só os marcadores; legenda, tooltip e tabela continuam com os valores.
  const endLabelsCollide =
    Math.abs(geometry.y(lastPoint.reported) - geometry.y(lastPoint.closed)) < END_LABEL_MIN_GAP;

  const handlePointer = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    setActiveIndex(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  const handleKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActiveIndex((current) => Math.min(last, Math.max(0, (current ?? last) + step)));
  };

  return (
    <div className={styles.chart}>
      <ul className={styles.legend} aria-label="Legenda">
        {SERIES.map((series) => (
          <li key={series.key}>
            <span className={styles.legendKey} style={{ background: series.color }} />
            {series.label}
          </li>
        ))}
      </ul>

      <div ref={containerRef} className={styles.canvas}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Registrados e resolvidos por dia, de ${formatDay(points[0]!.day)} a ${formatDay(lastPoint.day)}. Use as setas para navegar pelos dias.`}
          tabIndex={0}
          onKeyDown={handleKey}
          onBlur={() => setActiveIndex(null)}
        >
          {geometry.ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + geometry.plotWidth}
                y1={geometry.y(tick)}
                y2={geometry.y(tick)}
                className={styles.grid}
              />
              <text x={MARGIN.left - 8} y={geometry.y(tick)} className={styles.yTick}>
                {formatCount(tick)}
              </text>
            </g>
          ))}

          {points.map((point, index) =>
            index === last ||
            (index % geometry.labelEvery === 0 && last - index >= geometry.labelEvery * 0.6) ? (
              <text key={point.day} x={geometry.x(index)} y={HEIGHT - 8} className={styles.xTick}>
                {formatDay(point.day)}
              </text>
            ) : null,
          )}

          {SERIES.map((series) => (
            <path
              key={series.key}
              d={geometry.path(series.key)}
              className={styles.line}
              style={{ stroke: series.color }}
            />
          ))}

          {/* Rótulo direto só no último ponto de cada série: o resto fica no tooltip e na tabela. */}
          {SERIES.map((series) => (
            <g key={`end-${series.key}`}>
              <circle
                cx={geometry.x(last)}
                cy={geometry.y(lastPoint[series.key])}
                r={4}
                className={styles.marker}
                style={{ fill: series.color }}
              />
              {!endLabelsCollide && (
                <text
                  x={geometry.x(last) + 10}
                  y={geometry.y(lastPoint[series.key])}
                  className={styles.endLabel}
                >
                  {formatCount(lastPoint[series.key])}
                </text>
              )}
            </g>
          ))}

          {activeIndex !== null && (
            <g>
              <line
                x1={geometry.x(activeIndex)}
                x2={geometry.x(activeIndex)}
                y1={MARGIN.top}
                y2={MARGIN.top + geometry.plotHeight}
                className={styles.crosshair}
              />
              {SERIES.map((series) => (
                <circle
                  key={series.key}
                  cx={geometry.x(activeIndex)}
                  cy={geometry.y(points[activeIndex]![series.key])}
                  r={4}
                  className={styles.marker}
                  style={{ fill: series.color }}
                />
              ))}
            </g>
          )}

          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={geometry.plotWidth}
            height={geometry.plotHeight}
            className={styles.hitArea}
            onPointerMove={handlePointer}
            onPointerLeave={() => setActiveIndex(null)}
          />
        </svg>

        {active && activeIndex !== null && (
          <div
            className={styles.tooltip}
            role="status"
            style={{
              left: Math.min(geometry.x(activeIndex) + 12, width - 170),
              top: MARGIN.top,
            }}
          >
            <p className={styles.tooltipTitle}>{formatLongDay(active.day)}</p>
            {SERIES.map((series) => (
              <p key={series.key} className={styles.tooltipRow}>
                <span className={styles.tooltipKey} style={{ background: series.color }} />
                <strong>{formatCount(active[series.key])}</strong>
                <span>{series.label.toLowerCase()}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className={styles.table}>
        <summary>Ver dados em tabela</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">Registrados</th>
              <th scope="col">Resolvidos</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <th scope="row">{formatLongDay(point.day)}</th>
                <td>{formatCount(point.reported)}</td>
                <td>{formatCount(point.closed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
