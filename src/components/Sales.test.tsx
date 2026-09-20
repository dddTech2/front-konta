import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, setToken } from '../auth/session';
import { ME_OK, mockApi, renderApp, resetSession, type MockReply } from '../test/utils';

const SALE_CREATED = {
  id: 'sale-1',
  total_amount: '150000.00',
  description: '3 tortas',
  recorded_via: 'WEB',
  created_at: '2026-09-18T15:00:00',
};

const MENU_ITEM = { name: 'Registrar Venta' } as const;

beforeEach(() => {
  resetSession();
  setToken('jwt-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', MENU_ITEM));
  return screen.findByRole('dialog', { name: 'Registrar venta' });
}

describe('SalesMenuItem: visibilidad según /me', () => {
  it('provisionada y sin bloqueo: el ítem está en el menú superior', async () => {
    mockApi({ 'GET /api/auth/me': { body: ME_OK } });

    renderApp('/inicio');

    expect(await screen.findByRole('button', MENU_ITEM)).toBeInTheDocument();
  });

  it('sin negocio provisionado: el ítem no existe en el DOM', async () => {
    mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, business_id: null, is_provisioned: false } } });

    renderApp('/inicio');

    await screen.findByRole('heading', { name: 'Estamos preparando tu cuenta' });
    expect(screen.queryByText('Registrar Venta')).not.toBeInTheDocument();
  });

  it('is_provisioned=false aunque llegue un business_id: el ítem se oculta, no se deshabilita', async () => {
    mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, is_provisioned: false } } });

    renderApp('/inicio');

    await screen.findByRole('navigation', { name: 'Secciones' });
    expect(screen.queryByText('Registrar Venta')).not.toBeInTheDocument();
  });

  it('negocio BLOQUEADO: Servicio Suspendido y ningún ítem de ventas', async () => {
    mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, is_blocked: true, subscription_status: 'BLOQUEADO' } } });

    renderApp('/inicio');

    await screen.findByRole('heading', { name: 'Acceso Suspendido' });
    expect(screen.queryByText('Registrar Venta')).not.toBeInTheDocument();
  });
});

describe('SalesForm', () => {
  it('201: envía el total con el business_id de /me, cierra el formulario y confirma el monto', async () => {
    const api = mockApi({
      'GET /api/auth/me': { body: { ...ME_OK, business_id: 'biz-9' } },
      'POST /api/sales/biz-9': { status: 201, body: SALE_CREATED },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '150000.00');
    await user.type(within(dialog).getByLabelText('Descripción (opcional)'), '  3 tortas ');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Venta registrada por $150.000.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const post = api.calls.find((c) => c.method === 'POST');
    expect(post?.path).toBe('/api/sales/biz-9');
    expect(post?.body).toEqual({ total_amount: '150000.00', description: '3 tortas' });
    expect(post?.headers.Authorization).toBe('Bearer jwt-1');
  });

  it('sin descripción: no se envía el campo (queda null en el servidor)', async () => {
    const api = mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': { status: 201, body: { ...SALE_CREATED, description: null, total_amount: '100.10' } },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '100.10');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Venta registrada por $100,10.');
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({ total_amount: '100.10' });
  });

  it('422 del servicio: error en línea, formulario abierto y datos conservados', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': { status: 422, body: { detail: 'El total debe ser mayor a cero.' } },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '0');
    await user.type(within(dialog).getByLabelText('Descripción (opcional)'), 'nada');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('El total debe ser mayor a cero.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Total de la venta')).toHaveValue('0');
    expect(within(dialog).getByLabelText('Descripción (opcional)')).toHaveValue('nada');
    expect(within(dialog).getByRole('button', { name: 'Guardar venta' })).toBeEnabled();
    expect(screen.queryByText(/Venta registrada/)).not.toBeInTheDocument();
  });

  it('422 de esquema (total no numérico): aviso genérico en español, formulario abierto', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': {
        status: 422,
        body: { detail: [{ type: 'decimal_parsing', loc: ['body', 'total_amount'], msg: 'Input should be a valid decimal' }] },
      },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Los datos enviados no son válidos');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('total vacío: error en línea y no se llama a la API', async () => {
    const api = mockApi({ 'GET /api/auth/me': { body: ME_OK } });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Escribe el total de la venta.');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('doble clic: una sola solicitud y el botón queda deshabilitado mientras se envía', async () => {
    let release: (reply: MockReply) => void = () => undefined;
    const api = mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': () =>
        new Promise<MockReply>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '5000');
    const submit = within(dialog).getByRole('button', { name: 'Guardar venta' });
    await user.dblClick(submit);

    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(within(dialog).getByRole('button', { name: 'Guardando…' })).toBeDisabled();

    await act(async () => {
      release({ status: 201, body: { ...SALE_CREATED, total_amount: '5000.00' } });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('$5.000');
    expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('401 al enviar: vuelve al login y no muestra error en el formulario', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': { status: 401, body: { detail: 'Sesión inválida o expirada.' } },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('403 tardío (BLOQUEADO entre el menú y el envío): Servicio Suspendido, sesión intacta', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': {
        status: 403,
        body: { status_code: 403, error: 'SUBSCRIPTION_BLOCKED', message: 'Pago pendiente de tu plan.' },
      },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));

    expect(await screen.findByRole('heading', { name: 'Acceso Suspendido' })).toBeInTheDocument();
    expect(screen.getByText('Pago pendiente de tu plan.')).toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Registrar Venta')).not.toBeInTheDocument();
  });

  it('404 (negocio ajeno) y red caída: mensaje en línea y se puede reintentar', async () => {
    const api = mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': { status: 404, body: { detail: "No se encontró el negocio con identificador 'biz-1'." } },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se encontró el negocio');

    api.set('POST /api/sales/biz-1', { networkError: true });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor'),
    );
    expect(within(dialog).getByRole('button', { name: 'Guardar venta' })).toBeEnabled();
    expect(getToken()).toBe('jwt-1');
  });

  it('Escape cierra el formulario abierto sin llamar a la API', async () => {
    const api = mockApi({ 'GET /api/auth/me': { body: ME_OK } });
    const user = userEvent.setup();
    renderApp('/inicio');

    await openForm(user);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('Escape con un envío en curso no cierra el formulario', async () => {
    let release: (reply: MockReply) => void = () => undefined;
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': () =>
        new Promise<MockReply>((resolve) => {
          release = resolve;
        }),
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));
    expect(await within(dialog).findByRole('button', { name: 'Guardando…' })).toBeDisabled();

    // Con los campos deshabilitados el foco está en <body>: el evento se dispara directo sobre el diálogo.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await act(async () => {
      release({ status: 201, body: SALE_CREATED });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Venta registrada');
  });

  it('"Cerrar" quita la confirmación de la venta', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': { status: 201, body: SALE_CREATED },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '150000');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));
    const banner = await screen.findByRole('status');

    await user.click(within(banner).getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('tras un 422 el foco vuelve al campo del total y Escape sigue cerrando el formulario', async () => {
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'POST /api/sales/biz-1': { status: 422, body: { detail: 'El total debe ser mayor a cero.' } },
    });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.type(within(dialog).getByLabelText('Total de la venta'), '0');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar venta' }));
    await within(dialog).findByRole('alert');

    await waitFor(() => expect(within(dialog).getByLabelText('Total de la venta')).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Cancelar cierra el formulario sin llamar a la API', async () => {
    const api = mockApi({ 'GET /api/auth/me': { body: ME_OK } });
    const user = userEvent.setup();
    renderApp('/inicio');

    const dialog = await openForm(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
