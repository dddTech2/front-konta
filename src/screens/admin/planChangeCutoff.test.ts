import { describe, expect, it } from 'vitest';
import { planChangeCutoff } from './AdminFicha';

describe('planChangeCutoff (corte al cambiar de plan)', () => {
  it('trimestral a mensual: cuenta desde el inicio del periodo en curso', () => {
    expect(planChangeCutoff('2027-01-19', 3, 1)).toBe('2026-11-19');
  });

  it('mensual a semestral extiende el corte', () => {
    expect(planChangeCutoff('2026-11-19', 1, 6)).toBe('2027-04-19');
  });

  it('ajusta al último día del mes', () => {
    expect(planChangeCutoff('2027-05-31', 3, 1)).toBe('2027-03-28'); // pasa por el 28 de febrero, igual que el backend
    expect(planChangeCutoff('2027-03-31', 1, 1)).toBeNull();
    expect(planChangeCutoff('2027-04-30', 3, 1)).toBe('2027-02-28');
  });

  it('sin cambio de duración o sin corte no cambia nada', () => {
    expect(planChangeCutoff('2027-01-19', 3, 3)).toBeNull();
    expect(planChangeCutoff(null, 3, 1)).toBeNull();
  });
});
