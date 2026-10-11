/**
 * Utilidades de formato de etiquetas y lenguaje amigable para el panel de administración.
 * Story 8.8 (AC #12).
 */

export function incomeSourceLabel(source?: string | null): string {
  if (!source) return '—';
  if (source === 'DIAN') return 'Facturador DIAN';
  if (source === 'MANUAL_SALES') return 'Ventas manuales';
  return source;
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
