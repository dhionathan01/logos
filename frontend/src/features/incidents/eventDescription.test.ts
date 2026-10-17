import { describe, expect, it } from "vitest";

import type { IncidentEvent } from "../../api/types";
import { describeEvent, resolutionNoteOf } from "./eventDescription";

const ana = { id: "1", display_name: "Ana Souza" };

function event(overrides: Partial<IncidentEvent>): IncidentEvent {
  return {
    id: "e1",
    event_type: "status_changed",
    from_status: null,
    to_status: null,
    changes: null,
    actor: ana,
    occurred_at: "2026-10-16T12:00:00Z",
    ...overrides,
  };
}

describe("describeEvent", () => {
  it("distingue registro pela frota e por analista", () => {
    expect(describeEvent(event({ event_type: "created", actor: null }))).toBe(
      "Registrado pela telemetria da frota",
    );
    expect(describeEvent(event({ event_type: "created" }))).toBe("Ana Souza registrou o incidente");
  });

  it.each([
    ["open", "investigating", "Ana Souza assumiu a investigação"],
    ["inconclusive", "investigating", "Ana Souza retomou a investigação"],
    ["investigating", "open", "Ana Souza devolveu o incidente à fila"],
    ["investigating", "closed", "Ana Souza fechou o incidente"],
  ] as const)("%s → %s", (from, to, expected) => {
    expect(describeEvent(event({ from_status: from, to_status: to }))).toBe(expected);
  });

  it("descreve edições com valores legíveis", () => {
    const edited = event({
      event_type: "details_updated",
      changes: { severity: { from: "low", to: "high" } },
    });

    expect(describeEvent(edited)).toBe("Ana Souza alterou a criticidade de Baixa para Alta");
  });

  it("extrai a nota de resolução quando houver", () => {
    expect(resolutionNoteOf(event({ changes: { resolution_note: "Pneu trocado" } }))).toBe(
      "Pneu trocado",
    );
    expect(resolutionNoteOf(event({}))).toBeNull();
  });
});
