import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "../test/server";
import { ApiError, NetworkError, configureAuth, request } from "./httpClient";

describe("request", () => {
  it("envia o token e devolve o JSON", async () => {
    configureAuth(
      () => "token-123",
      () => {},
    );
    server.use(
      http.get("/api/ping", ({ request: incoming }) =>
        HttpResponse.json({ auth: incoming.headers.get("Authorization") }),
      ),
    );

    await expect(request("/ping")).resolves.toEqual({ auth: "Bearer token-123" });
  });

  it("converte Problem Details em ApiError com o estado atual do conflito", async () => {
    server.use(
      http.patch("/api/incidents/1/status", () =>
        HttpResponse.json(
          {
            type: "/problems/version-conflict",
            title: "Conflito",
            status: 409,
            detail: "Alterado por outra pessoa",
            current: { id: "1", version: 3 },
          },
          { status: 409 },
        ),
      ),
    );

    const error = await request("/incidents/1/status", { method: "PATCH", body: {} }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isConflict).toBe(true);
    expect((error as ApiError).problem.current).toMatchObject({ version: 3 });
  });

  it("transforma falha de rede em NetworkError", async () => {
    server.use(http.get("/api/ping", () => HttpResponse.error()));

    await expect(request("/ping")).rejects.toBeInstanceOf(NetworkError);
  });

  it("gera mensagem amigável quando o proxy devolve HTML", async () => {
    server.use(http.get("/api/ping", () => new HttpResponse("<html>502</html>", { status: 502 })));

    const error = (await request("/ping").catch((caught: unknown) => caught)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.message).toMatch(/instável/);
  });

  it("avisa a sessão quando o token deixa de valer", async () => {
    const onUnauthorized = vi.fn();
    configureAuth(() => "expirado", onUnauthorized);
    server.use(
      http.get("/api/ping", () =>
        HttpResponse.json({ title: "Não autenticado", status: 401, detail: "x" }, { status: 401 }),
      ),
    );

    await request("/ping").catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
