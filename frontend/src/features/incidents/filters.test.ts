import { describe, expect, it } from "vitest";

import { hasCustomFilters, parseFilters, toApiQuery } from "./filters";

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
    });

    expect(query.toString()).toBe(
      "severity=high&severity=medium&category=road_block&status=open&search=BR-116",
    );
  });
});
