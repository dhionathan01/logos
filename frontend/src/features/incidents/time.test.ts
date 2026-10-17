import { describe, expect, it } from "vitest";

import { elapsedSince, formatElapsed, formatOccurrence } from "./time";

const minutes = (value: number) => value * 60_000;

describe("formatElapsed", () => {
  it.each([
    [0, "agora"],
    [minutes(0.5), "agora"],
    [minutes(12), "12 min"],
    [minutes(125), "2 h 05"],
    [minutes(60 * 24 * 3 + 10), "3 d"],
  ])("%d ms → %s", (elapsed, expected) => {
    expect(formatElapsed(elapsed)).toBe(expected);
  });
});

describe("formatOccurrence", () => {
  const now = new Date(2026, 9, 16, 15, 0).getTime();

  it.each([
    [new Date(2026, 9, 16, 14, 32), "hoje 14:32"],
    [new Date(2026, 9, 15, 9, 10), "ontem 09:10"],
    [new Date(2026, 9, 12, 18, 5), "12/10 18:05"],
  ])("%s → %s", (date, expected) => {
    expect(formatOccurrence(date.toISOString(), now)).toBe(expected);
  });
});

describe("elapsedSince", () => {
  it("nunca é negativo, mesmo com relógio do caminhão adiantado", () => {
    const now = Date.parse("2026-10-16T12:00:00Z");
    expect(elapsedSince("2026-10-16T12:03:00Z", now)).toBe(0);
  });
});
