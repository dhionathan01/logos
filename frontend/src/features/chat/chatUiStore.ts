import { useSyncExternalStore } from "react";

interface ChatUiState {
  isOpen: boolean;
  unread: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let state: ChatUiState = { isOpen: false, unread: 0 };

function update(patch: Partial<ChatUiState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

/** Estado do painel do chat, compartilhado entre o header e o painel em qualquer tela. */
export const chatUiStore = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  open: () => update({ isOpen: true, unread: 0 }),
  close: () => update({ isOpen: false }),
  toggle: () => (state.isOpen ? chatUiStore.close() : chatUiStore.open()),
  messageArrived: () => {
    if (!state.isOpen) update({ unread: state.unread + 1 });
  },
};

export function useChatUi(): ChatUiState {
  return useSyncExternalStore(chatUiStore.subscribe, chatUiStore.getState);
}
