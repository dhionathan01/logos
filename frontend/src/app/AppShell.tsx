import { BarChart3, ListChecks, LogOut, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { useSession } from "../features/auth/useSession";
import { ChatPanel } from "../features/chat/ChatPanel";
import { ChatToggle } from "../features/chat/ChatToggle";
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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandAndNav}>
            <Logo />
            <nav className={styles.nav} aria-label="Principal">
              {NAVIGATION.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  viewTransition
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ""}`
                  }
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className={styles.navLabel}>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className={styles.actions}>
            <ChatToggle />
            {user && (
              <span className={styles.user}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(user.display_name)}
                </span>
                <span className={styles.userName}>{user.display_name}</span>
              </span>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              icon={<LogOut size={16} />}
              aria-label="Sair"
            >
              <span className={styles.logoutLabel}>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className={styles.offline} role="status">
          <WifiOff size={16} aria-hidden="true" />
          Sem conexão. Você continua vendo os últimos dados; alterações feitas agora serão enviadas
          assim que a conexão voltar.
        </div>
      )}

      <main className={styles.main}>{children}</main>
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
