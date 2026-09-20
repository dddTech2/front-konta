import { describe, expect, it } from 'vitest';
import { estadoColor, fmtMoney, fmtMoneyExact, fmtNit, fmtPercent, fmtPeriod, recentMonths, vencePhrase } from './format';

describe('format', () => {
  it('fmtMoney usa es-CO como el prototipo: $12.450.000', () => {
    expect(fmtMoney(12450000)).toBe('$12.450.000');
    expect(fmtMoney(1850000.4)).toBe('$1.850.000');
    expect(fmtMoney(0)).toBe('$0');
    expect(fmtMoney(-50000)).toBe('-$50.000');
    expect(fmtMoney(Number.NaN)).toBe('$0');
  });

  it('fmtMoneyExact muestra decimales solo si la venta los tiene', () => {
    expect(fmtMoneyExact('150000.00')).toBe('$150.000');
    expect(fmtMoneyExact('100.10')).toBe('$100,10');
    expect(fmtMoneyExact(2500.5)).toBe('$2.500,50');
    expect(fmtMoneyExact('abc')).toBe('$0');
  });

  it('fmtPeriod convierte YYYY-MM y deja intacto lo demás', () => {
    expect(fmtPeriod('2026-08')).toBe('Agosto 2026');
    expect(fmtPeriod('2026-13')).toBe('2026-13');
    expect(fmtPeriod('Jul – Ago 2026')).toBe('Jul – Ago 2026');
  });

  it('fmtNit agrupa miles y agrega el dígito de verificación', () => {
    expect(fmtNit('900123456', '7')).toBe('900.123.456-7');
    expect(fmtNit('900.123.456')).toBe('900.123.456');
  });

  it('fmtPercent usa el valor absoluto con una decimal como máximo', () => {
    expect(fmtPercent(8)).toBe('8');
    expect(fmtPercent(-4.2)).toBe('4,2');
    expect(fmtPercent(Number.NaN)).toBe('0');
  });

  it('vencePhrase distingue mañana, hoy y vencido', () => {
    expect(vencePhrase(5)).toBe('vence en 5 días');
    expect(vencePhrase(1)).toBe('vence en 1 día');
    expect(vencePhrase(0)).toBe('vence hoy');
    expect(vencePhrase(-3)).toBe('venció');
  });

  it('recentMonths cruza el cambio de año', () => {
    expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['2026-01', '2025-12', '2025-11']);
  });

  it('estadoColor conserva los colores del prototipo y tiene un valor por defecto', () => {
    expect(estadoColor('en_curso')).toBe('var(--terracota)');
    expect(estadoColor('presentado')).toBe('var(--verde-tint)');
    expect(estadoColor('vencido')).toBe('var(--terracota-dark)');
    expect(estadoColor('otro')).toBe('var(--gris-medio)');
  });
});
