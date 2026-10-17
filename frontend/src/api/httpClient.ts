import type { ProblemDetails } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

/** A API respondeu com erro (4xx/5xx) no formato Problem Details. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }

  get isConflict(): boolean {
    return this.status === 409 || this.status === 403;
  }
}

/** A requisição nem chegou a ter resposta: sem conexão, DNS, servidor fora do ar. */
export class NetworkError extends Error {
  constructor(message = "Sem conexão com o servidor.") {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends NetworkError {
  constructor() {
    super("O servidor demorou demais para responder.");
    this.name = "TimeoutError";
  }
}

type TokenProvider = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenProvider = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureAuth(provider: TokenProvider, handler: UnauthorizedHandler): void {
  getToken = provider;
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: URLSearchParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    headers = {},
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const timeout = AbortSignal.timeout(timeoutMs);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const token = getToken();
  const url = `/api${path}${query && query.size > 0 ? `?${query}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: combinedSignal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (timeout.aborted) throw new TimeoutError();
    if (signal?.aborted) throw error; // cancelamento pedido pelo React Query: não é falha
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const problem = await parseProblem(response);
    if (response.status === 401 && token) onUnauthorized();
    throw new ApiError(problem);
  }

  return (await response.json()) as T;
}

async function parseProblem(response: Response): Promise<ProblemDetails> {
  try {
    const data = (await response.json()) as Partial<ProblemDetails>;
    if (typeof data.status === "number" && typeof data.title === "string") {
      return { detail: data.title, type: "about:blank", ...data } as ProblemDetails;
    }
  } catch {
    // Corpo não-JSON (ex.: página de erro do proxy): cai no genérico abaixo.
  }
  return {
    type: "about:blank",
    status: response.status,
    title: response.statusText || "Erro",
    detail:
      response.status >= 500
        ? "O servidor está instável no momento. Tentando novamente…"
        : "Não foi possível concluir a requisição.",
  };
}
