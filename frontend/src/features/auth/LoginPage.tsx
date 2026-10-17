import { AlertCircle, Gauge, ShieldCheck, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../api/httpClient";
import { Button } from "../../shared/components/Button";
import { Logo } from "../../shared/components/Logo";
import { ThemeToggle } from "../../shared/components/ThemeToggle";
import styles from "./LoginPage.module.css";
import { type Credentials, useLogin, useSession } from "./useSession";

const DEMO_PASSWORD = "logos2026";
const DEMO_ACCOUNTS = [
  { username: "ana", name: "Ana Souza" },
  { username: "bruno", name: "Bruno Lima" },
];

export function LoginPage() {
  const { isAuthenticated, logoutReason } = useSession();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [credentials, setCredentials] = useState<Credentials>({ username: "", password: "" });

  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";
  if (isAuthenticated && !login.isPending) return <Navigate to={redirectTo} replace />;

  const signIn = (target: Credentials) => {
    login.mutate(target, {
      onSuccess: () => navigate(redirectTo, { replace: true, viewTransition: true }),
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    signIn(credentials);
  };

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "Sem conexão com o servidor. Verifique sua rede e tente novamente."
        : null;

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <Logo size="lg" />
        <h1 id="hero-title" className={styles.heroTitle}>
          Central de Resposta a Incidentes da frota
        </h1>
        <p className={styles.heroLead}>
          Todos os incidentes dos caminhões em rota em uma única fila, já ordenada pelo que exige
          ação primeiro.
        </p>
        <ul className={styles.benefits}>
          <li>
            <Gauge size={20} aria-hidden="true" />
            Prioridade visível em segundos: criticidade, tempo aberto e status.
          </li>
          <li>
            <Users size={20} aria-hidden="true" />
            Um analista por incidente: quem assume, resolve. Sem trabalho duplicado.
          </li>
          <li>
            <ShieldCheck size={20} aria-hidden="true" />
            Nenhuma alteração se perde, mesmo com conexão instável.
          </li>
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.panelHeader}>
          <ThemeToggle />
        </div>

        <div className={styles.formWrapper}>
          <h2 id="login-title" className={styles.title}>
            Entrar
          </h2>

          {logoutReason === "expired" && (
            <p className={styles.notice} role="status">
              Sua sessão expirou. Entre novamente para continuar.
            </p>
          )}

          <div className={styles.demo}>
            <p className={styles.demoTitle}>Acesso de demonstração</p>
            <p className={styles.demoHint}>
              Para ver o controle de conflito, entre como Ana em uma janela e como Bruno em uma
              janela anônima, e tente assumir o mesmo incidente.
            </p>
            <div className={styles.demoButtons}>
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.username}
                  variant="secondary"
                  isLoading={login.isPending && login.variables?.username === account.username}
                  disabled={login.isPending}
                  onClick={() => signIn({ username: account.username, password: DEMO_PASSWORD })}
                >
                  Entrar como {account.name}
                </Button>
              ))}
            </div>
            <p className={styles.demoCredentials}>
              ou use <code>ana</code> / <code>bruno</code> com a senha <code>{DEMO_PASSWORD}</code>
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label className={styles.field}>
              <span>Usuário</span>
              <input
                name="username"
                autoComplete="username"
                required
                value={credentials.username}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>
            <label className={styles.field}>
              <span>Senha</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={credentials.password}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>

            {errorMessage && (
              <p className={styles.error} role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {errorMessage}
              </p>
            )}

            <Button
              type="submit"
              isLoading={login.isPending && login.variables?.username === credentials.username}
              disabled={login.isPending || !credentials.username || !credentials.password}
            >
              Entrar
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
