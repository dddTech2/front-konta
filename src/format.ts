/** Formato de importes, fechas y estados. Mismas reglas que el prototipo `kontable-prototipo_1.html`. */

/** `$12.450.000` (es-CO). El signo va antes del `$`. */
export function fmtMoney(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0);
  const body = Math.abs(rounded).toLocaleString('es-CO');
  return `${rounded < 0 ? '-' : ''}$${body}`;
}

/** Importe exacto de una venta: `$150.000`, `$100,10` (solo muestra decimales si los tiene). Acepta la cadena Decimal de la API. */
export function fmtMoneyExact(value: string | number): string {
  const amount = Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.abs(Math.round(safe * 100) % 100) !== 0;
  const body = Math.abs(safe).toLocaleString('es-CO', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
  return `${safe < 0 ? '-' : ''}$${body}`;
}

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** `2026-08` -> `Agosto 2026`. Si no tiene ese formato se devuelve tal cual. */
export function fmtPeriod(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${match[1]}` : yearMonth;
}

/** Últimos `count` meses (el actual primero) como `YYYY-MM`. */
export function recentMonths(count: number, now: Date = new Date()): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/** `901234567`, `1` -> `901.234.567-1`. */
export function fmtNit(nit: string, dv?: string): string {
  const digits = nit.replace(/\D/g, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dv ? `${grouped}-${dv}` : grouped;
}

/** `8` -> `8`, `-4.2` -> `4,2` (valor absoluto, una decimal como máximo). */
export function fmtPercent(value: number): string {
  return Math.abs(Number.isFinite(value) ? value : 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

/** Días hasta el vencimiento: "vence en 5 días", "vence hoy", "venció". */
export function vencePhrase(dias: number): string {
  if (dias === 0) return 'vence hoy';
  if (dias < 0) return 'venció';
  return `vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ESTADO_COLOR: Record<string, string> = {
  aldia: 'var(--verde-tint)',
  presentado: 'var(--verde-tint)',
  completado: 'var(--gris-medio)',
  proximo: 'var(--terracota)',
  en_curso: 'var(--terracota)',
  alerta: 'var(--terracota)',
  vencido: 'var(--terracota-dark)',
  pago_pendiente: 'var(--terracota-dark)',
};

export function estadoColor(estado: string): string {
  return ESTADO_COLOR[estado] ?? 'var(--gris-medio)';
}
