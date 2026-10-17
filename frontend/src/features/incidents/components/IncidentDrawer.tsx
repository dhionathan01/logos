import { Lock, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ApiError } from "../../../api/httpClient";
import type { Incident, IncidentStatus, Severity } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Dialog } from "../../../shared/components/Dialog";
import { Spinner } from "../../../shared/components/Spinner";
import { useSession } from "../../auth/useSession";
import {
  useChangeStatus,
  useDeleteIncident,
  useIncident,
  usePendingIncidentIds,
  useUpdateSeverity,
} from "../hooks";
import { SEVERITIES, SEVERITY_META, TRANSITION_ACTIONS } from "../labels";
import { elapsedSince, formatDateTime, formatElapsed, useNow } from "../time";
import { CategoryLabel, SeverityBadge, StatusBadge } from "./Badges";
import styles from "./IncidentDrawer.module.css";

interface IncidentDrawerProps {
  incidentId: string | null;
  onClose: () => void;
}

export function IncidentDrawer({ incidentId, onClose }: IncidentDrawerProps) {
  const query = useIncident(incidentId);
  const incident = query.data;

  return (
    <Dialog
      open={incidentId !== null}
      onClose={onClose}
      variant="drawer"
      title={incident?.title ?? "Incidente"}
    >
      {incident ? (
        <IncidentDetails key={incident.id} incident={incident} onDeleted={onClose} />
      ) : query.isError ? (
        <p className={styles.message}>
          {query.error instanceof ApiError && query.error.status === 404
            ? "Este incidente não existe mais. Ele pode ter sido excluído por outro analista."
            : "Não foi possível carregar o incidente. Tentando novamente…"}
        </p>
      ) : (
        <div className={styles.message}>
          <Spinner label="Carregando incidente" />
        </div>
      )}
    </Dialog>
  );
}

function IncidentDetails({ incident, onDeleted }: { incident: Incident; onDeleted: () => void }) {
  const { user } = useSession();
  const now = useNow();
  const changeStatus = useChangeStatus();
  const updateSeverity = useUpdateSeverity();
  const deleteIncident = useDeleteIncident();
  const isPending = usePendingIncidentIds().has(incident.id);
  const [resolutionNote, setResolutionNote] = useState(incident.resolution_note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isMine = incident.assignee?.id === user?.id;
  const lockedByOther = incident.status === "investigating" && !isMine;
  const canEdit = incident.status !== "closed" && !lockedByOther;
  const acceptsNote = canEdit && incident.status !== "open";
  const busy = isPending || updateSeverity.isPending || deleteIncident.isPending;

  const runTransition = (target: IncidentStatus) =>
    changeStatus.mutate({
      incident,
      target,
      resolutionNote: acceptsNote ? resolutionNote.trim() : undefined,
    });

  return (
    <div className={styles.details}>
      <div className={styles.badges}>
        <SeverityBadge severity={incident.severity} />
        <StatusBadge status={incident.status} />
        {isPending && (
          <span className={styles.saving}>
            <Spinner size={12} /> Salvando…
          </span>
        )}
      </div>

      <dl className={styles.facts}>
        <Fact label="Categoria">
          <CategoryLabel category={incident.category} />
        </Fact>
        <Fact label="Veículo">{incident.vehicle_id}</Fact>
        <Fact label="Local">{incident.location}</Fact>
        <Fact label="Ocorrido em">{formatDateTime(incident.reported_at)}</Fact>
        <Fact label="Tempo aberto">
          <span className="tabular">{formatElapsed(elapsedSince(incident.reported_at, now))}</span>
        </Fact>
        <Fact label="Responsável">
          {incident.assignee ? (isMine ? "Você" : incident.assignee.display_name) : "Ninguém"}
        </Fact>
        <Fact label="Registrado em">{formatDateTime(incident.created_at)}</Fact>
        <Fact label="Última atualização">{formatDateTime(incident.updated_at)}</Fact>
      </dl>

      {incident.description && (
        <section className={styles.section}>
          <h3>Relato</h3>
          <p className={styles.description}>{incident.description}</p>
        </section>
      )}

      {lockedByOther && (
        <p className={styles.lock} role="note">
          <Lock size={16} aria-hidden="true" />
          {incident.assignee?.display_name} está investigando. Só o responsável pode alterar este
          incidente; isso evita que duas pessoas atuem no mesmo problema.
        </p>
      )}

      {canEdit && (
        <section className={styles.section}>
          <label className={styles.field}>
            <span>Criticidade</span>
            <select
              value={incident.severity}
              disabled={busy}
              onChange={(event) =>
                updateSeverity.mutate({ incident, severity: event.target.value as Severity })
              }
            >
              {SEVERITIES.map((severity) => (
                <option key={severity} value={severity}>
                  {SEVERITY_META[severity].label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {acceptsNote && (
        <section className={styles.section}>
          <label className={styles.field}>
            <span>Nota de resolução (opcional)</span>
            <textarea
              rows={3}
              maxLength={1000}
              value={resolutionNote}
              placeholder="O que foi feito, com quem falou, próximo passo…"
              onChange={(event) => setResolutionNote(event.target.value)}
            />
          </label>
        </section>
      )}

      {!acceptsNote && incident.resolution_note && (
        <section className={styles.section}>
          <h3>Nota de resolução</h3>
          <p className={styles.description}>{incident.resolution_note}</p>
        </section>
      )}

      {canEdit && (
        <div className={styles.actions}>
          {TRANSITION_ACTIONS[incident.status].map((action) => (
            <Button
              key={action.target}
              variant={action.variant}
              disabled={busy}
              isLoading={isPending && changeStatus.variables?.target === action.target}
              onClick={() => runTransition(action.target)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {incident.status === "open" && (
        <div className={styles.danger}>
          {confirmingDelete ? (
            <>
              <span>Excluir definitivamente? Use só para registros feitos por engano.</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteIncident.isPending}
                onClick={() => deleteIncident.mutate(incident, { onSuccess: onDeleted })}
              >
                Excluir
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} />}
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              Excluir registro
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
