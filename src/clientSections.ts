import { hasManualSales, isMixed, showsIva, type Me } from './api/client';

export interface ClientSection {
  path: string;
  label: string;
}

export const DIAN_SECTIONS: ClientSection[] = [
  { path: '/inicio', label: 'Inicio' },
  { path: '/iva', label: 'IVA' },
  { path: '/historial', label: 'Facturas' },
  { path: '/calendario', label: 'Calendario' },
  { path: '/documentos', label: 'Documentos' },
];

export const MANUAL_SECTIONS: ClientSection[] = [
  { path: '/resumen', label: 'Resumen' },
  { path: '/historial', label: 'Facturas' },
  { path: '/documentos', label: 'Documentos' },
];

export const MIXED_SECTIONS: ClientSection[] = [
  { path: '/resumen', label: 'Resumen' },
  { path: '/historial', label: 'Facturas' },
  { path: '/calendario', label: 'Calendario' },
  { path: '/documentos', label: 'Documentos' },
];

/**
 * Devuelve las secciones de navegación del cliente según su configuración (Story 10.7, AC #3, #8).
 * Lógica compartida entre el Shell del cliente (App.tsx) y el marco de demostración (AdminDemo.tsx).
 */
export function clientSections(me: Me | null | undefined): ClientSection[] {
  const mixed = isMixed(me);
  const manual = !mixed && hasManualSales(me);
  const showIvaTab = showsIva(me);

  if (mixed) {
    return MIXED_SECTIONS;
  }
  if (manual) {
    return MANUAL_SECTIONS;
  }
  return DIAN_SECTIONS.filter((s) => s.path !== '/iva' || showIvaTab);
}
