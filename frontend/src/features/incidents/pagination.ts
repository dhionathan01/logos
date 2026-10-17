export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Limite da API por requisição: "exibir todos" mostra até isso e avisa se houver mais. */
export const SHOW_ALL_LIMIT = 500;
const DEFAULT_PAGE_SIZE: PageSize = 25;

export interface Pagination {
  page: number;
  pageSize: PageSize;
  showAll: boolean;
}

export function parsePagination(params: URLSearchParams): Pagination {
  const size = Number(params.get("size"));
  const page = Number(params.get("page"));
  return {
    pageSize: PAGE_SIZES.find((option) => option === size) ?? DEFAULT_PAGE_SIZE,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    showAll: params.get("all") === "1",
  };
}

export function paginationToQuery(pagination: Pagination): { limit: number; offset: number } {
  if (pagination.showAll) return { limit: SHOW_ALL_LIMIT, offset: 0 };
  return { limit: pagination.pageSize, offset: (pagination.page - 1) * pagination.pageSize };
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Páginas exibidas na navegação: sempre a primeira, a última e as vizinhas da atual,
 * com "…" nos saltos. Ex.: 1 … 4 5 6 … 12.
 */
export function pageWindow(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1];
    return previous !== undefined && page - previous > 1 ? ["gap" as const, page] : [page];
  });
}
