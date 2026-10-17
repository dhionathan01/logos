import { LogOut, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { useSession } from "../features/auth/useSession";
import { Button } from "../shared/components/Button";
import { Logo } from "../shared/components/Logo";
import { ThemeToggle } from "../shared/components/ThemeToggle";
import { useOnlineStatus } from "../shared/hooks/useOnlineStatus";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const isOnline = useOnlineStatus();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo />
          <div className={styles.actions}>
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
