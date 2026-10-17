import { describe, expect, it } from "vitest";

import { parseServerSentEvents } from "./sseParser";

describe("parseServerSentEvents", () => {
  it("lê evento com tipo, id e dados", () => {
    const { events, rest } = parseServerSentEvents(
      'event: chat.message\nid: 42\ndata: {"body":"oi"}\n\n',
    );

    expect(events).toEqual([{ event: "chat.message", id: "42", data: '{"body":"oi"}' }]);
    expect(rest).toBe("");
  });

  it("guarda o bloco incompleto para a próxima leitura", () => {
    const first = parseServerSentEvents("event: incident.changed\ndata: {");
    const second = parseServerSentEvents(`${first.rest}"x":1}\n\n`);

    expect(first.events).toEqual([]);
    expect(second.events).toEqual([{ event: "incident.changed", data: '{"x":1}' }]);
  });

  it("ignora comentários de batimento e diretivas sem dados", () => {
    const { events } = parseServerSentEvents(": ping\n\nretry: 3000\n\n");

    expect(events).toEqual([]);
  });

  it("aceita quebras de linha CRLF e dados em várias linhas", () => {
    const { events } = parseServerSentEvents("data: linha 1\r\ndata: linha 2\r\n\r\n");

    expect(events).toEqual([{ event: "message", data: "linha 1\nlinha 2" }]);
  });
});
