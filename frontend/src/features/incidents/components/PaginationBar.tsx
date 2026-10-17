import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../../shared/components/Button";
import {
  PAGE_SIZES,
  type PageSize,
  type Pagination,
  SHOW_ALL_LIMIT,
  pageWindow,
  totalPages,
} from "../pagination";
import styles from "./PaginationBar.module.css";

interface PaginationBarProps {
  pagination: Pagination;
  total: number;
  shown: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  onShowAllChange: (showAll: boolean) => void;
}

export function PaginationBar({
  pagination,
  total,
  shown,
  onPageChange,
  onPageSizeChange,
  onShowAllChange,
}: PaginationBarProps) {
  const { page, pageSize, showAll } = pagination;
  const last = totalPages(total, pageSize);
  const first = total === 0 ? 0 : showAll ? 1 : (page - 1) * pageSize + 1;
  const end = showAll ? shown : Math.min(page * pageSize, total);

  return (
    <nav className={styles.bar} aria-label="Paginação da fila">
      <p className={styles.range} aria-live="polite">
        {total === 0 ? "Nenhum incidente" : `Mostrando ${first}–${end} de ${total}`}
        {showAll && total > SHOW_ALL_LIMIT && (
          <span className={styles.limit}>
            {" "}
            · exibindo os {SHOW_ALL_LIMIT} mais prioritários; use os filtros para refinar
          </span>
        )}
      </p>

      <div className={styles.controls}>
        {!showAll && last > 1 && (
          <div className={styles.pages}>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Página anterior"
              icon={<ChevronLeft size={16} />}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            {pageWindow(Math.min(page, last), last).map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className={styles.gap} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={styles.page}
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`Página ${item}`}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </button>
              ),
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Próxima página"
              icon={<ChevronRight size={16} />}
              disabled={page >= last}
              onClick={() => onPageChange(page + 1)}
            />
          </div>
        )}

        {!showAll && (
          <label className={styles.size}>
            <span>Por página</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => onShowAllChange(event.target.checked)}
          />
          Exibir todos
        </label>
      </div>
    </nav>
  );
}
