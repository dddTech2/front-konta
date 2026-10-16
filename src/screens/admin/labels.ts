/**
 * Utilidades de formato de etiquetas y lenguaje amigable para el panel de administración.
 * Story 8.8 (AC #12).
 */

export function packageLabel(pkg?: string | null): string {
  if (!pkg) return '—';
  if (pkg === 'CON_IVA') return 'Con IVA';
  if (pkg === 'SIN_IVA') return 'Sin IVA';
  return pkg;
}

export function incomeSourceLabel(source?: string | null): string {
  if (!source) return '—';
  if (source === 'DIAN' || source === 'FACTURADOR') return 'Factura electrónica';
  if (source === 'MANUAL_SALES' || source === 'VENTAS_MANUALES') return 'Ventas';
  if (source === 'MIXED' || source === 'MIXTO') return 'Mixto (factura + ventas)';
  return source;
}

/** El alta sin correo genera uno interno (`...@cliente.kontable.co`) solo para la base; no es del cliente. */
export function isPlaceholderEmail(email?: string | null): boolean {
  return !email || email.toLowerCase().endsWith('@cliente.kontable.co');
}

export const PARTNER_VISION_CONTABLE = 'Visión Contable (Konta)';
export const PARTNER_NYO = 'NYO';

export function partnerLabel(partner?: string | null): string {
  if (!partner) return '—';
  if (partner === 'VISION_CONTABLE' || partner === 'Konta') return PARTNER_VISION_CONTABLE;
  if (partner === 'NYO') return PARTNER_NYO;
  return partner;
}

export function planLabel(
  code?: string | null,
  plans?: Array<{ code: string; name: string }>,
): string {
  if (!code) return '—';
  if (plans && plans.length > 0) {
    const found = plans.find((p) => p.code === code);
    if (found && found.name) return found.name;
  }

  // Si no se encuentra en la lista de planes, formatea el código a formato título
  // e.g. "TRIMESTRAL" -> "Trimestral", "SEMESTRAL_PLUS" -> "Semestral Plus"
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—';
  if (method === 'TRANSFERENCIA') return 'Transferencia';
  if (method === 'EFECTIVO') return 'Efectivo';
  if (method === 'TARJETA') return 'Tarjeta';
  return method
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function timeAgo(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return 'sin señal';
  }
  if (minutes < 1) {
    return 'hace un momento';
  }
  if (minutes < 60) {
    return `hace ${Math.floor(minutes)} min`;
  }
  if (minutes < 1440) {
    return `hace ${Math.floor(minutes / 60)} h`;
  }
  const days = Math.floor(minutes / 1440);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
