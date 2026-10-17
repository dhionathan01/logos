// Aplica o tema antes da primeira pintura para não piscar claro → escuro.
// Arquivo externo (e não inline) para funcionar com Content-Security-Policy "script-src 'self'".
(function () {
  var theme = null;
  try {
    theme = localStorage.getItem("logos.theme");
  } catch {
    // Armazenamento bloqueado (modo privado): segue a preferência do sistema.
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
