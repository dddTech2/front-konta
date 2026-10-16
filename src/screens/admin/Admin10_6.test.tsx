import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../auth/session';
import { ADMIN_ACCOUNTING, ADMIN_CLIENT_DETAIL, ADMIN_PRICING_QUOTE } from '../../test/fixtures';
import { ME_ADMIN, mockApi, renderApp, resetSession } from '../../test/utils';

beforeEach(() => {
  resetSession();
  setToken('jwt-admin');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const pathOf = (p: string) => new URL(p, 'http://konta.test');

describe('Story 10.6: paquetes en el panel', () => {
  it('Tarifas muestra una tarjeta por paquete con Cambiar y Ver historial (AC #1)', async () => {
    mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });
    renderApp('/admin/tarifas');

    const section = (await screen.findByRole('heading', { name: 'Valor mensual por paquete' })).closest('section')
      ?? document.body;
    expect(within(section as HTMLElement).getAllByText('Con IVA').length).toBeGreaterThan(0);
    expect(within(section as HTMLElement).getAllByText('Sin IVA').length).toBeGreaterThan(0);
    expect(within(section as HTMLElement).getAllByRole('button', { name: 'Cambiar' })).toHaveLength(2);
    expect(within(section as HTMLElement).getAllByRole('button', { name: 'Ver historial' })).toHaveLength(2);
    expect(screen.queryByText('Persona natural')).not.toBeInTheDocument();
  });

  it('Nuevo cliente: con IVA el perfil queda fijo y se cotiza por paquete; sin IVA permite Mixto (AC #2)', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });
    renderApp('/admin/clientes/nuevo');

    const yes = await screen.findByRole('radio', { name: 'Sí' });
    await user.click(yes);
    expect(screen.getByDisplayValue('Factura electrónica')).toBeDisabled();
    expect(screen.getByText('Un declarante de IVA siempre factura electrónicamente')).toBeInTheDocument();
    await waitFor(() => {
      const quotes = api.calls.filter((c) => c.path.startsWith('/api/admin/pricing/quote'));
      expect(pathOf(quotes[quotes.length - 1].path).searchParams.get('package')).toBe('CON_IVA');
    });

    await user.click(screen.getByRole('radio', { name: 'No' }));
    const profile = screen.getByLabelText('Perfil');
    await user.selectOptions(profile, 'MIXED');
    expect(profile).toHaveValue('MIXED');
    await waitFor(() => {
      const quotes = api.calls.filter((c) => c.path.startsWith('/api/admin/pricing/quote'));
      expect(pathOf(quotes[quotes.length - 1].path).searchParams.get('package')).toBe('SIN_IVA');
    });
    expect(ADMIN_PRICING_QUOTE.package).toBeDefined();
  });

  it('Ficha: chips, aviso de paquete distinto y columnas del reparto en pagos (AC #3–#5)', async () => {
    const detail = {
      ...ADMIN_CLIENT_DETAIL,
      subscription: {
        ...ADMIN_CLIENT_DETAIL.subscription!,
        package: 'SIN_IVA',
        current_package: 'CON_IVA',
        current_rate_monthly: '349900.00',
      },
      recent_payments: ADMIN_CLIENT_DETAIL.recent_payments.map((p) => ({
        ...p,
        nyo_amount: '135000.00',
        visioncontable_amount: '135000.00',
      })),
    };
    mockApi({ 'GET /api/auth/me': { body: ME_ADMIN }, 'GET /api/admin/clients/biz-1': { body: detail } });
    renderApp('/admin/clientes/biz-1');

    await screen.findByRole('heading', { name: 'Panadería La Espiga' });
    expect(screen.getByRole('button', { name: 'Cambiar paquete o perfil' })).toBeInTheDocument();
    const alert = screen.getByText(/Cotizado como Sin IVA; hoy es Con IVA/);
    expect(alert.textContent).toContain('$349.900');
    expect(screen.getAllByRole('button', { name: 'Volver a la tarifa vigente' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Visión Contable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NYO').length).toBeGreaterThan(0);
  });

  it('Ficha: sin reparto en los pagos no muestra esas columnas (AC #5)', async () => {
    mockApi({ 'GET /api/auth/me': { body: ME_ADMIN }, 'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL } });
    renderApp('/admin/clientes/biz-1');

    await screen.findByRole('heading', { name: 'Panadería La Espiga' });
    expect(screen.queryByText('NYO')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cotizado como/)).not.toBeInTheDocument();
  });

  it('Lista de clientes: el filtro por paquete se envía a la API (AC #6)', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });
    renderApp('/admin/clientes');

    const filter = await screen.findByLabelText(/Paquete/);
    await user.selectOptions(filter, 'SIN_IVA');

    await waitFor(() => {
      const calls = api.calls.filter((c) => c.path.startsWith('/api/admin/clients?') || c.path === '/api/admin/clients');
      expect(pathOf(calls[calls.length - 1].path).searchParams.get('package')).toBe('SIN_IVA');
    });
  });
});

