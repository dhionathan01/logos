import { useCallback, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "light" | "dark";

const STORAGE_KEY = "logos.theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  const setTheme = useCallback((next: Theme) => {
    const apply = () => {
      flushSync(() => setThemeState(next));
      document.documentElement.dataset.theme = next;
    };
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preferência não persiste em modo privado; o tema muda mesmo assim.
    }
    // View Transitions faz o cross-fade entre temas onde o navegador suporta.
    if (document.startViewTransition) document.startViewTransition(apply);
    else apply();
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(currentTheme() === "dark" ? "light" : "dark"),
    [setTheme],
  );

  return { theme, setTheme, toggleTheme };
}
