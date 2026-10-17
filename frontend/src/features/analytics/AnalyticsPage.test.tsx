import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { ANA, renderWithProviders, signInAs } from "../../test/render";
import { server } from "../../test/server";
import type { AnalyticsReport } from "./api";
import { AnalyticsPage } from "./AnalyticsPage";

function report(overrides: Partial<AnalyticsReport["overview"]> = {}): AnalyticsReport {
  return {
    generated_at: new Date().toISOString(),
    overview: {
      total: 120,
      active: 12,
      closed: 100,
      inconclusive: 3,
      resolution_rate: 100 / 120,
      avg_response_minutes: 18,
      avg_resolution_minutes: 200,
      response_sla_rate: 0.8,
      resolution_sla_rate: 0.65,
      breaching_now: 2,
      ...overrides,
    },
    by_category: [
      {
        category: "mechanical_failure",
        total: 60,
        closed: 50,
        resolution_rate: 50 / 60,
        avg_resolution_minutes: 300,
        resolution_sla_rate: 0.7,
      },
    ],
    by_severity: [
      {
        severity: "high",
        total: 20,
        closed: 18,
        response_target_minutes: 15,
        resolution_target_minutes: 120,
        avg_response_minutes: 9,
        avg_resolution_minutes: 95,
        response_sla_rate: 0.9,
        resolution_sla_rate: 0.75,
        breaching_now: 2,
      },
    ],
    by_analyst: [
      {
        analyst: { id: ANA.id, display_name: ANA.display_name },
        assigned: 40,
        closed: 38,
        resolution_rate: 0.95,
        avg_resolution_minutes: 150,
        resolution_sla_rate: 0.9,
        by_category: {
          vehicle_accident: 10,
          accident_with_victims: 12,
          adverse_weather: 1,
          mechanical_failure: 15,
          road_block: 2,
        },
      },
    ],
    daily: [
      { day: "2026-10-15", reported: 60, closed: 55 },
      { day: "2026-10-16", reported: 60, closed: 45 },
    ],
  };
}

describe("AnalyticsPage", () => {
  beforeEach(() => signInAs());

  it("mostra indicadores, SLA e comparação entre analistas", async () => {
    server.use(http.get("/api/analytics", () => HttpResponse.json(report())));

    renderWithProviders(<AnalyticsPage />, { route: "/painel" });

    const kpis = await screen.findByRole("region", { name: "Indicadores do período" });
    expect(within(kpis).getByText("83%")).toBeInTheDocument();
    expect(within(kpis).getByText("3 h 20")).toBeInTheDocument();
    expect(within(kpis).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver fila/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Acidente com vítimas" })).toBeInTheDocument();
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0);
  });

  it("envia o período escolhido e o fuso do usuário para a API", async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get("/api/analytics", ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json(report());
      }),
    );
    renderWithProviders(<AnalyticsPage />, { route: "/painel" });
    await screen.findByText("Taxa de resolução");

    await userEvent.click(screen.getByRole("button", { name: "Todo o período" }));

    await waitFor(() => expect(queries.at(-1)?.has("reported_from")).toBe(false));
    expect(queries[0]?.has("reported_from")).toBe(true);
    expect(queries[0]?.get("tz")).toBeTruthy();
  });

  it("exibe traço em vez de número quando não há base de cálculo", async () => {
    server.use(
      http.get("/api/analytics", () =>
        HttpResponse.json({
          ...report({
            total: 0,
            active: 0,
            closed: 0,
            inconclusive: 0,
            resolution_rate: null,
            avg_response_minutes: null,
            avg_resolution_minutes: null,
            response_sla_rate: null,
            resolution_sla_rate: null,
            breaching_now: 0,
          }),
          by_analyst: [],
          daily: [],
        }),
      ),
    );

    renderWithProviders(<AnalyticsPage />, { route: "/painel" });

    expect(await screen.findByText("Sem incidentes no período selecionado.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum incidente assumido no período.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum ativo além do prazo")).toBeInTheDocument();
  });

  it("oferece tentar de novo quando a API falha", async () => {
    server.use(
      http.get("/api/analytics", () =>
        HttpResponse.json(
          { status: 503, title: "Indisponível", detail: "O banco de dados não respondeu a tempo." },
          { status: 503 },
        ),
      ),
    );

    renderWithProviders(<AnalyticsPage />, { route: "/painel" });

    expect(await screen.findByRole("alert")).toHaveTextContent("O banco de dados não respondeu");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
  });
});
