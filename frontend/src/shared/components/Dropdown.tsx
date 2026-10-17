import { ChevronDown } from "lucide-react";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import styles from "./Dropdown.module.css";

/** Margem mínima entre o painel aberto e a borda da tela. */
const VIEWPORT_GUTTER_PX = 16;

interface DropdownProps {
  label: string;
  /** Valor atual em texto curto, exibido no próprio botão. */
  summary: string;
  /** Destaca o botão quando o filtro difere do padrão. */
  isActive?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}

/** Filtro compacto: rótulo e valor atual no botão, as opções num painel sob demanda. */
export function Dropdown({ label, summary, isActive = false, children }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = () => setIsOpen(false);

  // Fecha ao clicar ou focar fora, e no Esc (devolvendo o foco ao botão).
  useEffect(() => {
    if (!isOpen) return;
    const isOutside = (target: EventTarget | null) =>
      !(target instanceof Node && rootRef.current?.contains(target));
    const onPointerDown = (event: PointerEvent) => {
      if (isOutside(event.target)) setIsOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isOutside(event.target)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  // No mobile o botão pode estar perto da borda: desloca o painel para caber na tela.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;
    panel.style.translate = "";
    const rect = panel.getBoundingClientRect();
    const overflowRight = rect.right - (window.innerWidth - VIEWPORT_GUTTER_PX);
    const overflowLeft = VIEWPORT_GUTTER_PX - rect.left;
    if (overflowRight > 0) panel.style.translate = `${-Math.min(overflowRight, -overflowLeft)}px 0`;
    else if (overflowLeft > 0) panel.style.translate = `${overflowLeft}px 0`;
  }, [isOpen]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        data-active={isActive || undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          <span className={styles.summary}>{summary}</span>
        </span>
        <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
      </button>
      {isOpen && (
        <div id={panelId} ref={panelRef} className={styles.panel} role="group" aria-label={label}>
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

interface DropdownOptionProps {
  type: "checkbox" | "radio";
  name?: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}

export function DropdownOption({ type, name, checked, onChange, children }: DropdownOptionProps) {
  return (
    <label className={styles.option}>
      <input type={type} name={name} checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}
