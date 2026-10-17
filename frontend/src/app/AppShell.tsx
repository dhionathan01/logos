import { BarChart3, ListChecks, LogOut, Menu, WifiOff, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useSession } from "../features/auth/useSession";
import { ChatPanel } from "../features/chat/ChatPanel";
import { useChatUi } from "../features/chat/chatUiStore";
import { RealtimeBridge } from "../realtime/RealtimeBridge";
import { Button } from "../shared/components/Button";
import { Logo } from "../shared/components/Logo";
import { ThemeToggle } from "../shared/components/ThemeToggle";
import { useOnlineStatus } from "../shared/hooks/useOnlineStatus";
import styles from "./AppShell.module.css";

const NAVIGATION = [
  { to: "/", label: "Fila de incidentes", icon: ListChecks },
  { to: "/painel", label: "Painel analítico", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const isOnline = useOnlineStatus();
  const { isOpen: isChatOpen } = useChatUi();
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Trocou de tela (inclusive pelo voltar do navegador): o menu fecha.
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setIsMenuOpen(false);
  }

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node && headerRef.current?.contains(event.target))) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  const navLinks = (variant: "bar" | "menu") =>
    NAVIGATION.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        end
        viewTransition
        className={({ isActive }) =>
          [styles.navLink, variant === "menu" && styles.menuLink, isActive && styles.navLinkActive]
            .filter(Boolean)
            .join(" ")
        }
        onClick={() => setIsMenuOpen(false)}
      >
        <Icon size={variant === "menu" ? 18 : 16} aria-hidden="true" />
        {label}
      </NavLink>
    ));

  return (
    <div className={styles.shell}>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.headerInner}>
          <div className={styles.brandAndNav}>
            <Logo />
            <nav className={styles.nav} aria-label="Principal">
              {navLinks("bar")}
            </nav>
          </div>
          <div className={styles.actions}>
            {user && (
              <span className={styles.user}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(user.display_name)}
                </span>
                <span>{user.display_name}</span>
              </span>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className={styles.logout}
              onClick={logout}
              icon={<LogOut size={16} />}
            >
              Sair
            </Button>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              aria-expanded={isMenuOpen}
              aria-controls="menu-principal"
              aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? (
                <X size={22} aria-hidden="true" />
              ) : (
                <Menu size={22} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile: as telas, quem está logado e o sair ficam atrás do hambúrguer. */}
        <div id="menu-principal" className={styles.mobileMenu} hidden={!isMenuOpen}>
          <nav className={styles.menuNav} aria-label="Principal (menu)">
            {navLinks("menu")}
          </nav>
          {user && (
            <div className={styles.menuFooter}>
              <span className={styles.user}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(user.display_name)}
                </span>
                <span>{user.display_name}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={logout} icon={<LogOut size={16} />}>
                Sair
              </Button>
            </div>
          )}
        </div>
      </header>

      {!isOnline && (
        <div className={styles.offline} role="status">
          <WifiOff size={16} aria-hidden="true" />
          Sem conexão. Você continua vendo os últimos dados; alterações feitas agora serão enviadas
          assim que a conexão voltar.
        </div>
      )}

      <main className={styles.main} data-chat-open={isChatOpen || undefined}>
        {children}
      </main>
      <ChatPanel />
      <RealtimeBridge />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
