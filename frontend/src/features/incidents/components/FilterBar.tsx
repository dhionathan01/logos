import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { Category, IncidentStatus } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Dropdown, DropdownOption } from "../../../shared/components/Dropdown";
import { summarizeSelection } from "../../../shared/components/summarizeSelection";
import { type PeriodFilter, QUEUE_PERIODS } from "../../../shared/period/period";
import { PeriodPicker } from "../../../shared/period/PeriodPicker";
import { type IncidentFilters, hasCustomFilters, isDefaultStatus } from "../filters";
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

      <div className={styles.dropdowns}>
        <Dropdown
          label="Status"
          summary={
            isDefaultStatus(filters.status)
              ? "Ativos"
              : summarizeSelection(filters.status.map((status) => STATUS_LABEL[status]))
          }
          isActive={!isDefaultStatus(filters.status)}
        >
          {STATUSES.map((status) => (
            <DropdownOption
              key={status}
              type="checkbox"
              checked={filters.status.includes(status)}
              onChange={() => onToggleStatus(status)}
            >
              {STATUS_LABEL[status]}
            </DropdownOption>
          ))}
        </Dropdown>
        <Dropdown
          label="Categoria"
          summary={summarizeSelection(
            filters.category.map((category) => CATEGORY_META[category].shortLabel),
            "Todas",
          )}
          isActive={filters.category.length > 0}
        >
          {CATEGORIES.map((category) => {
            const { label, icon: Icon } = CATEGORY_META[category];
            return (
              <DropdownOption
                key={category}
                type="checkbox"
                checked={filters.category.includes(category)}
                onChange={() => onToggleCategory(category)}
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </DropdownOption>
            );
          })}
        </Dropdown>
        <PeriodPicker
          label="Ocorrido em"
          options={QUEUE_PERIODS}
          value={filters.period}
          onChange={onPeriodChange}
        />
      </div>

      {hasCustomFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          icon={<X size={14} />}
          className={styles.clear}
          onClick={onClear}
        >
          Limpar filtros
        </Button>
      )}
    </section>
  );
}
