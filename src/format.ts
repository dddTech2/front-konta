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

/**
 * Formato compacto para barras y gráficas: `$0`, `$850`, `$85 mil`, `$850 mil`, `$1,3 M`, `$12,5 M`, `$10 M`, `$1.500 M`.
 * Negativos con signo antes del `$`, separadores es-CO, máximo una decimal en millones, ninguna en miles.
 * Redondeo de borde: `999600` -> `$1 M` (nunca `$1.000 mil`), no finitos -> `$0`.
 */
export function fmtMoneyCompact(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);

  const thousands = Math.round(abs / 1_000);
  if (thousands >= 1_000) {
    const millions = Math.round(abs / 100_000) / 10;
    const body = millions.toLocaleString('es-CO', { maximumFractionDigits: 1 });
    const sign = value < 0 ? '-' : '';
    return `${sign}$${body} M`;
  }

  if (Math.round(abs) >= 1_000) {
    const body = thousands.toLocaleString('es-CO');
    const sign = value < 0 ? '-' : '';
    return `${sign}$${body} mil`;
  }

  const units = Math.round(abs);
  if (units === 0) return '$0';
  const body = units.toLocaleString('es-CO');
  const sign = value < 0 ? '-' : '';
  return `${sign}$${body}`;
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

const DEADLINE_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-09-14` -> `14 sep 2026`. Si el texto no tiene formato YYYY-MM-DD lo devuelve tal cual. */
export function fmtDeadline(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const monthIdx = Number(match[2]) - 1;
  const month = DEADLINE_MONTHS[monthIdx];
  if (!month) return iso;
  const day = Number(match[3]);
  return `${day} ${month} ${match[1]}`;
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

/** Nombre legible para cada tipo de impuesto. */
export function taxLabel(taxType: string | null): string {
  if (taxType === null) return '';
  switch (taxType) {
    case 'IVA_BIMESTRAL':
    case 'IVA_CUATRIMESTRAL':
      return 'Declaración de IVA';
    case 'RETEFUENTE':
      return 'Retención en la fuente';
    case 'RENTA_PERSONAS_NATURALES':
    case 'RENTA_PERSONAS_JURIDICAS':
      return 'Declaración de renta';
    default:
      return taxType;
  }
}

/**
 * Tamaño legible de archivo: `0 B`, `999 B`, `230 KB`, `1,2 MB`.
 * Usa es-CO (coma decimal) y máximo una decimal en MB/GB si la tiene.
 */
export function fmtFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const rounded = Math.round(bytes);
  if (rounded < 1024) return `${rounded} B`;

  const kb = bytes / 1024;
  if (Math.round(kb) < 1024) {
    return `${Math.round(kb).toLocaleString('es-CO')} KB`;
  }

  const mb = bytes / (1024 * 1024);
  const roundedMb = Math.round(mb * 10) / 10;
  if (roundedMb < 1024) {
    return `${roundedMb.toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  const roundedGb = Math.round(gb * 10) / 10;
  return `${roundedGb.toLocaleString('es-CO', { maximumFractionDigits: 1 })} GB`;
}

/**
 * Convierte una fecha ISO (asumiendo UTC si no trae zona horaria) a fecha AAAA-MM-DD en America/Bogota.
 */
export function toBogotaIsoDate(utcIso: string): string {
  if (!utcIso) return '';
  const normalized = /Z$|[+-]\d{2}(?::?\d{2})?$/.test(utcIso) ? utcIso : `${utcIso}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return utcIso;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) return utcIso;
  return `${y}-${m}-${d}`;
}

/**
 * Fecha corta en hora de Bogotá (America/Bogota) a partir de una fecha UTC (ej. '2026-10-06T21:57:00' -> '6 oct 2026').
 */
export function fmtBogotaDate(utcIso: string): string {
  return fmtDeadline(toBogotaIsoDate(utcIso));
}

