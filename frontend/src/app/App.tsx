import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { IncidentBoard } from "../features/incidents/IncidentBoard";
import { useTheme } from "../shared/hooks/useTheme";
import { AppShell } from "./AppShell";
import { ErrorBoundary } from "./ErrorBoundary";
import { createQueryClient } from "./queryClient";

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
              <Route path="painel" element={<AnalyticsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        {/* À esquerda: o lado direito é do painel do chat, que não pode ficar coberto. */}
        <Toaster position="bottom-left" theme={theme} richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
