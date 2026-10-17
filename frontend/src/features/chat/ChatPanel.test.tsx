import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { ChatMessage } from "../../api/types";
import { ANA, BRUNO, renderWithProviders, signInAs } from "../../test/render";
import { server } from "../../test/server";
import { ChatPanel } from "./ChatPanel";
import { chatUiStore } from "./chatUiStore";

const handoverCard: ChatMessage = {
  id: 7,
  kind: "handover",
  notice: "handover_requested",
  body: "Bruno Lima pediu para assumir “Pneu furado” (CAM-0001): “Conheço o trecho”",
  author: { id: BRUNO.id, display_name: BRUNO.display_name },
  incident: {
    id: "i1",
    title: "Pneu furado",
    vehicle_id: "CAM-0001",
    severity: "low",
    status: "investigating",
  },
  handover: {
    id: "h1",
    incident_id: "i1",
    status: "pending",
    reason: "Conheço o trecho",
    requester: { id: BRUNO.id, display_name: BRUNO.display_name },
    owner: { id: ANA.id, display_name: ANA.display_name },
    created_at: new Date().toISOString(),
    resolved_at: null,
  },
  created_at: new Date().toISOString(),
};

function serveHistory(items: ChatMessage[]) {
  server.use(http.get("/api/chat/messages", () => HttpResponse.json({ items, has_more: false })));
}

describe("ChatPanel", () => {
  beforeEach(() => chatUiStore.open());

  it("mostra Aceitar e Recusar apenas para o responsável", async () => {
    signInAs(ANA);
    serveHistory([handoverCard]);

    renderWithProviders(<ChatPanel />);

    expect(await screen.findByText("Aguardando resposta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Passar para Bruno" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeEnabled();
  });

  it("quem pediu vê só a opção de cancelar", async () => {
    signInAs(BRUNO);
    serveHistory([handoverCard]);

    renderWithProviders(<ChatPanel />);

    expect(await screen.findByRole("button", { name: "Cancelar pedido" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Passar para/ })).not.toBeInTheDocument();
  });

  it("com o chat fechado, a barra do rodapé avisa o pedido pendente e abre ao clicar", async () => {
    chatUiStore.close();
    signInAs(ANA);
    serveHistory([handoverCard]);

    renderWithProviders(<ChatPanel />);

    const bar = await screen.findByRole("button", { name: /1 pedido aguarda sua resposta/ });
    expect(bar).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(bar);
    expect(bar).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Recusar" })).toBeEnabled();
  });

  it("mantém a mensagem com opção de reenviar quando a rede falha", async () => {
    signInAs(ANA);
    serveHistory([]);
    server.use(http.post("/api/chat/messages", () => HttpResponse.error()));
    renderWithProviders(<ChatPanel />);
    await screen.findByText(/Nenhuma mensagem ainda/);

    await userEvent.type(
      screen.getByLabelText("Mensagem para a central"),
      "Alguém na BR-116?{Enter}",
    );

    expect(await screen.findByText("Alguém na BR-116?")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Tentar de novo/ })).toBeInTheDocument();
  });
});
