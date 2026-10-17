export const HEAT_STEPS = 5;

/** Degrau da rampa sequencial (1–5) proporcional ao maior valor da matriz; 0 fica sem cor. */
export function heatStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(1, Math.ceil((value / max) * HEAT_STEPS));
}
