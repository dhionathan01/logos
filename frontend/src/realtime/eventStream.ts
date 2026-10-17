import { parseServerSentEvents } from "./sseParser";

export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface StreamEvent {
  type: string;
  id?: string;
  data: unknown;
}

interface StreamOptions {
  url: string;
  getToken: () => string | null;
  onEvent: (event: StreamEvent) => void;
  onStatus: (status: StreamStatus) => void;
  onUnauthorized: () => void;
}

const MAX_BACKOFF_MS = 30_000;
/** O servidor manda "ping" a cada 15 s; sem nada por 45 s, a conexão está morta. */
const SILENCE_TIMEOUT_MS = 45_000;

/**
 * Conexão SSE via fetch (ADR-0014): o token vai no cabeçalho, nunca na URL.
 * Reconecta com backoff exponencial + jitter e informa o último id recebido
 * (Last-Event-ID) para o servidor reenviar o que se perdeu.
 */
export function openEventStream(options: StreamOptions): () => void {
  let stopped = false;
  let attempt = 0;
  let lastEventId: string | undefined;
  let controller: AbortController | undefined;
  let retryTimer: number | undefined;
  let silenceTimer: number | undefined;

  const resetSilenceTimer = () => {
    window.clearTimeout(silenceTimer);
    silenceTimer = window.setTimeout(() => controller?.abort(), SILENCE_TIMEOUT_MS);
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    attempt += 1;
    const delay = Math.min(1_000 * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 500;
    options.onStatus("reconnecting");
    retryTimer = window.setTimeout(connect, delay);
  };

  async function connect() {
    if (stopped) return;
    window.clearTimeout(retryTimer);
    options.onStatus(attempt === 0 ? "connecting" : "reconnecting");
    controller = new AbortController();
    const token = options.getToken();

    try {
      const response = await fetch(options.url, {
        headers: {
          Accept: "text/event-stream",
          ...(token && { Authorization: `Bearer ${token}` }),
          ...(lastEventId && { "Last-Event-ID": lastEventId }),
        },
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 401) {
        stopped = true;
        options.onUnauthorized();
        return;
      }
      if (!response.ok || !response.body)
        throw new Error(`Stream indisponível (${response.status})`);

      options.onStatus("open");
      attempt = 0;
      resetSilenceTimer();
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        resetSilenceTimer();
        const parsed = parseServerSentEvents(buffer + value);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.id) lastEventId = event.id;
          let data: unknown;
          try {
            data = JSON.parse(event.data);
          } catch {
            continue; // evento corrompido: descarta só ele, a conexão segue
          }
          options.onEvent({ type: event.event, id: event.id, data });
        }
      }
    } catch {
      // Queda de rede, servidor reiniciando ou silêncio prolongado: tenta de novo abaixo.
    } finally {
      window.clearTimeout(silenceTimer);
    }
    scheduleReconnect();
  }

  // Voltou a conexão do navegador: não espera o backoff terminar.
  const reconnectNow = () => {
    if (!stopped && attempt > 0) {
      attempt = 0;
      void connect();
    }
  };
  window.addEventListener("online", reconnectNow);
  void connect();

  return () => {
    stopped = true;
    window.removeEventListener("online", reconnectNow);
    window.clearTimeout(retryTimer);
    window.clearTimeout(silenceTimer);
    controller?.abort();
    options.onStatus("closed");
  };
}
