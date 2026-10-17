/** "Todos", o único item escolhido ou a contagem: cabe no botão em qualquer largura. */
export function summarizeSelection(selected: string[], allLabel = "Todos"): string {
  if (selected.length === 0) return allLabel;
  if (selected.length === 1) return selected[0] ?? allLabel;
  return `${selected.length} selecionados`;
}
