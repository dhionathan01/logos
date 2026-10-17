import type { TokenResponse, User } from "../../api/types";

const STORAGE_KEY = "logos.session";

export interface Session {
  token: string;
  user: User;
  expiresAt: number;
}

export type LogoutReason = "manual" | "expired";

interface SessionState {
  session: Session | null;
  logoutReason: LogoutReason | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let state: SessionState = { session: readStoredSession(), logoutReason: null };

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function update(next: SessionState): void {
  state = next;
  try {
    if (next.session) localStorage.setItem(STORAGE_KEY, JSON.stringify(next.session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Armazenamento indisponível: a sessão vale só enquanto a aba estiver aberta.
  }
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  getState: (): SessionState => state,

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  start(response: TokenResponse): void {
    update({
      session: {
        token: response.access_token,
        user: response.user,
        expiresAt: Date.now() + response.expires_in * 1000,
      },
      logoutReason: null,
    });
  },

  end(reason: LogoutReason): void {
    if (!state.session) return;
    update({ session: null, logoutReason: reason });
  },

  token: (): string | null => state.session?.token ?? null,
};
