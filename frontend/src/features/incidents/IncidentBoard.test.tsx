import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { Incident, IncidentPage } from "../../api/types";
import { BRUNO, buildIncident, renderWithProviders, signInAs } from "../../test/render";
import { server } from "../../test/server";
import { IncidentBoard } from "./IncidentBoard";

const summary = {
  active_by_severity: { high: 1, medium: 1, low: 0 },
  by_status: { open: 2, investigating: 0, inconclusive: 0, closed: 0 },
};

function page(items: Incident[]): IncidentPage {
  return { items, total: items.length, limit: 200, offset: 0 };
}

function serveIncidents(items: Incident[]) {
  server.use(
    http.get("/api/incidents", () => HttpResponse.json(page(items))),
    http.get("/api/incidents/summary", () => HttpResponse.json(summary)),
  );
}

describe("IncidentBoard", () => {
  beforeEach(() => signInAs());

  it("mostra o esqueleto enquanto carrega e depois a fila na ordem da API", async () => {
    const high = buildIncident({ title: "Colisão com feridos", severity: "high" });
    const medium = buildIncident({ title: "Pneu furado", severity: "medium" });
    server.use(
      http.get("/api/incidents", async () => {
        await delay(50);
        return HttpResponse.json(page([high, medium]));
      }),
      http.get("/api/incidents/summary", () => HttpResponse.json(summary)),
    );

    renderWithProviders(<IncidentBoard />);

    expect(screen.getByRole("status", { name: "Carregando incidentes" })).toBeInTheDocument();
    const rows = await screen.findAllByRole("button", { name: /^Abrir incidente/ });
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Abrir incidente: Colisão com feridos",
      "Abrir incidente: Pneu furado",
    ]);
  });

  it("mostra estado vazio tranquilizador quando não há incidentes ativos", async () => {
    serveIncidents([]);

    renderWithProviders(<IncidentBoard />);

    expect(await screen.findByText("Nenhum incidente ativo")).toBeInTheDocument();
  });

  it("mostra erro com opção de tentar de novo quando a API falha", async () => {
    server.use(
      http.get("/api/incidents", () =>
        HttpResponse.json(
          { status: 503, title: "Indisponível", detail: "O banco de dados não respondeu a tempo." },
          { status: 503 },
        ),
      ),
      http.get("/api/incidents/summary", () => HttpResponse.json(summary)),
    );

    renderWithProviders(<IncidentBoard />);

    expect(await screen.findByRole("alert")).toHaveTextContent("O banco de dados não respondeu");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });

  it("assume o incidente na hora (otimista) e confirma com a resposta da API", async () => {
    const incident = buildIncident({ title: "Pneu furado" });
    serveIncidents([incident]);
    server.use(
      http.patch(`/api/incidents/${incident.id}/status`, async () => {
        await delay(100);
        return HttpResponse.json({
          ...incident,
          status: "investigating",
          version: 2,
          assignee: { id: "11111111-1111-1111-1111-111111111111", display_name: "Ana Souza" },
        });
      }),
    );
    renderWithProviders(<IncidentBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Assumir" }));

    expect(await screen.findByText("Salvando…")).toBeInTheDocument();
    expect(await screen.findByText("Você assumiu a investigação.")).toBeInTheDocument();
  });

  it("desfaz a mudança e explica quando outro analista assumiu antes", async () => {
    const incident = buildIncident({ title: "Pneu furado" });
    // Bruno assumiu no servidor segundos antes; a tela de Ana ainda mostra a versão antiga.
    const takenByBruno: Incident = {
      ...incident,
      status: "investigating",
      version: 2,
      assignee: { id: BRUNO.id, display_name: BRUNO.display_name },
    };
    let serverState = incident;
    server.use(
      http.get("/api/incidents", () => HttpResponse.json(page([serverState]))),
      http.get("/api/incidents/summary", () => HttpResponse.json(summary)),
    );
    server.use(
      http.patch(`/api/incidents/${incident.id}/status`, () =>
        HttpResponse.json(
          {
            type: "/problems/version-conflict",
            title: "O incidente foi alterado por outra pessoa",
            status: 409,
            detail: "Este incidente foi alterado por outra pessoa enquanto você o visualizava.",
            current: takenByBruno,
          },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<IncidentBoard />);
    const claimButton = await screen.findByRole("button", { name: "Assumir" });
    serverState = takenByBruno;

    await userEvent.click(claimButton);

    expect(
      await screen.findByText("O incidente foi alterado por outra pessoa"),
    ).toBeInTheDocument();
    const row = screen.getByRole("button", { name: "Abrir incidente: Pneu furado" });
    await waitFor(() => expect(within(row).getByText("Bruno Lima")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Assumir" })).not.toBeInTheDocument();
  });

  it("avisa sem perder a fila quando a rede cai durante a mudança", async () => {
    const incident = buildIncident({ title: "Pneu furado" });
    serveIncidents([incident]);
    server.use(http.patch(`/api/incidents/${incident.id}/status`, () => HttpResponse.error()));
    renderWithProviders(<IncidentBoard />);

    await userEvent.click(await screen.findByRole("button", { name: "Assumir" }));

    expect(await screen.findByText("Sem conexão: a alteração não foi salva.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Assumir" })).toBeEnabled();
  });

  it("filtra pela criticidade ao clicar no contador", async () => {
    let lastQuery = "";
    server.use(
      http.get("/api/incidents", ({ request }) => {
        lastQuery = new URL(request.url).search;
        return HttpResponse.json(page([]));
      }),
      http.get("/api/incidents/summary", () => HttpResponse.json(summary)),
    );
    renderWithProviders(<IncidentBoard />);

    await userEvent.click(await screen.findByRole("button", { name: /Criticidade alta/ }));

    await waitFor(() => expect(lastQuery).toContain("severity=high"));
    expect(screen.getByRole("button", { name: /Criticidade alta/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