describe('Story 10.6: pantalla Contabilidad', () => {
  it('aparece en la navegación después de Tarifas', async () => {
    mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });
    renderApp('/admin');

    const links = (await screen.findAllByRole('link')).map((l) => l.textContent?.trim());
    const tarifas = links.indexOf('Tarifas');
    expect(tarifas).toBeGreaterThan(-1);
    expect(links[tarifas + 1]).toBe('Contabilidad');
  });

  it('muestra tarjetas, gráfica, reparto y pagos del periodo (AC #7–#10)', async () => {
    const api = mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });
    renderApp('/admin/contabilidad');

    await screen.findByRole('heading', { name: 'Contabilidad' });
    expect((await screen.findAllByText('Total cobrado')).length).toBeGreaterThan(0);
    expect(screen.getByText('Clientes activos')).toBeInTheDocument();
    expect(screen.getByText('Clientes nuevos')).toBeInTheDocument();
    expect(screen.getByText('Ingreso mensual recurrente')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Gráfica de barras apiladas de ingresos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reparto' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proyección mensual recurrente' })).toBeInTheDocument();

    const espiga = screen.getAllByRole('link', { name: 'Panadería La Espiga' })[0];
    expect(espiga).toHaveAttribute('href', expect.stringContaining('/admin/clientes/biz-1'));
    expect(screen.getAllByText('5 oct 2026').length).toBeGreaterThan(0);  // fecha sin corrimiento de zona

    const call = api.calls.find((c) => c.path.startsWith('/api/admin/accounting?'));
    expect(call).toBeDefined();
    expect(pathOf(call!.path).searchParams.get('year')).toMatch(/^\d{4}$/);
  });

  it('"Todo el año" consulta sin mes', async () => {
    const user = userEvent.setup();
    const api = mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });
    renderApp('/admin/contabilidad');

    const month = await screen.findByLabelText(/Mes/);
    await user.selectOptions(month, '');

    await waitFor(() => {
      const calls = api.calls.filter((c) => c.path.startsWith('/api/admin/accounting?'));
      expect(pathOf(calls[calls.length - 1].path).searchParams.has('month')).toBe(false);
    });
  });

  it('periodo sin pagos muestra el mensaje vacío', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/accounting': { body: { ...ADMIN_ACCOUNTING, payments: [] } },
    });
    renderApp('/admin/contabilidad');

    expect(await screen.findByText('No hay pagos registrados en este periodo.')).toBeInTheDocument();
  });

  it('editar porcentajes: ejemplo con la tarifa vigente, validación y PUT por paquete (AC #9)', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'PUT /api/admin/accounting/split/CON_IVA': { body: { package: 'CON_IVA', nyo_pct: '40.00', visioncontable_pct: '60.00', updated_at: null } },
      'PUT /api/admin/accounting/split/SIN_IVA': { body: { package: 'SIN_IVA', nyo_pct: '50.00', visioncontable_pct: '50.00', updated_at: null } },
    });
    renderApp('/admin/contabilidad');

    await user.click(await screen.findByRole('button', { name: 'Editar porcentajes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar porcentajes de reparto' });
    expect(within(dialog).getByText('Aplica a los pagos que se confirmen desde ahora.')).toBeInTheDocument();

    const [conIva] = within(dialog).getAllByLabelText('% NYO');
    await user.clear(conIva);
    await user.type(conIva, '33.333');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar porcentajes' }));
    expect(await within(dialog).findByText('Usa máximo 2 decimales.')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'PUT')).toBe(false);

    await user.clear(conIva);
    await user.type(conIva, '40');
    // Tarifa vigente Con IVA del fixture: $120.000 -> NYO 48.000, Visión Contable 72.000
    expect(within(dialog).getByText('De $120.000: Visión Contable $72.000 · NYO $48.000')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Guardar porcentajes' }));

    await waitFor(() => {
      const put = api.calls.find((c) => c.method === 'PUT' && c.path.endsWith('/CON_IVA'));
      expect(put?.body).toEqual({ nyo_pct: '40' });
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('error del servidor en el reparto se muestra junto al campo sin cerrar el formulario (AC #9)', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'PUT /api/admin/accounting/split/CON_IVA': {
        status: 422,
        body: { detail: 'El porcentaje debe estar entre 0 y 100.', code: 'INVALID_SPLIT' },
      },
      'PUT /api/admin/accounting/split/SIN_IVA': { body: { package: 'SIN_IVA', nyo_pct: '50.00', visioncontable_pct: '50.00', updated_at: null } },
    });
    renderApp('/admin/contabilidad');

    await user.click(await screen.findByRole('button', { name: 'Editar porcentajes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar porcentajes de reparto' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar porcentajes' }));

    expect(await within(dialog).findByText('El porcentaje debe estar entre 0 y 100.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Editar porcentajes de reparto' })).toBeInTheDocument();
  });
});
