import { describe, expect, it } from "vitest";

import { formatDay, formatMinutes, formatPercent } from "./format";

describe("formatMinutes", () => {
  it.each([
    [null, "—"],
    [12.4, "12 min"],
    [60, "1 h"],
    [200, "3 h 20"],
    [24 * 60 * 2 + 240, "2 d 4 h"],
  ])("%s → %s", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe("formatPercent", () => {
  it("mostra traço quando não há base de cálculo", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0.634).replace(/\s/g, " ")).toBe("63%");
  });
});

describe("formatDay", () => {
  it("não desloca o dia por causa do fuso", () => {
    expect(formatDay("2026-10-01")).toBe("01/10");
  });
});
