import { describe, expect, it } from "vitest";

import { parsePeriod, periodToRange } from "./period";

const NOW = Date.parse("2026-10-16T15:00:00Z");

describe("parsePeriod", () => {
  it("sem parâmetro, considera todo o período", () => {
    expect(parsePeriod(new URLSearchParams()).preset).toBe("all");
  });

  it("ignora atalhos e datas inválidas", () => {
    expect(parsePeriod(new URLSearchParams("period=3anos")).preset).toBe("all");
    expect(parsePeriod(new URLSearchParams("period=custom&from=ontem&to=2026-10-16"))).toEqual({
      preset: "custom",
      from: "",
      to: "2026-10-16",
    });
  });

  it("ordena um intervalo personalizado digitado ao contrário", () => {
    const period = parsePeriod(new URLSearchParams("period=custom&from=2026-10-16&to=2026-10-10"));

    expect(period).toEqual({ preset: "custom", from: "2026-10-10", to: "2026-10-16" });
  });
});

describe("periodToRange", () => {
  it("atalhos são relativos ao momento da busca", () => {
    const range = periodToRange({ preset: "6h", from: "", to: "" }, NOW);

    expect(range).toEqual({ reportedFrom: "2026-10-16T09:00:00.000Z" });
  });

  it("intervalo personalizado cobre o dia inteiro no fuso do analista", () => {
    const range = periodToRange({ preset: "custom", from: "2026-10-10", to: "2026-10-16" }, NOW);

    expect(new Date(range.reportedFrom!).getHours()).toBe(0);
    expect(new Date(range.reportedTo!).getHours()).toBe(23);
    expect(new Date(range.reportedTo!).getMinutes()).toBe(59);
  });

  it("todo o período não envia limites", () => {
    expect(periodToRange({ preset: "all", from: "", to: "" }, NOW)).toEqual({});
  });
});
