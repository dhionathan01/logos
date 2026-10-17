import { describe, expect, it } from "vitest";

import { pageWindow, paginationToQuery, parsePagination, totalPages } from "./pagination";

describe("parsePagination", () => {
  it("usa página 1 e 25 por página quando a URL não informa", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: 25,
      showAll: false,
    });
  });

  it("ignora valores inválidos vindos da URL", () => {
    expect(parsePagination(new URLSearchParams("page=-3&size=7"))).toEqual({
      page: 1,
      pageSize: 25,
      showAll: false,
    });
  });
});

describe("paginationToQuery", () => {
  it("converte página em offset", () => {
    expect(paginationToQuery({ page: 3, pageSize: 50, showAll: false })).toEqual({
      limit: 50,
      offset: 100,
    });
  });

  it("exibir todos ignora a página atual", () => {
    expect(paginationToQuery({ page: 4, pageSize: 25, showAll: true })).toEqual({
      limit: 500,
      offset: 0,
    });
  });
});

describe("pageWindow", () => {
  it("mostra todas quando são poucas", () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it("encurta com reticências ao redor da página atual", () => {
    expect(pageWindow(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
    expect(pageWindow(1, 12)).toEqual([1, 2, "gap", 12]);
  });

  it("nunca tem zero páginas", () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(64, 25)).toBe(3);
  });
});
