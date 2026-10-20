import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomeSummaryResponse } from '../api/types';
import { setToken } from '../auth/session';
import { BUSINESS_ID, DASHBOARD, INCOME_SUMMARY } from '../test/fixtures';
import { ME_MIXED, ME_OK, mockApi, renderApp, resetSession, type Route } from '../test/utils';

vi.mock('../navigation', () => ({ navigateTo: vi.fn() }));

const INCOME_SUMMARY_PATH = `GET /api/income-summary/${BUSINESS_ID}`;
const DASHBOARD_PATH = `GET /api/dashboard/${BUSINESS_ID}`;

const MIXED_SUMMARY: IncomeSummaryResponse = {
  ...INCOME_SUMMARY,
  ingresos: null,
  egresos: '250000.00',
  utilidad: null,
  emitido: '800000.00',
  ventas: '200000.00',
  diferencia: '600000.00',
  emitido_count: 2,
  ventas_count: 1,
  clientes_count: 2,
  historial: INCOME_SUMMARY.historial.map((h) => ({ ...h, ingresos: null, utilidad: null, emitido: '700000.00', ventas: '300000.00' })),
};

beforeEach(() => {
  resetSession();
  setToken('jwt-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openAs(me: unknown, path: string, routes: Record<string, Route> = {}) {
  const api = mockApi({ 'GET /api/auth/me': { body: me }, ...routes });
  renderApp(path);
  return api;
}

describe('Story 10.5: perfil mixto', () => {
  it('inicia en Resumen con la navegación del perfil mixto y el botón de ventas', async () => {
    openAs(ME_MIXED, '/', { [INCOME_SUMMARY_PATH]: { body: MIXED_SUMMARY } });

    await screen.findByRole('region', { name: 'Resumen' });
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    const links = within(nav).getAllByRole('link').map((l) => l.textContent);
    expect(links).toEqual(['Resumen', 'Facturas', 'Calendario', 'Documentos']);
    expect(screen.getByRole('button', { name: /Registrar Venta/ })).toBeInTheDocument();
  });

  it('muestra facturado y ventas por separado, con diferencia y clientes facturados (Q-10b)', async () => {
    openAs(ME_MIXED, '/resumen', { [INCOME_SUMMARY_PATH]: { body: MIXED_SUMMARY } });

    const block = await screen.findByRole('region', { name: 'Facturado vs Ventas' });
    expect(within(block).getByText('Facturado electrónicamente')).toBeInTheDocument();
    expect(within(block).getByText('$800.000')).toBeInTheDocument();
    expect(within(block).getByText('2 facturas')).toBeInTheDocument();
    expect(within(block).getByText('$200.000')).toBeInTheDocument();
    expect(within(block).getByText('1 venta')).toBeInTheDocument();
    expect(within(block).getByText('Diferencia: $600.000')).toBeInTheDocument();
    expect(within(block).getByText('Facturaste $600.000 más de lo que registraste como ventas')).toBeInTheDocument();
    expect(within(block).getByText('Clientes facturados: 2')).toBeInTheDocument();
    expect(within(block).queryByText(/%/)).not.toBeInTheDocument();
    // No se suman: sin ingresos totales ni utilidad; los egresos se muestran solos
    expect(screen.queryByText(/Ingresos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Utilidad/)).not.toBeInTheDocument();
    expect(screen.getByText('Egresos')).toBeInTheDocument();
    expect(screen.getByText('$250.000')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'Historial de facturación y ventas' });
    expect(within(history).getAllByRole('listitem')[0]).toHaveAccessibleName(
      expect.stringMatching(/facturado \$700\.000, ventas \$300\.000/),
    );
  });

  it('cuando las ventas superan lo facturado, la frase lo dice al revés', async () => {
    openAs(ME_MIXED, '/resumen', {
      [INCOME_SUMMARY_PATH]: {
        body: { ...MIXED_SUMMARY, emitido: '100000.00', ventas: '400000.00', diferencia: '-300000.00' },
      },
    });

    expect(await screen.findByText('Registraste $300.000 más en ventas que en facturas')).toBeInTheDocument();
  });

  it('ventas manuales no muestra el bloque del perfil mixto', async () => {
    openAs({ ...ME_OK, income_source: 'MANUAL_SALES' }, '/resumen');

    expect(await screen.findByText('Ingresos')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Facturado vs Ventas' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ingresos totales')).not.toBeInTheDocument();
  });
});

describe('Story 10.5: IVA según el paquete', () => {
  it('facturador sin IVA: sin pestaña IVA ni IVA acumulado en el inicio', async () => {
    openAs({ ...ME_OK, vat_responsible: false, package: 'SIN_IVA' }, '/inicio', {
      [DASHBOARD_PATH]: { body: { ...DASHBOARD, shows_iva: false } },
    });

    await screen.findByText('Facturas emitidas');
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(nav).queryByRole('link', { name: 'IVA' })).not.toBeInTheDocument();
    expect(screen.queryByText('IVA acumulado')).not.toBeInTheDocument();
  });

  it('facturador con IVA conserva la pestaña IVA', async () => {
    openAs({ ...ME_OK, vat_responsible: true, package: 'CON_IVA' }, '/inicio');

    await screen.findByText('IVA acumulado');
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('link', { name: 'IVA' })).toBeInTheDocument();
  });
});

describe('Story 10.5: marca Konta', () => {
  it('el login muestra el lema', async () => {
    resetSession();
    mockApi({});
    renderApp('/login');

    expect(await screen.findByText('Contabilidad con K, para emprendedores')).toBeInTheDocument();
  });
});
