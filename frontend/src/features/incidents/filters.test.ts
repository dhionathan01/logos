import { describe, expect, it } from "vitest";

import { hasCustomFilters, parseFilters, toApiQuery } from "./filters";
import { ALL_TIME } from "../../shared/period/period";

describe("parseFilters", () => {
  it("mostra só incidentes ativos quando não há filtro de status", () => {
    const filters = parseFilters(new URLSearchParams());

    expect(filters.status).toEqual(["open", "investigating", "inconclusive"]);
    expect(hasCustomFilters(filters)).toBe(false);
  });

  it("ignora valores desconhecidos vindos da URL", () => {
    const filters = parseFilters(
      new URLSearchParams("severity=high&severity=urgente&category=meteoro&status=closed"),
    );

    expect(filters.severity).toEqual(["high"]);
    expect(filters.category).toEqual([]);
    expect(filters.status).toEqual(["closed"]);
    expect(hasCustomFilters(filters)).toBe(true);
  });
});

describe("toApiQuery", () => {
  it("repete o parâmetro para cada valor selecionado", () => {
    const query = toApiQuery({
      severity: ["high", "medium"],
      category: ["road_block"],
      status: ["open"],
      search: "  BR-116 ",
      period: ALL_TIME,
      pagination: { page: 2, pageSize: 50, showAll: false },
    });

    expect(query.toString()).toBe(
      "severity=high&severity=medium&category=road_block&status=open&search=BR-116" +
        "&limit=50&offset=50",
    );
  });

  it("paginação não conta como filtro personalizado", () => {
    const filters = parseFilters(new URLSearchParams("page=3&size=100&all=1"));

    expect(filters.pagination).toEqual({ page: 3, pageSize: 100, showAll: true });
    expect(hasCustomFilters(filters)).toBe(false);
  });

  it("envia o início do período calculado no momento da busca", () => {
    const now = Date.parse("2026-10-16T15:00:00Z");
    const filters = parseFilters(new URLSearchParams("period=1h"));

    expect(toApiQuery(filters, now).get("reported_from")).toBe("2026-10-16T14:00:00.000Z");
    expect(hasCustomFilters(filters)).toBe(true);
  });
});
