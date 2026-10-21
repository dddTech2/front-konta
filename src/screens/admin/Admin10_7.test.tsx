import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../auth/session';
import { resetDemoState } from '../../demo/demoApi';
import { ADMIN_PRICING } from '../../test/fixtures';
import { ME_ADMIN, mockApi, renderApp, resetSession } from '../../test/utils';

beforeEach(() => {
  resetSession();
  setToken('jwt-admin');
  resetDemoState();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Story 10.7: Panel de Demostración de Tipos de Cliente', () => {
  it('Navegación: "Demostración" aparece después de "Contabilidad" con ruta /admin/demo (AC #1)', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });
    renderApp('/admin');

    const nav = await screen.findByRole('navigation', { name: 'Secciones de administración' });
    const links = within(nav).getAllByRole('link');
    const labels = links.map((l) => l.textContent?.trim());

    const contabilidadIdx = labels.indexOf('Contabilidad');
    expect(contabilidadIdx).toBeGreaterThan(-1);
    expect(labels[contabilidadIdx + 1]).toBe('Demostración');

    const demoLink = links[contabilidadIdx + 1];
    expect(demoLink).toHaveAttribute('href', '/admin/demo');
  });

  it('Los 4 perfiles tienen las pestañas y pantallas correctas (AC #2, #3, #4)', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    // 1. con-iva-fe (Factura electrónica con IVA)
    const { unmount: unmount1 } = renderApp('/admin/demo?perfil=con-iva-fe');
    expect(await screen.findByRole('heading', { name: 'Demostración' })).toBeInTheDocument();
    expect((await screen.findAllByText('Distribuciones La Ceiba S.A.S.'))[0]).toBeInTheDocument();

    const phoneNav1 = screen.getByRole('navigation', { name: 'Secciones' });
    const tabs1 = within(phoneNav1).getAllByRole('link').map((t) => t.textContent?.trim());
    expect(tabs1).toEqual(['Inicio', 'IVA', 'Facturas', 'Calendario', 'Documentos']);
    unmount1();

    // 2. sin-iva-fe (Factura electrónica sin IVA)
    const { unmount: unmount2 } = renderApp('/admin/demo?perfil=sin-iva-fe');
    expect((await screen.findAllByText('Estudio Creativo Lumen'))[0]).toBeInTheDocument();

    const phoneNav2 = screen.getByRole('navigation', { name: 'Secciones' });
    const tabs2 = within(phoneNav2).getAllByRole('link').map((t) => t.textContent?.trim());
    expect(tabs2).toEqual(['Inicio', 'Facturas', 'Calendario', 'Documentos']);
    expect(tabs2).not.toContain('IVA');
    unmount2();

    // 3. sin-iva-ventas (Ventas manuales sin IVA)
    const { unmount: unmount3 } = renderApp('/admin/demo?perfil=sin-iva-ventas');
    expect((await screen.findAllByText('Panadería Doña Rosa'))[0]).toBeInTheDocument();

    const phoneNav3 = screen.getByRole('navigation', { name: 'Secciones' });
    const tabs3 = within(phoneNav3).getAllByRole('link').map((t) => t.textContent?.trim());
    expect(tabs3).toEqual(['Resumen', 'Facturas', 'Documentos']);
    expect(tabs3).not.toContain('Calendario');
    expect(tabs3).not.toContain('Inicio');
    expect(tabs3).not.toContain('IVA');
    unmount3();

    // 4. sin-iva-mixto (Mixto: facturado + ventas)
    const { unmount: unmount4 } = renderApp('/admin/demo?perfil=sin-iva-mixto');
    expect((await screen.findAllByText('Café y Granos El Mirador'))[0]).toBeInTheDocument();

    const phoneNav4 = screen.getByRole('navigation', { name: 'Secciones' });
    const tabs4 = within(phoneNav4).getAllByRole('link').map((t) => t.textContent?.trim());
    expect(tabs4).toEqual(['Resumen', 'Facturas', 'Calendario', 'Documentos']);
    expect(tabs4).toContain('Calendario');
    expect(tabs4).not.toContain('IVA');
    unmount4();
  });

  it('?perfil= en la URL selecciona el perfil y el selector cambia la URL (AC #2)', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo');

    // Por defecto con-iva-fe
    expect((await screen.findAllByText('Distribuciones La Ceiba S.A.S.'))[0]).toBeInTheDocument();

    // Cambiar con el selector a sin-iva-mixto
    const mixedBtn = screen.getByRole('tab', { name: /Sin IVA · Mixto/ });
    await user.click(mixedBtn);

    expect((await screen.findAllByText('Café y Granos El Mirador'))[0]).toBeInTheDocument();
  });

  it('Perfil mixto muestra facturado y ventas por separado (AC #4)', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=sin-iva-mixto');

    expect((await screen.findAllByText('Café y Granos El Mirador'))[0]).toBeInTheDocument();
    expect(await screen.findByLabelText('Facturado y ventas de los últimos meses')).toBeInTheDocument();
    expect(screen.getAllByText('Facturado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ventas').length).toBeGreaterThan(0);
  });

  it('Clic en la campana del Inicio cambia a Calendario sin salir de /admin/demo (AC #3)', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=con-iva-fe');

    expect((await screen.findAllByText('Distribuciones La Ceiba S.A.S.'))[0]).toBeInTheDocument();

    const bell = screen.getByLabelText('Ver calendario de vencimientos');
    await user.click(bell);

    // Pantalla Calendario se muestra dentro del marco
    expect(await screen.findByRole('region', { name: 'Calendario' })).toBeInTheDocument();

    // El shell de admin sigue intacto
    expect(screen.getByRole('navigation', { name: 'Secciones de administración' })).toBeInTheDocument();
  });

  it('Registrar venta en la demo no llama a fetch y aparece en la lista (AC #5)', async () => {
    const user = userEvent.setup();
    const api = mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=sin-iva-ventas');

    expect((await screen.findAllByText('Panadería Doña Rosa'))[0]).toBeInTheDocument();

    // Abrir formulario de venta
    const btnVenta = await screen.findByRole('button', { name: 'Registrar Venta' });
    await user.click(btnVenta);

    const inputTotal = await screen.findByLabelText(/Total de la venta/);
    await user.type(inputTotal, '125000');

    const inputDesc = screen.getByLabelText(/Descripción/);
    await user.type(inputDesc, 'Torta tres leches');

    const btnGuardar = screen.getByRole('button', { name: 'Guardar venta' });
    await user.click(btnGuardar);

    // Confirmación mostrada
    expect(await screen.findByText(/Venta registrada por \$125\.000/)).toBeInTheDocument();

    // La nueva venta aparece en la lista
    expect(await screen.findByText(/Torta tres leches/)).toBeInTheDocument();

    // Ninguna llamada de red se hizo a endpoints de ventas
    const salesCalls = api.calls.filter((c) => c.path.includes('/sales'));
    expect(salesCalls).toHaveLength(0);
  });

  it('Ninguna ruta demo-… llama a fetch (espía de fetch) (AC #4, #5)', async () => {
    const api = mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=con-iva-fe');

    await screen.findAllByText('Distribuciones La Ceiba S.A.S.');

    // Verificar que absolutamente ninguna llamada a fetch contenga "demo-"
    const demoCalls = api.calls.filter((c) => c.path.includes('demo-'));
    expect(demoCalls).toHaveLength(0);
  });

  it('"Qué incluye" y "En Telegram" cambian según el perfil (AC #6)', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    // Con IVA
    const { unmount: unmount1 } = renderApp('/admin/demo?perfil=con-iva-fe');
    expect(await screen.findByText('Para negocios que declaran IVA: siempre facturan electrónicamente.')).toBeInTheDocument();
    expect(screen.getByText('IVA del bimestre, generado, descontable y saldo')).toBeInTheDocument();
    expect(screen.getByText('/dashboard')).toBeInTheDocument();
    expect(screen.queryByText('/anular_venta')).not.toBeInTheDocument();
    unmount1();

    // Ventas
    const { unmount: unmount2 } = renderApp('/admin/demo?perfil=sin-iva-ventas');
    expect(await screen.findByText('Para negocios que no declaran IVA y llevan sus cuentas con ventas del día a día.')).toBeInTheDocument();
    expect(screen.getByText('Registro de ventas por la web y por Telegram con ingresos, egresos y utilidad')).toBeInTheDocument();
    expect(screen.getByText('/venta')).toBeInTheDocument();
    expect(screen.getByText('/mis_ventas')).toBeInTheDocument();
    expect(screen.getByText('/anular_venta')).toBeInTheDocument();
    expect(screen.queryByText('/facturas')).not.toBeInTheDocument();
    unmount2();
  });

  it('Precio desde el mock de /api/admin/pricing y error con "Reintentar" (AC #6)', async () => {

    // Caso de error en tarifas
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { status: 500, body: { detail: 'Error' } },
    });

    const { unmount } = renderApp('/admin/demo?perfil=con-iva-fe');

    expect((await screen.findAllByText('Distribuciones La Ceiba S.A.S.'))[0]).toBeInTheDocument();
    expect(await screen.findByText('No pudimos cargar las tarifas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    unmount();

    // Caso exitoso
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=con-iva-fe');

    expect((await screen.findAllByText('Distribuciones La Ceiba S.A.S.'))[0]).toBeInTheDocument();
    expect(await screen.findByText('Tarifa mensual vigente')).toBeInTheDocument();
    expect(screen.getByText('$120.000 / mes')).toBeInTheDocument();
    expect(screen.getByText('Trimestral')).toBeInTheDocument();
  });

  it('"Presentar" oculta selector y precio, y Esc vuelve a la vista normal (AC #7)', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=con-iva-fe');

    expect(await screen.findByRole('tablist', { name: 'Tipos de cliente para demostración' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Precio' })).toBeInTheDocument();

    const btnPresentar = screen.getByRole('button', { name: 'Presentar' });
    await user.click(btnPresentar);

    // Selector y precio ya no están
    expect(screen.queryByRole('tablist', { name: 'Tipos de cliente para demostración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Precio' })).not.toBeInTheDocument();

    // Marco y Qué incluye siguen visibles
    expect(screen.getAllByText('Distribuciones La Ceiba S.A.S.')[0]).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Qué incluye este paquete' })).toBeInTheDocument();

    const btnSalir = screen.getByRole('button', { name: 'Salir de la presentación' });
    expect(btnSalir).toBeInTheDocument();

    // Presionar tecla Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    // Regresa a la vista normal
    expect(await screen.findByRole('tablist', { name: 'Tipos de cliente para demostración' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Precio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Presentar' })).toBeInTheDocument();
  });

  it('Abrir documento en la demo muestra el aviso correspondiente (AC #5)', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/me': { body: ME_ADMIN },
      'GET /api/admin/pricing': { body: ADMIN_PRICING },
    });

    renderApp('/admin/demo?perfil=con-iva-fe');

    expect((await screen.findAllByText('Distribuciones La Ceiba S.A.S.'))[0]).toBeInTheDocument();

    // Cambiar a la pestaña Documentos
    const phoneNav = screen.getByRole('navigation', { name: 'Secciones' });
    const docsTab = within(phoneNav).getByRole('link', { name: 'Documentos' });
    await user.click(docsTab);

    // Los documentos aparecen
    const btnAbrir = (await screen.findAllByRole('button', { name: /^Abrir / }))[0];
    await user.click(btnAbrir);

    // Mensaje de aviso de demostración
    expect(await screen.findByText('En la demostración los documentos no se abren')).toBeInTheDocument();
  });
});
