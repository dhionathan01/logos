import { ArrowDown, RotateCw, Send, X } from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { MAX_MESSAGE_LENGTH } from "./limits";
import type { ChatMessage } from "../../api/types";
import { useRealtimeStatus } from "../../realtime/realtimeStore";
import { Button } from "../../shared/components/Button";
import { Spinner } from "../../shared/components/Spinner";
import { useSession } from "../auth/useSession";
import { useChatHistory, useHandoverAction, useLoadOlderMessages, useSendMessage } from "./api";
import styles from "./ChatPanel.module.css";
import { chatUiStore, useChatUi } from "./chatUiStore";
import { MessageItem } from "./MessageItem";

/** Distância do fim da lista em que ainda consideramos que o usuário "está acompanhando". */
const FOLLOW_THRESHOLD_PX = 80;

interface PendingMessage {
  tempId: number;
  body: string;
  failed: boolean;
}

const dayFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Hoje";
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return dayFormatter.format(date);
}

export function ChatPanel() {
  const { isOpen } = useChatUi();
  const { user } = useSession();
  const status = useRealtimeStatus();
  const history = useChatHistory();
  const loadOlder = useLoadOlderMessages();
  const sendMessage = useSendMessage();
  const handoverAction = useHandoverAction();

  const listRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const previousCount = useRef(0);
  const scrollAnchor = useRef<number | null>(null);
  const nextTempId = useRef(0);

  const messages = history.data?.items ?? [];

  // Só move o scroll; o evento de scroll que isso dispara atualiza isFollowing/hasUnseen.
  const scrollToEnd = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior });
  }, []);

  // Mensagem nova: acompanha se o usuário está no fim; senão, só sinaliza.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (scrollAnchor.current !== null) {
      // Carregou mensagens antigas no topo: mantém a posição de leitura.
      list.scrollTop = list.scrollHeight - scrollAnchor.current;
      scrollAnchor.current = null;
    } else if (messages.length > previousCount.current) {
      if (isFollowing || previousCount.current === 0) scrollToEnd("auto");
      else setHasUnseen(true);
    }
    previousCount.current = messages.length;
  }, [messages.length, isFollowing, scrollToEnd]);

  useEffect(() => {
    if (isOpen) scrollToEnd("auto");
  }, [isOpen, scrollToEnd]);

  const handleScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const following = list.scrollHeight - list.scrollTop - list.clientHeight < FOLLOW_THRESHOLD_PX;
    setIsFollowing(following);
    if (following) setHasUnseen(false);
  };

  const send = (body: string, tempId: number) => {
    setPending((current) => [
      ...current.filter((item) => item.tempId !== tempId),
      { tempId, body, failed: false },
    ]);
    scrollToEnd();
    sendMessage.mutate(
      { body },
      {
        onSuccess: () => setPending((current) => current.filter((item) => item.tempId !== tempId)),
        onError: () =>
          setPending((current) =>
            current.map((item) => (item.tempId === tempId ? { ...item, failed: true } : item)),
          ),
      },
    );
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    nextTempId.current += 1;
    send(body, nextTempId.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleLoadOlder = () => {
    const first = messages[0];
    const list = listRef.current;
    if (!first || !list) return;
    scrollAnchor.current = list.scrollHeight - list.scrollTop;
    loadOlder.mutate(first.id);
  };

  return (
    <aside
      className={styles.panel}
      data-open={isOpen || undefined}
      aria-label="Chat da central"
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Central</h2>
          <p className={styles.subtitle} data-status={status}>
            <span className={styles.statusDot} aria-hidden="true" />
            {status === "open"
              ? "Ao vivo · todos os analistas veem esta conversa"
              : status === "reconnecting"
                ? "Reconectando… as mensagens perdidas chegam ao voltar"
                : "Conectando…"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Fechar chat"
          icon={<X size={18} />}
          onClick={chatUiStore.close}
        />
      </header>

      <div className={styles.messages} ref={listRef} onScroll={handleScroll}>
        {history.isPending ? (
          <p className={styles.state}>
            <Spinner size={14} /> Carregando conversa…
          </p>
        ) : history.isError ? (
          <div className={styles.state}>
            <p>Não foi possível carregar a conversa.</p>
            <Button size="sm" variant="secondary" onClick={() => void history.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {history.data?.has_more && (
              <Button
                size="sm"
                variant="ghost"
                className={styles.loadOlder}
                isLoading={loadOlder.isPending}
                onClick={handleLoadOlder}
              >
                Carregar mensagens anteriores
              </Button>
            )}
            {messages.length === 0 && (
              <p className={styles.state}>
                Nenhuma mensagem ainda. Avisos de quem assume, conflitos e pedidos de passagem
                aparecem aqui automaticamente.
              </p>
            )}
            <ol className={styles.list}>
              {messages.map((message, index) => (
                <MessageWithDay
                  key={message.id}
                  message={message}
                  previous={messages[index - 1]}
                  currentUserId={user?.id}
                  isActing={
                    handoverAction.isPending &&
                    handoverAction.variables?.handoverId === message.handover?.id
                  }
                  onHandoverAction={(handoverId, action) =>
                    handoverAction.mutate({ handoverId, action })
                  }
                />
              ))}
              {pending.map((item) => (
                <li
                  key={item.tempId}
                  className={styles.pending}
                  data-failed={item.failed || undefined}
                >
                  <p className={styles.pendingBubble}>{item.body}</p>
                  {item.failed ? (
                    <button
                      type="button"
                      className={styles.retry}
                      onClick={() => send(item.body, item.tempId)}
                    >
                      <RotateCw size={12} aria-hidden="true" /> Não enviada. Tentar de novo
                    </button>
                  ) : (
                    <span className={styles.sending}>
                      <Spinner size={10} /> Enviando…
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      {hasUnseen && (
        <button type="button" className={styles.unseen} onClick={() => scrollToEnd()}>
          <ArrowDown size={14} aria-hidden="true" /> Novas mensagens
        </button>
      )}

      <form className={styles.composer} onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="chat-message">
          Mensagem para a central
        </label>
        <textarea
          id="chat-message"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Mensagem para a central (Enter envia, Shift+Enter quebra linha)"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="submit"
          aria-label="Enviar"
          icon={<Send size={16} />}
          disabled={!draft.trim()}
        />
      </form>
    </aside>
  );
}

function MessageWithDay({
  message,
  previous,
  ...props
}: {
  message: ChatMessage;
  previous: ChatMessage | undefined;
  currentUserId: string | undefined;
  isActing: boolean;
  onHandoverAction: (handoverId: string, action: "accept" | "decline" | "cancel") => void;
}) {
  const showDay =
    !previous ||
    new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
  return (
    <>
      {showDay && (
        <li className={styles.day} aria-hidden="true">
          {dayLabel(message.created_at)}
        </li>
      )}
      <MessageItem message={message} {...props} />
    </>
  );
}
