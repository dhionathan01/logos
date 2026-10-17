import { Moon, Sun } from "lucide-react";

import { useTheme } from "../hooks/useTheme";
import { Button } from "./Button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      icon={theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    />
  );
}
