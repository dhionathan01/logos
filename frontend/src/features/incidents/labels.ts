import {
  AlertOctagon,
  AlertTriangle,
  Ambulance,
  CarFront,
  CloudLightning,
  Construction,
  Info,
  type LucideIcon,
  Wrench,
} from "lucide-react";

import type { Category, IncidentStatus, Severity } from "../../api/types";

export const SEVERITIES: Severity[] = ["high", "medium", "low"];
export const CATEGORIES: Category[] = [
  "accident_with_victims",
  "vehicle_accident",
  "road_block",
  "adverse_weather",
  "mechanical_failure",
];
export const STATUSES: IncidentStatus[] = ["open", "investigating", "inconclusive", "closed"];
export const ACTIVE_STATUSES: IncidentStatus[] = ["open", "investigating", "inconclusive"];

export const SEVERITY_META: Record<Severity, { label: string; icon: LucideIcon }> = {
  high: { label: "Alta", icon: AlertOctagon },
  medium: { label: "Média", icon: AlertTriangle },
  low: { label: "Baixa", icon: Info },
};

export const CATEGORY_META: Record<
  Category,
  { label: string; shortLabel: string; icon: LucideIcon; defaultSeverity: Severity }
> = {
  accident_with_victims: {
    label: "Acidente com vítimas",
    shortLabel: "Vítimas",
    icon: Ambulance,
    defaultSeverity: "high",
  },
  vehicle_accident: {
    label: "Acidente com veículo",
    shortLabel: "Veículo",
    icon: CarFront,
    defaultSeverity: "high",
  },
  road_block: {
    label: "Bloqueio de pista",
    shortLabel: "Bloqueio",
    icon: Construction,
    defaultSeverity: "medium",
  },
  adverse_weather: {
    label: "Condição climática atípica",
    shortLabel: "Clima",
    icon: CloudLightning,
    defaultSeverity: "medium",
  },
  mechanical_failure: {
    label: "Problema mecânico",
    shortLabel: "Mecânico",
    icon: Wrench,
    defaultSeverity: "low",
  },
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Aberto",
  investigating: "Em investigação",
  inconclusive: "Inconclusivo",
  closed: "Fechado",
};

export interface TransitionAction {
  target: IncidentStatus;
  label: string;
  variant: "primary" | "secondary" | "ghost";
}

/** Espelho da máquina de estados da API (ADR-0005), só para decidir quais botões exibir. */
export const TRANSITION_ACTIONS: Record<IncidentStatus, TransitionAction[]> = {
  open: [{ target: "investigating", label: "Assumir investigação", variant: "primary" }],
  investigating: [
    { target: "closed", label: "Concluir e fechar", variant: "primary" },
    { target: "inconclusive", label: "Marcar inconclusivo", variant: "secondary" },
    { target: "open", label: "Devolver à fila", variant: "ghost" },
  ],
  inconclusive: [
    { target: "investigating", label: "Retomar investigação", variant: "primary" },
    { target: "closed", label: "Fechar", variant: "secondary" },
  ],
  closed: [],
};

export const STATUS_CHANGE_FEEDBACK: Record<IncidentStatus, string> = {
  open: "Incidente devolvido à fila.",
  investigating: "Você assumiu a investigação.",
  inconclusive: "Incidente marcado como inconclusivo.",
  closed: "Incidente fechado.",
};
