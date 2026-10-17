import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { Category, IncidentStatus } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Chip, ChipGroup } from "../../../shared/components/Chips";
import { type PeriodFilter, QUEUE_PERIODS } from "../../../shared/period/period";
import { PeriodPicker } from "../../../shared/period/PeriodPicker";
import { type IncidentFilters, hasCustomFilters } from "../filters";
import { CATEGORIES, CATEGORY_META, STATUSES, STATUS_LABEL } from "../labels";
import styles from "./FilterBar.module.css";

const SEARCH_DEBOUNCE_MS = 300;

interface FilterBarProps {
  filters: IncidentFilters;
  onToggleCategory: (category: Category) => void;
  onToggleStatus: (status: IncidentStatus) => void;
  onSearch: (search: string) => void;
  onPeriodChange: (period: PeriodFilter) => void;
  onClear: () => void;
}

export function FilterBar({
  filters,
  onToggleCategory,
  onToggleStatus,
  onSearch,
  onPeriodChange,
  onClear,
}: FilterBarProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [appliedSearch, setAppliedSearch] = useState(filters.search);

  // A URL mudou por fora (voltar do navegador, "limpar filtros"): o campo acompanha.
  if (filters.search !== appliedSearch) {
    setAppliedSearch(filters.search);
    setSearchDraft(filters.search);
  }

  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = window.setTimeout(() => onSearch(searchDraft), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search, onSearch]);

  return (
    <section className={styles.bar} aria-label="Filtros">
      <div className={styles.row}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <span className="visually-hidden">Buscar</span>
          <input
            type="search"
            placeholder="Buscar por título, veículo ou local"
            value={searchDraft}
            maxLength={100}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>
        {hasCustomFilters(filters) && (
          <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={onClear}>
            Limpar filtros
          </Button>
        )}
      </div>

      <div className={styles.groups}>
        <ChipGroup label="Status">
          {STATUSES.map((status) => (
            <Chip
              key={status}
              pressed={filters.status.includes(status)}
              onClick={() => onToggleStatus(status)}
            >
              {STATUS_LABEL[status]}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label="Categoria">
          {CATEGORIES.map((category) => {
            const { label, icon: Icon } = CATEGORY_META[category];
            return (
              <Chip
                key={category}
                pressed={filters.category.includes(category)}
                onClick={() => onToggleCategory(category)}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </Chip>
            );
          })}
        </ChipGroup>
        <PeriodPicker
          label="Ocorrido em"
          options={QUEUE_PERIODS}
          value={filters.period}
          onChange={onPeriodChange}
        />
      </div>
    </section>
  );
}
