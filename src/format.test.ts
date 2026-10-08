import { describe, expect, it } from 'vitest';
import {
  estadoColor,
  fmtBogotaDate,
  fmtDeadline,
  fmtFileSize,
  fmtMoney,
  fmtMoneyCompact,
  fmtMoneyExact,
  fmtNit,
  fmtPercent,
  fmtPeriod,
  recentMonths,
  taxLabel,
  toBogotaIsoDate,
  vencePhrase,
} from './format';

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

  it('fmtMoneyCompact formatea importes compactos según AC #2 (millones, miles, redondeo de borde y no finitos)', () => {
    // Casos base especificados en el AC
    expect(fmtMoneyCompact(0)).toBe('$0');
    expect(fmtMoneyCompact(850)).toBe('$850');
    expect(fmtMoneyCompact(85000)).toBe('$85 mil');
    expect(fmtMoneyCompact(850000)).toBe('$850 mil');
    expect(fmtMoneyCompact(1250000)).toBe('$1,3 M');
    expect(fmtMoneyCompact(12500000)).toBe('$12,5 M');
    expect(fmtMoneyCompact(10000000)).toBe('$10 M');
    expect(fmtMoneyCompact(1500000000)).toBe('$1.500 M');

    // Negativos con signo antes del $
    expect(fmtMoneyCompact(-850)).toBe('-$850');
    expect(fmtMoneyCompact(-85000)).toBe('-$85 mil');
    expect(fmtMoneyCompact(-1250000)).toBe('-$1,3 M');
    expect(fmtMoneyCompact(-10000000)).toBe('-$10 M');
    expect(fmtMoneyCompact(-1500000000)).toBe('-$1.500 M');

    // Redondeo de borde: 999600 -> $1 M (nunca $1.000 mil)
    expect(fmtMoneyCompact(999600)).toBe('$1 M');
    expect(fmtMoneyCompact(-999600)).toBe('-$1 M');

    // Valores no finitos -> $0
    expect(fmtMoneyCompact(Number.NaN)).toBe('$0');
    expect(fmtMoneyCompact(Number.POSITIVE_INFINITY)).toBe('$0');
    expect(fmtMoneyCompact(Number.NEGATIVE_INFINITY)).toBe('$0');
  });

  it('fmtPeriod convierte YYYY-MM y deja intacto lo demás', () => {
    expect(fmtPeriod('2026-08')).toBe('Agosto 2026');
    expect(fmtPeriod('2026-13')).toBe('2026-13');
    expect(fmtPeriod('Jul – Ago 2026')).toBe('Jul – Ago 2026');
  });

  it('fmtDeadline convierte YYYY-MM-DD a día sin cero, mes en tres letras y año', () => {
    expect(fmtDeadline('2026-09-14')).toBe('14 sep 2026');
    expect(fmtDeadline('2026-01-05')).toBe('5 ene 2026');
    expect(fmtDeadline('2026-12-01')).toBe('1 dic 2026');
    expect(fmtDeadline('invalido')).toBe('invalido');
    expect(fmtDeadline('10 sept 2026')).toBe('10 sept 2026');
  });

  it('taxLabel mapea tipos conocidos a sus etiquetas y tolera null o desconocidos', () => {
    expect(taxLabel('IVA_BIMESTRAL')).toBe('Declaración de IVA');
    expect(taxLabel('IVA_CUATRIMESTRAL')).toBe('Declaración de IVA');
    expect(taxLabel('RETEFUENTE')).toBe('Retención en la fuente');
    expect(taxLabel('RENTA_PERSONAS_NATURALES')).toBe('Declaración de renta');
    expect(taxLabel('RENTA_PERSONAS_JURIDICAS')).toBe('Declaración de renta');
    expect(taxLabel(null)).toBe('');
    expect(taxLabel('ICA_BIMESTRAL')).toBe('ICA_BIMESTRAL');
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

  it('fmtFileSize formatea tamaños legibles según AC #3 (0 B, 999 B, 230 KB, 1,2 MB)', () => {
    expect(fmtFileSize(0)).toBe('0 B');
    expect(fmtFileSize(999)).toBe('999 B');
    expect(fmtFileSize(230 * 1024)).toBe('230 KB');
    expect(fmtFileSize(235520)).toBe('230 KB');
    expect(fmtFileSize(1.2 * 1024 * 1024)).toBe('1,2 MB');
    expect(fmtFileSize(1258291)).toBe('1,2 MB');
    expect(fmtFileSize(-500)).toBe('0 B');
    expect(fmtFileSize(Number.NaN)).toBe('0 B');
  });

  it('toBogotaIsoDate y fmtBogotaDate interpretan UTC sin zona y convierten a hora Bogotá', () => {
    // 2026-10-06T21:57:00 UTC -> 16:57 Bogotá (mismo día 6 oct)
    expect(toBogotaIsoDate('2026-10-06T21:57:00')).toBe('2026-10-06');
    expect(fmtBogotaDate('2026-10-06T21:57:00')).toBe('6 oct 2026');
    // Fecha sin hora (fecha de corte o de gracia): ya es un día calendario, no se corre al día anterior.
    expect(toBogotaIsoDate('2026-10-12')).toBe('2026-10-12');
    expect(fmtBogotaDate('2026-10-08')).toBe('8 oct 2026');
    // Con zona explícita sí se convierte.
    expect(toBogotaIsoDate('2026-10-07T02:00:00Z')).toBe('2026-10-06');
    expect(toBogotaIsoDate('2026-10-07T02:00:00-05:00')).toBe('2026-10-07');

    // Madrugada UTC: 2026-10-07T02:30:00 UTC -> 21:30 Bogotá del día anterior (6 oct)
    expect(toBogotaIsoDate('2026-10-07T02:30:00')).toBe('2026-10-06');
    expect(fmtBogotaDate('2026-10-07T02:30:00')).toBe('6 oct 2026');

    // Mañana UTC: 2026-10-07T06:00:00 UTC -> 01:00 Bogotá del día 7
    expect(toBogotaIsoDate('2026-10-07T06:00:00')).toBe('2026-10-07');
    expect(fmtBogotaDate('2026-10-07T06:00:00')).toBe('7 oct 2026');

    // Fechas que ya incluyen 'Z'
    expect(toBogotaIsoDate('2026-10-07T02:30:00Z')).toBe('2026-10-06');
    expect(fmtBogotaDate('2026-10-07T02:30:00Z')).toBe('6 oct 2026');

    // Texto no ISO o inválido no rompe
    expect(fmtBogotaDate('invalido')).toBe('invalido');
  });
});

