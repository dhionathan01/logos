import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { IncidentBoard } from "../features/incidents/IncidentBoard";
import { WorkspacePage } from "../features/workspace/WorkspacePage";
import { useTheme } from "../shared/hooks/useTheme";
import { AppShell } from "./AppShell";
import { ErrorBoundary } from "./ErrorBoundary";
import { createQueryClient } from "./queryClient";

/** Altura da barra do chat (--chat-bar-height) mais uma folga. */
const CHAT_BAR_CLEARANCE_PX = 68;

export function App() {
  const [queryClient] = useState(createQueryClient);
  const { theme } = useTheme();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell>
                    <Outlet />
                  </AppShell>
                </RequireAuth>
              }
            >
              <Route index element={<IncidentBoard />} />
              <Route path="meu-ambiente" element={<WorkspacePage />} />
              <Route path="painel" element={<AnalyticsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        {/* À esquerda e acima da barra do chat, que fica fixa no rodapé e não pode ser coberta. */}
        <Toaster
          position="bottom-left"
          offset={{ bottom: CHAT_BAR_CLEARANCE_PX }}
          mobileOffset={{ bottom: CHAT_BAR_CLEARANCE_PX }}
          theme={theme}
          richColors
          closeButton
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
