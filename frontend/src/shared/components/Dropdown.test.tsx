import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Dropdown, DropdownOption } from "./Dropdown";
import { summarizeSelection } from "./summarizeSelection";

function StatusFilter() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (value: string) =>
    setSelected((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  return (
    <Dropdown label="Status" summary={summarizeSelection(selected)} isActive={selected.length > 0}>
      {["Aberto", "Fechado"].map((status) => (
        <DropdownOption
          key={status}
          type="checkbox"
          checked={selected.includes(status)}
          onChange={() => toggle(status)}
        >
          {status}
        </DropdownOption>
      ))}
    </Dropdown>
  );
}

describe("Dropdown", () => {
  it("mostra o valor atual no botão e as opções só quando aberto", async () => {
    render(<StatusFilter />);
    const trigger = screen.getByRole("button", { name: /Status/ });
    expect(trigger).toHaveTextContent("Todos");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("checkbox", { name: "Aberto" }));

    expect(trigger).toHaveTextContent("Aberto");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("fecha no Esc e devolve o foco ao botão", async () => {
    render(<StatusFilter />);
    const trigger = screen.getByRole("button", { name: /Status/ });

    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("group", { name: "Status" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("resume várias escolhas pela contagem", () => {
    expect(summarizeSelection(["Aberto", "Fechado"])).toBe("2 selecionados");
    expect(summarizeSelection([], "Todas")).toBe("Todas");
  });
});
