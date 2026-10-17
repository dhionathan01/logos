import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import type { Incident } from "../../api/types";
import { Button } from "../../shared/components/Button";
import { useSession } from "../auth/useSession";
import {
  useAnalysts,
  useDelegate,
  useHandoverAction,
  useIncidentHandovers,
  useRequestHandover,
} from "./api";
import styles from "./HandoverSection.module.css";

/** Passagem do incidente entre analistas (ADR-0015), no detalhe do incidente. */
export function HandoverSection({ incident }: { incident: Incident }) {
  const { user } = useSession();
  const assignee = incident.assignee;
  const transferable =
    assignee !== null &&
    (incident.status === "investigating" || incident.status === "inconclusive");
  if (!transferable || !user) return null;

  return assignee.id === user.id ? (
    <OwnerView incident={incident} currentUserId={user.id} />
  ) : (
    <RequesterView incident={incident} currentUserId={user.id} ownerName={assignee.display_name} />
  );
}

function OwnerView({ incident, currentUserId }: { incident: Incident; currentUserId: string }) {
  const handovers = useIncidentHandovers(incident.id);
  const action = useHandoverAction();
  const analysts = useAnalysts();
  const delegate = useDelegate(incident.id);
  const [target, setTarget] = useState("");

  const pending = handovers.data?.find((item) => item.status === "pending");
  const colleagues = analysts.data?.filter((analyst) => analyst.id !== currentUserId) ?? [];

  return (
    <section className={styles.section} aria-label="Passagem do incidente">
      <h3>
        <ArrowLeftRight size={14} aria-hidden="true" /> Passagem
      </h3>

      {pending && (
        <div className={styles.request}>
          <p>
            <strong>{pending.requester.display_name}</strong> pediu para assumir
            {pending.reason ? `: “${pending.reason}”` : "."}
          </p>
          <div className={styles.actions}>
            <Button
              size="sm"
              variant="ghost"
              disabled={action.isPending}
              onClick={() => action.mutate({ handoverId: pending.id, action: "decline" })}
            >
              Recusar
            </Button>
            <Button
              size="sm"
              isLoading={action.isPending && action.variables?.action === "accept"}
              disabled={action.isPending}
              onClick={() => action.mutate({ handoverId: pending.id, action: "accept" })}
            >
              Passar para {pending.requester.display_name.split(" ")[0]}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.delegate}>
        <label className={styles.field}>
          <span>Passar para outro analista</span>
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Escolha…</option>
            {colleagues.map((analyst) => (
              <option key={analyst.id} value={analyst.id}>
                {analyst.display_name}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={!target || delegate.isPending}
          isLoading={delegate.isPending}
          onClick={() =>
            delegate.mutate(
              { to_user_id: target, version: incident.version },
              { onSuccess: () => setTarget("") },
            )
          }
        >
          Delegar
        </Button>
      </div>
    </section>
  );
}

function RequesterView({
  incident,
  currentUserId,
  ownerName,
}: {
  incident: Incident;
  currentUserId: string;
  ownerName: string;
}) {
  const handovers = useIncidentHandovers(incident.id);
  const requestHandover = useRequestHandover(incident.id);
  const action = useHandoverAction();
  const [isWriting, setIsWriting] = useState(false);
  const [reason, setReason] = useState("");

  const pending = handovers.data?.find((item) => item.status === "pending");

  if (pending && pending.requester.id === currentUserId) {
    return (
      <section className={styles.section} aria-label="Passagem do incidente">
        <p className={styles.waiting}>
          Seu pedido está aguardando a resposta de {ownerName}. Você será avisado no chat.
        </p>
        <Button
          size="sm"
          variant="ghost"
          isLoading={action.isPending}
          onClick={() => action.mutate({ handoverId: pending.id, action: "cancel" })}
        >
          Cancelar pedido
        </Button>
      </section>
    );
  }

  if (pending) {
    return (
      <section className={styles.section} aria-label="Passagem do incidente">
        <p className={styles.waiting}>
          {pending.requester.display_name} já pediu este incidente e aguarda a resposta de{" "}
          {ownerName}.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-label="Passagem do incidente">
      {isWriting ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            requestHandover.mutate(reason.trim(), {
              onSuccess: () => {
                setIsWriting(false);
                setReason("");
              },
            });
          }}
        >
          <label className={styles.field}>
            <span>Por que você deveria assumir? (opcional)</span>
            <textarea
              rows={2}
              maxLength={300}
              autoFocus
              value={reason}
              placeholder="Ex.: já falei com o motorista e conheço o trecho"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <Button size="sm" variant="ghost" onClick={() => setIsWriting(false)}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" isLoading={requestHandover.isPending}>
              Enviar pedido a {ownerName.split(" ")[0]}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          icon={<ArrowLeftRight size={14} />}
          onClick={() => setIsWriting(true)}
        >
          Pedir para assumir
        </Button>
      )}
    </section>
  );
}
