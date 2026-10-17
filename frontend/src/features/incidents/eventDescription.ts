import type { Category, IncidentEvent, IncidentStatus, Severity } from "../../api/types";
import { CATEGORY_META, SEVERITY_META, STATUS_LABEL } from "./labels";

const FIELD_LABEL: Record<string, string> = {
  title: "o título",
  description: "o relato",
  category: "a categoria",
  severity: "a criticidade",
  location: "o local",
};

function readable(field: string, value: unknown): string {
  if (field === "severity") return SEVERITY_META[value as Severity]?.label ?? String(value);
  if (field === "category") return CATEGORY_META[value as Category]?.label ?? String(value);
  return `"${String(value)}"`;
}

function statusAction(from: IncidentStatus | null, to: IncidentStatus | null): string {
  if (to === "investigating")
    return from === "inconclusive" ? "retomou a investigação" : "assumiu a investigação";
  if (to === "open") return "devolveu o incidente à fila";
  if (to === "closed") return "fechou o incidente";
  if (to === "inconclusive") return "marcou como inconclusivo";
  return `mudou o status para ${to ? STATUS_LABEL[to] : "desconhecido"}`;
}

/** Frase do histórico, do ponto de vista de quem lê: "Ana Souza assumiu a investigação". */
export function describeEvent(event: IncidentEvent): string {
  const actor = event.actor?.display_name;

  if (event.event_type === "created") {
    return actor ? `${actor} registrou o incidente` : "Registrado pela telemetria da frota";
  }

  if (event.event_type === "status_changed") {
    return `${actor ?? "Sistema"} ${statusAction(event.from_status, event.to_status)}`;
  }

  if (event.event_type === "assignee_changed") {
    // Passagem (ADR-0015): quem registra é quem entregou; `via` diz se foi pedido ou delegação.
    const to = (event.changes?.assignee as { to?: string } | undefined)?.to ?? "outro analista";
    return event.changes?.via === "handover"
      ? `${actor ?? "Sistema"} aceitou o pedido e passou o incidente para ${to}`
      : `${actor ?? "Sistema"} passou o incidente para ${to}`;
  }

  const changes = Object.entries(event.changes ?? {}).map(([field, change]) => {
    const { from, to } = change as { from: unknown; to: unknown };
    const label = FIELD_LABEL[field] ?? field;
    return field === "description"
      ? `atualizou ${label}`
      : `alterou ${label} de ${readable(field, from)} para ${readable(field, to)}`;
  });
  return `${actor ?? "Sistema"} ${changes.length ? changes.join("; ") : "editou o incidente"}`;
}

export function resolutionNoteOf(event: IncidentEvent): string | null {
  const note = event.changes?.resolution_note;
  return typeof note === "string" && note ? note : null;
}
