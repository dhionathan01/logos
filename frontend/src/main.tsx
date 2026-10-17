import "./styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { configureAuth } from "./api/httpClient";
import { App } from "./app/App";
import { sessionStore } from "./features/auth/sessionStore";

configureAuth(sessionStore.token, () => sessionStore.end("expired"));

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento #root não encontrado em index.html");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
