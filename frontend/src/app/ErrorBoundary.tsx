import { Component, type ErrorInfo, type ReactNode } from "react";

import styles from "./ErrorBoundary.module.css";

interface State {
  hasError: boolean;
}

/** Última linha de defesa: um erro de renderização não deixa a tela em branco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Erro de renderização", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className={styles.fallback} role="alert">
        <h1>Algo deu errado nesta tela.</h1>
        <p>Seus dados estão seguros no servidor. Recarregue a página para continuar.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </main>
    );
  }
}
