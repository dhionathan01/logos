import type { components } from "./schema";

type Schemas = components["schemas"];

export type Incident = Schemas["IncidentRead"];
export type IncidentPage = Schemas["IncidentPage"];
export type IncidentEvent = Schemas["IncidentEventRead"];
export type ChatMessage = Schemas["ChatMessageRead"];
export type ChatHistory = Schemas["ChatHistory"];
export type Handover = Schemas["HandoverRead"];
export type Analyst = Schemas["AnalystRead"];
export type IncidentSummary = Schemas["IncidentSummary"];
export type IncidentCreate = Schemas["IncidentCreate"];
export type IncidentUpdate = Schemas["IncidentUpdate"];
export type StatusChange = Schemas["StatusChange"];
export type Category = Schemas["Category"];
export type Severity = Schemas["Severity"];
export type IncidentStatus = Schemas["Status"];
export type TokenResponse = Schemas["TokenResponse"];
export type User = Schemas["UserRead"];

/** Corpo de erro RFC 9457 devolvido pela API. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: { field: string; message: string }[];
  current?: Incident;
}
