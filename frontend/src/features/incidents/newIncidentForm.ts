import type { Category, Severity } from "../../api/types";

export interface NewIncidentValues {
  title: string;
  category: Category | "";
  severity: Severity | "";
  vehicle_id: string;
  location: string;
  description: string;
}

export type FieldErrors = Partial<Record<keyof NewIncidentValues, string>>;

export const EMPTY_NEW_INCIDENT: NewIncidentValues = {
  title: "",
  category: "",
  severity: "",
  vehicle_id: "",
  location: "",
  description: "",
};

/** Mesmas regras da API, para o analista ver o erro antes de enviar. */
export function validateNewIncident(values: NewIncidentValues): FieldErrors {
  const errors: FieldErrors = {};
  const title = values.title.trim();
  if (title.length < 3) errors.title = "Descreva o incidente em pelo menos 3 caracteres.";
  if (title.length > 120) errors.title = "Use no máximo 120 caracteres.";
  if (!values.category) errors.category = "Escolha a categoria.";
  if (!/^[A-Za-z0-9-]{3,20}$/.test(values.vehicle_id.trim())) {
    errors.vehicle_id = "Use de 3 a 20 letras, números ou hífen (ex.: CAM-0421).";
  }
  if (values.location.trim().length < 2) errors.location = "Informe onde o incidente ocorreu.";
  return errors;
}
