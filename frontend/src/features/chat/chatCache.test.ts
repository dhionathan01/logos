import { describe, expect, it } from "vitest";

import type { ChatMessage, Handover } from "../../api/types";
import { mergeMessage, prependOlder } from "./chatCache";

function message(id: number, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    kind: "user",
    notice: null,
    body: `mensagem ${id}`,
    author: null,
    incident: null,
    handover: null,
    created_at: "2026-10-16T12:00:00Z",
    ...overrides,
  };
}

const handover = (status: Handover["status"]): Handover => ({
  id: "h1",
  incident_id: "i1",
  status,
  reason: "",
  requester: { id: "b", display_name: "Bruno Lima" },
  owner: { id: "a", display_name: "Ana Souza" },
  created_at: "2026-10-16T12:00:00Z",
  resolved_at: null,
});

describe("mergeMessage", () => {
  it("não duplica a mesma mensagem vinda do POST e do stream", () => {
    const once = mergeMessage(undefined, message(1));
    const twice = mergeMessage(once, message(1));

    expect(twice.items).toHaveLength(1);
  });

  it("mantém a ordem cronológica mesmo se o replay chegar fora de ordem", () => {
    const history = [message(3), message(1), message(2)].reduce(
      (acc, item) => mergeMessage(acc, item),
      undefined as ReturnType<typeof mergeMessage> | undefined,
    );

    expect(history?.items.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it("atualiza o cartão do pedido quando chega a resposta", () => {
    const requested = mergeMessage(
      undefined,
      message(1, { kind: "handover", handover: handover("pending") }),
    );

    const answered = mergeMessage(
      requested,
      message(2, { kind: "system", handover: handover("accepted") }),
    );

    expect(answered.items[0]?.handover?.status).toBe("accepted");
  });
});

describe("prependOlder", () => {
  it("coloca as antigas antes sem repetir", () => {
    const current = mergeMessage(undefined, message(3));

    const merged = prependOlder(current, { items: [message(2), message(3)], has_more: false });

    expect(merged.items.map((item) => item.id)).toEqual([2, 3]);
    expect(merged.has_more).toBe(false);
  });
});
