import { type FormEvent, type ReactElement, useState } from "react";

import { ApiError, NetworkError } from "../../../api/httpClient";
import type { Category, IncidentCreate, Severity } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Dialog } from "../../../shared/components/Dialog";
import { useCreateIncident } from "../hooks";
import { CATEGORIES, CATEGORY_META, SEVERITIES, SEVERITY_META } from "../labels";
import {
  EMPTY_NEW_INCIDENT,
  type FieldErrors,
  type NewIncidentValues,
  validateNewIncident,
} from "../newIncidentForm";
import styles from "./NewIncidentDialog.module.css";

export function NewIncidentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Registrar incidente">
      {open && <NewIncidentForm onDone={onClose} />}
    </Dialog>
  );
}

function NewIncidentForm({ onDone }: { onDone: () => void }) {
  const createIncident = useCreateIncident();
  const [values, setValues] = useState<NewIncidentValues>(EMPTY_NEW_INCIDENT);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Uma chave por formulário: reenvios após falha de rede não duplicam o incidente.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const set = <K extends keyof NewIncidentValues>(field: K, value: NewIncidentValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validateNewIncident(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload: IncidentCreate = {
      title: values.title.trim(),
      category: values.category as Category,
      severity: values.severity || null,
      vehicle_id: values.vehicle_id.trim(),
      location: values.location.trim(),
      description: values.description.trim(),
    };
    createIncident.mutate(
      { payload, idempotencyKey },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (error instanceof ApiError && error.problem.errors) {
            setErrors(
              Object.fromEntries(
                error.problem.errors.map((item) => [item.field, item.message]),
              ) as FieldErrors,
            );
          }
        },
      },
    );
  };

  const defaultSeverity = values.category ? CATEGORY_META[values.category].defaultSeverity : null;
  const submitError = createIncident.error
    ? createIncident.error instanceof NetworkError
      ? "Sem conexão. Seus dados continuam no formulário; tente enviar de novo."
      : createIncident.error.message
    : null;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <Field label="O que aconteceu?" error={errors.title}>
        <input
          autoFocus
          value={values.title}
          maxLength={120}
          placeholder="Ex.: Pneu furado no eixo traseiro"
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>

      <div className={styles.columns}>
        <Field label="Categoria" error={errors.category}>
          <select
            value={values.category}
            onChange={(event) => set("category", event.target.value as Category)}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_META[category].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Criticidade">
          <select
            value={values.severity}
            onChange={(event) => set("severity", event.target.value as Severity | "")}
          >
            <option value="">
              Automática
              {defaultSeverity ? ` (${SEVERITY_META[defaultSeverity].label})` : " pela categoria"}
            </option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {SEVERITY_META[severity].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className={styles.columns}>
        <Field label="Veículo" error={errors.vehicle_id}>
          <input
            value={values.vehicle_id}
            maxLength={20}
            placeholder="CAM-0421"
            autoCapitalize="characters"
            onChange={(event) => set("vehicle_id", event.target.value)}
          />
        </Field>
        <Field label="Local" error={errors.location}>
          <input
            value={values.location}
            maxLength={200}
            placeholder="BR-116, km 212"
            onChange={(event) => set("location", event.target.value)}
          />
        </Field>
      </div>

      <Field label="Relato (opcional)" error={errors.description}>
        <textarea
          rows={3}
          maxLength={2000}
          value={values.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>

      {submitError && (
        <p className={styles.submitError} role="alert">
          {submitError}
        </p>
      )}

      <div className={styles.footer}>
        <Button variant="ghost" onClick={onDone} disabled={createIncident.isPending}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={createIncident.isPending}>
          Registrar incidente
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactElement;
}) {
  return (
    <label className={styles.field} data-invalid={error ? true : undefined}>
      <span>{label}</span>
      {children}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
