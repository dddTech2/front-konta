import { describe, expect, it } from 'vitest';
import type { Me } from './api/client';
import { clientSections, DIAN_SECTIONS, MANUAL_SECTIONS, MIXED_SECTIONS } from './clientSections';
import { ME_MANUAL, ME_MIXED, ME_OK } from './test/utils';

describe('clientSections (Story 10.7 AC #3, #8)', () => {
  it('DIAN con responsabilidad de IVA devuelve las 5 pestañas completas', () => {
    const me: Me = {
      ...ME_OK,
      income_source: 'DIAN',
      vat_responsible: true,
    };

    const sections = clientSections(me);
    expect(sections).toEqual(DIAN_SECTIONS);
    expect(sections.map((s) => s.path)).toEqual([
      '/inicio',
      '/iva',
      '/historial',
      '/calendario',
      '/documentos',
    ]);
    expect(sections.map((s) => s.label)).toEqual([
      'Inicio',
      'IVA',
      'Facturas',
      'Calendario',
      'Documentos',
    ]);
  });

  it('DIAN sin IVA (no responsable) excluye la pestaña de IVA', () => {
    const me: Me = {
      ...ME_OK,
      income_source: 'DIAN',
      vat_responsible: false,
    };

    const sections = clientSections(me);
    expect(sections.map((s) => s.path)).toEqual([
      '/inicio',
      '/historial',
      '/calendario',
      '/documentos',
    ]);
    expect(sections.some((s) => s.path === '/iva')).toBe(false);
  });

  it('Ventas manuales (MANUAL_SALES) devuelve Resumen, Facturas y Documentos (sin Calendario ni IVA)', () => {
    const sections = clientSections(ME_MANUAL);
    expect(sections).toEqual(MANUAL_SECTIONS);
    expect(sections.map((s) => s.path)).toEqual([
      '/resumen',
      '/historial',
      '/documentos',
    ]);
  });

  it('Perfil mixto (MIXED) devuelve Resumen, Facturas, Calendario y Documentos (sin IVA)', () => {
    const sections = clientSections(ME_MIXED);
    expect(sections).toEqual(MIXED_SECTIONS);
    expect(sections.map((s) => s.path)).toEqual([
      '/resumen',
      '/historial',
      '/calendario',
      '/documentos',
    ]);
    expect(sections.some((s) => s.path === '/calendario')).toBe(true);
    expect(sections.some((s) => s.path === '/iva')).toBe(false);
  });

  it('usuario nulo, indefinido o API anterior sin datos se comporta como DIAN con IVA por compatibilidad', () => {
    const defaultSections = clientSections(null);
    expect(defaultSections).toEqual(DIAN_SECTIONS);

    const undefinedSections = clientSections(undefined);
    expect(undefinedSections).toEqual(DIAN_SECTIONS);
  });
});
