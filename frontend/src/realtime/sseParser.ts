export interface ServerSentEvent {
  event: string;
  data: string;
  id?: string;
}

/**
 * Lê blocos completos de text/event-stream e devolve o que sobrou (bloco incompleto).
 * Segue a especificação: comentários começam com ":", "data" pode ter várias linhas.
 */
export function parseServerSentEvents(buffer: string): {
  events: ServerSentEvent[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n?/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: ServerSentEvent[] = [];

  for (const block of blocks) {
    let event = "message";
    let id: string | undefined;
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
      else if (field === "id") id = value;
    }
    if (data.length > 0) events.push({ event, data: data.join("\n"), ...(id && { id }) });
  }
  return { events, rest };
}
