/** "Todos", o único item escolhido ou o primeiro mais a contagem: cabe no botão no mobile. */
export function summarizeSelection(selected: string[], allLabel = "Todos"): string {
  const [first] = selected;
  if (first === undefined) return allLabel;
  if (selected.length === 1) return first;
  return `${first} +${selected.length - 1}`;
}
