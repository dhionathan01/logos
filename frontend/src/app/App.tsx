import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

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
              path="/"
              element={
                <RequireAuth>
                  <AppShell>
                    <IncidentBoard />
                  </AppShell>
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="bottom-right" theme={theme} richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
