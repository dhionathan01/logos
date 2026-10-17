import { describe, expect, it } from "vitest";

import { heatStep } from "./heat";

describe("heatStep", () => {
  it("zero não recebe cor", () => {
    expect(heatStep(0, 40)).toBe(0);
  });

  it("o maior valor ocupa o degrau mais escuro e valores pequenos ainda aparecem", () => {
    expect(heatStep(40, 40)).toBe(5);
    expect(heatStep(1, 40)).toBe(1);
    expect(heatStep(20, 40)).toBe(3);
  });
});
