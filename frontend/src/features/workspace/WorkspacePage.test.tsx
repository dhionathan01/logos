import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { ANA, renderWithProviders, signInAs } from "../../test/render";
import { server } from "../../test/server";
import { WorkspacePage } from "./WorkspacePage";

const investigating = {
  id: "i1",
  title: "Pneu furado",
  description: "",
  category: "mechanical_failure",
  severity: "low",
  status: "investigating",
  vehicle_id: "CAM-0001",
  location: "BR-116",
  reported_at: new Date(Date.now() - 3_600_000).toISOString(),
  created_at: new Date(Date.now() - 3_600_000).toISOString(),
  updated_at: new Date().toISOString(),
  closed_at: null,
  resolution_note: null,
  version: 2,
  assignee: { id: ANA.id, display_name: ANA.display_name },
};

describe("WorkspacePage", () => {
  beforeEach(() => signInAs(ANA));

  it("lista só os incidentes do analista logado, com os concluídos numa aba à parte", async () => {
    const queries: URLSearchParams[] = [];
    server.use(
      http.get("/api/incidents", ({ request }) => {
        const query = new URL(request.url).searchParams;
        queries.push(query);
        const closed = query.getAll("status").includes("closed");
        return HttpResponse.json({ items: closed ? [] : [investigating], total: closed ? 0 : 1 });
      }),
    );

    renderWithProviders(<WorkspacePage />, { route: "/meu-ambiente" });

    expect(await screen.findByText("Pneu furado")).toBeInTheDocument();
    expect(queries.every((query) => query.get("assignee") === ANA.id)).toBe(true);
    const doneTab = screen.getByRole("tab", { name: /Concluídos/ });
    expect(within(doneTab).getByText("0")).toBeInTheDocument();

    await userEvent.click(doneTab);

    expect(await screen.findByText("Nenhum incidente concluído no período")).toBeInTheDocument();
    expect(queries.some((query) => query.get("sort") === "recent")).toBe(true);
  });
});
