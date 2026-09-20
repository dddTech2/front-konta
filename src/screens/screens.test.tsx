import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken } from '../auth/session';
import { recentMonths } from '../format';
import {
  BUSINESS_ID,
  DASHBOARD,
  INVOICES,
  IVA,
  invoice,
  invoicesPage,
  ivaPeriod,
} from '../test/fixtures';
import { ME_OK, mockApi, renderApp, resetSession, type MockReply, type Route } from '../test/utils';
import { deriveObligations } from './Calendario';

const DASHBOARD_PATH = `GET /api/dashboard/${BUSINESS_ID}`;
const IVA_PATH = `GET /api/iva/${BUSINESS_ID}`;
const INVOICES_PATH = `GET /api/invoices/${BUSINESS_ID}`;

beforeEach(() => {
  resetSession();
  setToken('jwt-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open(path: string, routes: Record<string, Route> = {}) {
  const api = mockApi({ 'GET /api/auth/me': { body: ME_OK }, ...routes });
  renderApp(path);
  return api;
}

const paramsOf = (path: string) => new URL(path, 'http://kontable.test').searchParams;
const invoiceCalls = (api: ReturnType<typeof mockApi>) => api.calls.filter((c) => c.path.startsWith('/api/invoices/'));
const lastInvoiceCall = (api: ReturnType<typeof mockApi>) => {
  const calls = invoiceCalls(api);
  return calls[calls.length - 1];
};

describe('Dashboard', () => {
  it('muestra el payload real: Hero con negocio, NIT, total y variación (no el demo del prototipo)', async () => {
    const api = open('/inicio');

    const hero = await screen.findByRole('region', { name: 'Resumen del mes' });

    expect(within(hero).getByText('Panadería La Espiga')).toBeInTheDocument();
    expect(within(hero).getByText('NIT 900.123.456-7')).toBeInTheDocument();
    expect(within(hero).getByText('$7.300.000')).toBeInTheDocument();
    expect(hero).toHaveTextContent('Total facturado · Agosto 2026');
    expect(hero).toHaveTextContent('8% vs. mes anterior');
    expect(screen.queryByText('Andrea Torres Diseño')).not.toBeInTheDocument();
    expect(screen.getByText('$1.387.000')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();

    const call = api.calls.find((c) => c.path === `/api/dashboard/${BUSINESS_ID}`);
    expect(call?.headers.Authorization).toBe('Bearer jwt-1');
  });

  it('variación negativa: flecha hacia abajo y valor absoluto', async () => {
    open('/inicio', {
      [DASHBOARD_PATH]: { body: { ...DASHBOARD, resumen: { ...DASHBOARD.resumen, variacion: -4 } } },
    });

    const hero = await screen.findByRole('region', { name: 'Resumen del mes' });

    const variation = within(hero).getByText('4% vs. mes anterior');
    expect(variation).toHaveClass('hero-var-down');
  });

  it('histórico de 6 meses con el último resaltado y solo 4 facturas recientes', async () => {
    open('/inicio');

    const bars = await screen.findByRole('list', { name: 'Facturación de los últimos meses' });
    const items = within(bars).getAllByRole('listitem');

    expect(items).toHaveLength(6);
    expect(items[5]).toHaveAccessibleName('Ago: $7.300.000');
    expect(items[5].querySelector('.bar')).toHaveClass('bar-current');
    expect(items[0].querySelector('.bar')).not.toHaveClass('bar-current');
    expect((items[5].querySelector('.bar') as HTMLElement).style.height).toBe('100%');
    expect(parseFloat((items[0].querySelector('.bar') as HTMLElement).style.height)).toBeCloseTo(
      (4000000 / 7300000) * 100,
      1,
    );
    expect(screen.getByText('Hotel Sol')).toBeInTheDocument();
    expect(screen.getByText('FE-501 · 22 ago')).toBeInTheDocument();
    expect(screen.getByText('Tienda Norte')).toBeInTheDocument();
    expect(screen.queryByText('Cliente quinto')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/historial');
  });

  it('alerta de próximo vencimiento enlaza al IVA y la campana al calendario', async () => {
    open('/inicio');

    const link = await screen.findByRole('link', { name: /Declaración de IVA vence en 5 días/ });

    expect(link).toHaveAttribute('href', '/iva');
    expect(link).toHaveTextContent('Periodo 2026-08 · límite 10 sept 2026');
    expect(screen.getByRole('link', { name: 'Ver calendario de vencimientos' })).toHaveAttribute('href', '/calendario');
  });

  it('periodo de gracia: banner con los días que restan', async () => {
    open('/inicio', {
      [DASHBOARD_PATH]: {
        body: {
          ...DASHBOARD,
          suscripcion: { ...DASHBOARD.suscripcion, has_warning_banner: true, days_left_in_grace: 2 },
        },
      },
    });

    expect(await screen.findByText(/Restan 2 días antes del bloqueo/)).toBeInTheDocument();
    expect(screen.getByText('Periodo de Gracia Activo:')).toBeInTheDocument();
  });

  it.each([
    [1, /Restan 1 día antes del bloqueo/],
    [0, /Hoy es el último día antes del bloqueo/],
    [null, /Regulariza tu pago para evitar el bloqueo/],
  ])('periodo de gracia con days_left_in_grace=%s: texto correcto', async (left, text) => {
    open('/inicio', {
      [DASHBOARD_PATH]: {
        body: {
          ...DASHBOARD,
          suscripcion: { ...DASHBOARD.suscripcion, has_warning_banner: true, days_left_in_grace: left },
        },
      },
    });

    expect(await screen.findByText(text)).toBeInTheDocument();
    if (left !== 1) expect(screen.queryByText(/Restan 1 día/)).not.toBeInTheDocument();
  });

  it('vencimiento próximo: la campana lleva el punto de atención', async () => {
    open('/inicio');
    await screen.findByRole('region', { name: 'Resumen del mes' });
    expect(document.querySelector('.hero-bell-dot')).not.toBeNull();
  });

  it('vencimiento al día y sin fecha: sin punto en la campana y título sin días', async () => {
    open('/inicio', {
      [DASHBOARD_PATH]: {
        body: {
          ...DASHBOARD,
          alertaProximoVencimiento: { dias: null, etiqueta: 'periodo 2026-08', limite: '10 sept 2026', estado: 'aldia' },
        },
      },
    });

    const link = await screen.findByRole('link', { name: /Declaración de IVA/ });

    expect(link).toHaveTextContent('Declaración de IVA');
    expect(link).not.toHaveTextContent(/vence/);
    expect(document.querySelector('.hero-bell-dot')).toBeNull();
  });

  it('sin facturas recientes ni histórico: muestra mensajes vacíos y no rompe', async () => {
    open('/inicio', {
      [DASHBOARD_PATH]: { body: { ...DASHBOARD, historico: [], facturasRecientes: [] } },
    });

    expect(await screen.findByText('Aún no hay facturas emitidas.')).toBeInTheDocument();
    expect(screen.queryByText(/Periodo de Gracia/)).not.toBeInTheDocument();
  });

  it('usa el business_id de /me en la ruta', async () => {
    const api = open('/inicio', {
      'GET /api/auth/me': { body: { ...ME_OK, business_id: 'biz-9' } },
      'GET /api/dashboard/biz-9': { body: { ...DASHBOARD, business: { ...DASHBOARD.business, commercial_name: 'Otro' } } },
    });

    expect(await screen.findByText('Otro')).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === '/api/dashboard/biz-9')).toBe(true);
  });
});

describe('IVA', () => {
  it('Ring con el pct de la API (sin recalcular), saldo a pagar, desglose y facturas del periodo', async () => {
    open('/iva', { [IVA_PATH]: { body: { ...IVA, periodos: [ivaPeriod({ pct: 0.5 })] } } });

    await screen.findByRole('region', { name: 'Periodo de IVA' });

    const offset = Number(screen.getByTestId('ring-progress').getAttribute('stroke-dashoffset'));
    expect(offset).toBeCloseTo(2 * Math.PI * 42 * 0.5, 3);
    expect(screen.getByRole('img', { name: /50 % del generado/ })).toBeInTheDocument();
    expect(screen.getByText('Saldo a pagar')).toBeInTheDocument();
    expect(screen.getByText('$1.825.500')).toBeInTheDocument();
    expect(screen.getByText('Vence en 5 días · 10 sept 2026')).toBeInTheDocument();
    expect(screen.getByText('$2.365.500')).toBeInTheDocument();
    expect(screen.getByText('$540.000')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Hotel Sol')).toBeInTheDocument();
    expect(screen.getByText('22 ago · Emitido')).toBeInTheDocument();
    expect(screen.getByText('Proveedor Harina')).toBeInTheDocument();
  });

  it('navega entre periodos: saldo a favor y presentado en el anterior; límites deshabilitados', async () => {
    const user = userEvent.setup();
    open('/iva');
    await screen.findByRole('region', { name: 'Periodo de IVA' });
    expect(screen.getByRole('button', { name: 'Periodo siguiente' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Periodo anterior' }));

    expect(screen.getByText('May – Jun 2026')).toBeInTheDocument();
    expect(screen.getByText('Saldo a favor')).toBeInTheDocument();
    expect(screen.getByText('$50.000')).toBeInTheDocument();
    expect(screen.getByText('Presentado')).toBeInTheDocument();
    expect(screen.getByText('Presentado · límite era 10 jul 2026')).toBeInTheDocument();
    expect(screen.getByText('Taller Norte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Periodo anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Periodo siguiente' }));
    expect(screen.getByText('Jul – Ago 2026')).toBeInTheDocument();
  });

  it('pct fuera de rango o inválido no rompe el anillo', async () => {
    open('/iva', { [IVA_PATH]: { body: { ...IVA, periodos: [ivaPeriod({ pct: 3 })] } } });

    await screen.findByRole('region', { name: 'Periodo de IVA' });

    expect(Number(screen.getByTestId('ring-progress').getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
  });

  it.each([[-0.5], [null]])('pct=%s: anillo vacío y etiqueta coherente', async (pct) => {
    open('/iva', { [IVA_PATH]: { body: { ...IVA, periodos: [ivaPeriod({ pct: pct as number })] } } });

    await screen.findByRole('region', { name: 'Periodo de IVA' });

    expect(Number(screen.getByTestId('ring-progress').getAttribute('stroke-dashoffset'))).toBeCloseTo(
      2 * Math.PI * 42,
      3,
    );
    expect(screen.getByRole('img', { name: /0 % del generado/ })).toBeInTheDocument();
  });

  it('el texto de vencimiento sigue a `estado`, no solo a `dias`', async () => {
    const user = userEvent.setup();
    open('/iva', {
      [IVA_PATH]: {
        body: {
          ...IVA,
          periodos: [
            ivaPeriod({ estado: 'en_curso', dias: null, limite: '10 sept 2026' }),
            ivaPeriod({ period_key: 'p', estado: 'presentado', dias: 3, limite: '10 jul 2026' }),
          ],
        },
      },
    });
    expect(await screen.findByText('Límite 10 sept 2026')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Periodo anterior' }));

    expect(screen.getByText('Presentado · límite era 10 jul 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Vence en/)).not.toBeInTheDocument();
  });

  it('periodo sin facturas y sin periodos: mensajes vacíos', async () => {
    open('/iva', { [IVA_PATH]: { body: { ...IVA, periodos: [ivaPeriod({ facturas: [] })] } } });
    expect(await screen.findByText('No hay facturas en este periodo.')).toBeInTheDocument();
  });

  it('sin periodos: aviso en vez de una pantalla en blanco', async () => {
    open('/iva', { [IVA_PATH]: { body: { ...IVA, periodos: [] } } });
    expect(await screen.findByText('Aún no hay periodos de IVA para tu negocio.')).toBeInTheDocument();
  });
});

describe('Historial', () => {
  /** Responde según los parámetros: emite solo lo que el servidor filtraría. */
  function invoicesRoute(all = [invoice(1), invoice(2, { group_type: 'Recibido' }), invoice(3)]): Route {
    return (_init, path) => {
      const params = paramsOf(path);
      let list = all;
      const group = params.get('group_type');
      if (group) list = list.filter((i) => i.group_type === group);
      const search = params.get('search');
      if (search) list = list.filter((i) => i.cliente.toLowerCase().includes(search.toLowerCase()));
      const offset = Number(params.get('offset') ?? 0);
      return { body: invoicesPage(list.slice(offset), list.length, offset) };
    };
  }

  it('carga la primera página desde la API sin filtros', async () => {
    const api = open('/historial');

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument();

    expect(screen.getByText('FE-1001 · 22 ago · Emitido')).toBeInTheDocument();
    expect(screen.getByText('FE-1002 · 22 ago · Recibido')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 2 de 2 facturas')).toBeInTheDocument();
    const [call] = invoiceCalls(api);
    expect(call.path).toBe(`/api/invoices/${BUSINESS_ID}?limit=50&offset=0`);
    expect(call.headers.Authorization).toBe('Bearer jwt-1');
  });

  it('chips Emitido/Recibido filtran en el servidor y la lista sigue la respuesta', async () => {
    const user = userEvent.setup();
    const api = open('/historial', { [INVOICES_PATH]: invoicesRoute() });
    await screen.findByText('Cliente 2');

    await user.click(screen.getByRole('button', { name: 'Recibido' }));

    await waitFor(() => expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument());
    expect(screen.getByText('Cliente 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recibido' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
    expect(paramsOf(lastInvoiceCall(api).path).get('group_type')).toBe('Recibido');

    await user.click(screen.getByRole('button', { name: 'Todas' }));
    expect(await screen.findByText('Cliente 1')).toBeInTheDocument();
    expect(paramsOf(lastInvoiceCall(api).path).has('group_type')).toBe(false);
  });

  it('selector de mes envía period=YYYY-MM', async () => {
    const user = userEvent.setup();
    const api = open('/historial');
    await screen.findByText('Cliente 1');
    const month = recentMonths(12)[1];

    await user.selectOptions(screen.getByLabelText('Mes'), month);

    await waitFor(() => expect(paramsOf(lastInvoiceCall(api).path).get('period')).toBe(month));
    await user.selectOptions(screen.getByLabelText('Mes'), '');
    await waitFor(() => expect(paramsOf(lastInvoiceCall(api).path).has('period')).toBe(false));
  });

  it('la búsqueda espera a que se deje de teclear y filtra en el servidor', async () => {
    const user = userEvent.setup();
    const api = open('/historial', { [INVOICES_PATH]: invoicesRoute() });
    await screen.findByText('Cliente 1');

    await user.type(screen.getByLabelText('Buscar facturas'), 'Cliente 3');

    await waitFor(() => expect(screen.queryByText('Cliente 1')).not.toBeInTheDocument());
    expect(screen.getByText('Cliente 3')).toBeInTheDocument();
    const searches = invoiceCalls(api)
      .map((c) => paramsOf(c.path).get('search'))
      .filter((value) => value !== null);
    expect(searches).toEqual(['Cliente 3']);
  });

  it('sin resultados: mensaje de lista vacía', async () => {
    const user = userEvent.setup();
    open('/historial', { [INVOICES_PATH]: invoicesRoute() });
    await screen.findByText('Cliente 1');

    await user.type(screen.getByLabelText('Buscar facturas'), 'zzz');

    expect(await screen.findByText('No se encontraron facturas.')).toBeInTheDocument();
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Cargar más" pide la siguiente página con offset y la agrega sin repetir', async () => {
    const user = userEvent.setup();
    const api = open('/historial', {
      [INVOICES_PATH]: (_init, path) => {
        const offset = Number(paramsOf(path).get('offset'));
        return offset === 0
          ? { body: invoicesPage([invoice(1), invoice(2)], 3, 0) }
          : { body: invoicesPage([invoice(2), invoice(3)], 3, offset) };
      },
    });
    await screen.findByText('Cliente 1');
    expect(screen.getByText('Mostrando 2 de 3 facturas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByText('Cliente 3')).toBeInTheDocument();
    expect(screen.getAllByText('Cliente 2')).toHaveLength(1);
    expect(paramsOf(lastInvoiceCall(api).path).get('offset')).toBe('2');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('si el servidor ya no tiene más filas, "Cargar más" se retira en vez de quedar sin efecto', async () => {
    const user = userEvent.setup();
    const api = open('/historial', {
      [INVOICES_PATH]: (_init, path) =>
        Number(paramsOf(path).get('offset')) === 0
          ? { body: invoicesPage([invoice(1)], 5, 0) }
          : { body: invoicesPage([], 1, 1) },
    });
    await screen.findByText('Cliente 1');

    await user.click(screen.getByRole('button', { name: 'Cargar más' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(invoiceCalls(api)).toHaveLength(2);
  });

  it('el offset de "Cargar más" cuenta las filas pedidas, aunque alguna venga repetida', async () => {
    const user = userEvent.setup();
    const api = open('/historial', {
      [INVOICES_PATH]: (_init, path) => {
        const offset = Number(paramsOf(path).get('offset'));
        if (offset === 0) return { body: invoicesPage([invoice(1), invoice(2)], 6, 0) };
        if (offset === 2) return { body: invoicesPage([invoice(2), invoice(3)], 6, 2) };
        return { body: invoicesPage([invoice(4), invoice(5)], 6, offset) };
      },
    });
    await screen.findByText('Cliente 1');

    await user.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Cliente 3');
    await user.click(screen.getByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Cliente 5');

    expect(invoiceCalls(api).map((c) => paramsOf(c.path).get('offset'))).toEqual(['0', '2', '4']);
  });

  it('error al cargar más: avisa y conserva la lista', async () => {
    const user = userEvent.setup();
    open('/historial', {
      [INVOICES_PATH]: (_init, path): MockReply =>
        Number(paramsOf(path).get('offset')) === 0
          ? { body: invoicesPage([invoice(1)], 2, 0) }
          : { status: 500, body: { detail: 'Fallo al paginar.' } },
    });
    await screen.findByText('Cliente 1');

    await user.click(screen.getByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo al paginar.');
    expect(screen.getByText('Cliente 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cargar más' })).toBeEnabled();
  });

  it('una respuesta tardía de un filtro anterior no pisa la lista actual', async () => {
    const user = userEvent.setup();
    let releaseSlow: (reply: MockReply) => void = () => undefined;
    open('/historial', {
      [INVOICES_PATH]: (_init, path) => {
        if (paramsOf(path).get('group_type') === 'Recibido') {
          return { body: invoicesPage([invoice(2, { group_type: 'Recibido' })]) };
        }
        return new Promise<MockReply>((resolve) => {
          releaseSlow = resolve;
        });
      },
    });
    // La carga inicial (sin filtro) queda pendiente; el usuario cambia a Recibido.
    await screen.findByText('Buscando facturas…');
    await user.click(screen.getByRole('button', { name: 'Recibido' }));
    expect(await screen.findByText('Cliente 2')).toBeInTheDocument();

    await act(async () => {
      releaseSlow({ body: invoicesPage([invoice(9, { cliente: 'Cliente obsoleto' })]) });
    });

    expect(screen.queryByText('Cliente obsoleto')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente 2')).toBeInTheDocument();
  });

  it('error 500: mensaje de la API con Reintentar que vuelve a pedir la lista', async () => {
    const user = userEvent.setup();
    const api = open('/historial', { [INVOICES_PATH]: { status: 500, body: { detail: 'Error interno.' } } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Error interno.');
    api.set(INVOICES_PATH, { body: INVOICES });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Calendario', () => {
  it('deriva próximas y completadas de /api/iva: presentado -> completado; en curso a 5 días -> próximo', async () => {
    open('/calendario');

    expect(await screen.findByRole('heading', { name: 'Próximas (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completadas (1)' })).toBeInTheDocument();
    expect(screen.getByText('En 5 días')).toBeInTheDocument();
    expect(screen.getByText('Jul – Ago 2026 · 10 sept 2026')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('May – Jun 2026 · 10 jul 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Declaración de IVA')).toHaveLength(2);
  });

  it('etiquetas de días: hoy, venció y sin fecha', async () => {
    open('/calendario', {
      [IVA_PATH]: {
        body: {
          ...IVA,
          periodos: [
            ivaPeriod({ period_key: 'a', dias: 0 }),
            ivaPeriod({ period_key: 'b', dias: -2 }),
            ivaPeriod({ period_key: 'c', dias: null }),
            ivaPeriod({ period_key: 'd', dias: 1 }),
          ],
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Próximas (4)' })).toBeInTheDocument();
    expect(screen.getByText('Vence hoy')).toBeInTheDocument();
    expect(screen.getByText('Venció')).toBeInTheDocument();
    expect(screen.getByText('Al día')).toBeInTheDocument();
    expect(screen.getByText('En 1 día')).toBeInTheDocument();
    // Orden de "Próximas": lo más urgente primero y lo que no tiene fecha al final.
    const pills = [...document.querySelectorAll('.due-pill')].map((el) => el.textContent?.trim());
    expect(pills).toEqual(['Venció', 'Vence hoy', 'En 1 día', 'Al día']);
    expect(screen.getByRole('heading', { name: 'Completadas (0)' })).toBeInTheDocument();
    expect(screen.getByText('Aún no hay obligaciones completadas.')).toBeInTheDocument();
  });

  it('sin obligaciones próximas: mensaje vacío', async () => {
    open('/calendario', { [IVA_PATH]: { body: { ...IVA, periodos: [IVA.periodos[1]] } } });

    expect(await screen.findByText('No tienes obligaciones próximas.')).toBeInTheDocument();
  });

  it('deriveObligations aplica el umbral de 10 días del prototipo', () => {
    const states = deriveObligations([
      ivaPeriod({ period_key: 'x1', dias: 10 }),
      ivaPeriod({ period_key: 'x2', dias: 11 }),
      ivaPeriod({ period_key: 'x3', dias: null }),
      ivaPeriod({ period_key: 'x4', estado: 'presentado', dias: 3 }),
    ]).map((o) => o.estado);

    expect(states).toEqual(['proximo', 'aldia', 'aldia', 'completado']);
  });
});

describe('Estados de red y sesión en las pantallas', () => {
  it('401 al cargar una pantalla: vuelve al login sin error local', async () => {
    open('/inicio', { [DASHBOARD_PATH]: { status: 401, body: { detail: 'Sesión inválida o expirada.' } } });

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('403 al cargar una pantalla: Servicio Suspendido con la sesión intacta y sin error local', async () => {
    open('/iva', { [IVA_PATH]: { status: 403, body: { message: 'Suscripción bloqueada por mora.' } } });

    expect(await screen.findByRole('heading', { name: 'Acceso Suspendido' })).toBeInTheDocument();
    expect(screen.getByText('Suscripción bloqueada por mora.')).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar esta información/)).not.toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
  });

  it('red caída: error con Reintentar y banner; al reintentar carga los datos y el banner desaparece', async () => {
    const user = userEvent.setup();
    const api = open('/calendario', { [IVA_PATH]: { networkError: true } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos conectar con el servidor');
    expect(screen.getByText('No pudimos conectar con el servidor.')).toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
    expect(screen.queryByText('Declaración de IVA')).not.toBeInTheDocument();

    api.set(IVA_PATH, { body: IVA });
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Próximas (1)' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('No pudimos conectar con el servidor.')).not.toBeInTheDocument());
  });

  it('el "Reintentar" del banner de red también recarga la pantalla que quedó en error', async () => {
    const user = userEvent.setup();
    const api = open('/calendario', { [IVA_PATH]: { networkError: true } });
    await screen.findByRole('alert');
    const banner = screen.getByRole('status');

    api.set(IVA_PATH, { body: IVA });
    await user.click(within(banner).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Próximas (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('No pudimos conectar con el servidor.')).not.toBeInTheDocument();
  });

  it('la navegación del shell muestra cada pantalla con datos de su endpoint', async () => {
    const user = userEvent.setup();
    const api = open('/inicio');
    await screen.findByRole('region', { name: 'Resumen del mes' });

    await user.click(screen.getByRole('link', { name: 'IVA' }));
    expect(await screen.findByRole('region', { name: 'Periodo de IVA' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Facturas' }));
    expect(await screen.findByText('Historial de facturas DIAN')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Calendario' }));
    expect(await screen.findByText('Calendario de vencimientos')).toBeInTheDocument();

    const paths = api.calls.map((c) => c.path.split('?')[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        `/api/dashboard/${BUSINESS_ID}`,
        `/api/iva/${BUSINESS_ID}`,
        `/api/invoices/${BUSINESS_ID}`,
      ]),
    );
  });
});
