import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api/client';
import { getToken, setToken } from './auth/session';
import { ME_OK, mockApi, renderApp, resetSession } from './test/utils';

const IDENTIFIER = '3001234567';

beforeEach(() => {
  resetSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loginThroughForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Celular o NIT'), IDENTIFIER);
  await user.click(screen.getByRole('button', { name: 'Enviarme el código' }));
  await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Login OTP', () => {
  it('identificador + código correcto: token en memoria y sessionStorage, /me y navega al shell', async () => {
    const api = mockApi({
      'POST /api/auth/request-otp': { status: 202, body: { detail: 'Código enviado por Telegram' } },
      'POST /api/auth/verify-otp': { body: { access_token: 'jwt-1', token_type: 'bearer' } },
      'GET /api/auth/me': { body: ME_OK },
    });
    const user = userEvent.setup();
    renderApp('/');

    await loginThroughForm(user);

    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
    expect(window.sessionStorage.getItem('kontable.token')).toBe('jwt-1');
    expect(window.localStorage.length).toBe(0);
    const me = api.calls.find((c) => c.path === '/api/auth/me');
    expect(me?.headers.Authorization).toBe('Bearer jwt-1');
    expect(api.calls.find((c) => c.path === '/api/auth/request-otp')?.body).toEqual({ identifier: IDENTIFIER });
    expect(api.calls.find((c) => c.path === '/api/auth/verify-otp')?.body).toEqual({
      identifier: IDENTIFIER,
      code: '123456',
    });
  });

  it('verify-otp 401: error en el formulario, sin redirigir ni cerrar el paso del código', async () => {
    mockApi({
      'POST /api/auth/request-otp': { status: 202, body: { detail: 'ok' } },
      'POST /api/auth/verify-otp': { status: 401, body: { detail: 'Código inválido o expirado.' } },
    });
    const user = userEvent.setup();
    renderApp('/');

    await loginThroughForm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido o expirado.');
    expect(screen.getByLabelText('Código de 6 dígitos')).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('request-otp con errores de la API (404, 409, 429, 502) los muestra en el formulario', async () => {
    const api = mockApi({
      'POST /api/auth/request-otp': { status: 404, body: { detail: 'No encontramos una cuenta con ese identificador.' } },
    });
    const user = userEvent.setup();
    renderApp('/');

    await user.type(await screen.findByLabelText('Celular o NIT'), IDENTIFIER);
    await user.click(screen.getByRole('button', { name: 'Enviarme el código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos una cuenta');

    for (const [status, detail] of [
      [409, 'Tu cuenta aún no tiene Telegram vinculado.'],
      [429, 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.'],
      [502, 'No pudimos enviar el código por Telegram. Intenta de nuevo.'],
    ] as const) {
      api.set('POST /api/auth/request-otp', { status, body: { detail } });
      await user.click(screen.getByRole('button', { name: 'Enviarme el código' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(detail));
    }
    expect(screen.queryByLabelText('Código de 6 dígitos')).not.toBeInTheDocument();
  });

  it('reenvío de código y cambio de identificador', async () => {
    const api = mockApi({ 'POST /api/auth/request-otp': { status: 202, body: { detail: 'ok' } } });
    const user = userEvent.setup();
    renderApp('/');

    await user.type(await screen.findByLabelText('Celular o NIT'), IDENTIFIER);
    await user.click(screen.getByRole('button', { name: 'Enviarme el código' }));
    await user.click(await screen.findByRole('button', { name: 'Reenviar código' }));

    await waitFor(() => expect(api.calls.filter((c) => c.path === '/api/auth/request-otp')).toHaveLength(2));
    expect(screen.getByText(/código nuevo/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cambiar celular o NIT' }));
    expect(screen.getByLabelText('Celular o NIT')).toHaveValue(IDENTIFIER);
  });

  it('el código solo admite 6 dígitos y el botón espera a tenerlos', async () => {
    mockApi({ 'POST /api/auth/request-otp': { status: 202, body: { detail: 'ok' } } });
    const user = userEvent.setup();
    renderApp('/');

    await user.type(await screen.findByLabelText('Celular o NIT'), IDENTIFIER);
    await user.click(screen.getByRole('button', { name: 'Enviarme el código' }));
    const input = await screen.findByLabelText('Código de 6 dígitos');
    await user.type(input, '12ab34');

    expect(input).toHaveValue('1234');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('red caída al pedir el código: mensaje en el formulario y sin logout', async () => {
    mockApi({ 'POST /api/auth/request-otp': { networkError: true } });
    const user = userEvent.setup();
    renderApp('/');

    await user.type(await screen.findByLabelText('Celular o NIT'), IDENTIFIER);
    await user.click(screen.getByRole('button', { name: 'Enviarme el código' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor');
  });
});

describe('Sesión y rutas protegidas', () => {
  it('F5 con token en sessionStorage: llama /me, no pide login y muestra el shell', async () => {
    setToken('jwt-guardado');
    const api = mockApi({ 'GET /api/auth/me': { body: ME_OK } });

    renderApp('/inicio');

    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Celular o NIT')).not.toBeInTheDocument();
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].headers.Authorization).toBe('Bearer jwt-guardado');
  });

  it('sin token: una ruta protegida redirige al login y no llama a la API', async () => {
    const api = mockApi({});

    renderApp('/historial');

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });

  it('?nit= en la URL no otorga sesión', async () => {
    const api = mockApi({});

    renderApp('/inicio?nit=901234567');

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(api.calls).toHaveLength(0);
  });

  it('/me sin negocio: aviso con contacto, sesión válida y sin llamadas a dashboard', async () => {
    setToken('jwt-1');
    const api = mockApi({
      'GET /api/auth/me': { body: { ...ME_OK, business_id: null, is_provisioned: false } },
    });

    renderApp('/inicio');

    expect(await screen.findByRole('heading', { name: 'Estamos preparando tu cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('wa.me/'));
    expect(screen.queryByLabelText('Celular o NIT')).not.toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
    expect(api.calls.map((c) => c.path)).toEqual(['/api/auth/me']);
  });

  it('logout: limpia memoria y sessionStorage y vuelve al login', async () => {
    setToken('jwt-1');
    mockApi({ 'GET /api/auth/me': { body: ME_OK } });
    const user = userEvent.setup();
    renderApp('/inicio');

    await user.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(window.sessionStorage.getItem('kontable.token')).toBeNull();
  });
});

describe('401 y 403', () => {
  it('401 en /me al restaurar: limpia la sesión y muestra el login, no un error genérico', async () => {
    setToken('jwt-vencido');
    mockApi({ 'GET /api/auth/me': { status: 401, body: { detail: 'Sesión inválida o expirada.' } } });

    renderApp('/inicio');

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(window.sessionStorage.getItem('kontable.token')).toBeNull();
  });

  it('401 a mitad de sesión: vuelve al login', async () => {
    setToken('jwt-1');
    const api = mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'GET /api/dashboard/x': { status: 401, body: { detail: 'Sesión inválida o expirada.' } },
    });
    renderApp('/inicio');
    await screen.findByRole('navigation', { name: 'Secciones' });

    await act(async () => {
      await apiFetch('/api/dashboard/x').catch(() => undefined);
    });

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(getToken()).toBeNull();
    expect(api.calls.some((c) => c.path === '/api/dashboard/x')).toBe(true);
  });

  it('/me con is_blocked: pantalla Acceso Suspendido con WhatsApp a Katerinn y sesión intacta', async () => {
    setToken('jwt-1');
    mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, is_blocked: true, subscription_status: 'BLOQUEADO' } } });

    renderApp('/inicio');

    expect(await screen.findByRole('heading', { name: 'Acceso Suspendido' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contactar a Katerinn por WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me/'),
    );
    expect(getToken()).toBe('jwt-1');
    expect(screen.queryByLabelText('Celular o NIT')).not.toBeInTheDocument();
  });

  it('403 a mitad de sesión (cuerpo plano con message): Servicio Suspendido, no logout', async () => {
    setToken('jwt-1');
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'GET /api/dashboard/x': {
        status: 403,
        body: { status_code: 403, error: 'SUBSCRIPTION_BLOCKED', message: 'Pago pendiente de tu plan.', plan: 'TRIMESTRAL' },
      },
    });
    renderApp('/inicio');
    await screen.findByRole('navigation', { name: 'Secciones' });

    await act(async () => {
      await apiFetch('/api/dashboard/x').catch(() => undefined);
    });

    expect(await screen.findByRole('heading', { name: 'Acceso Suspendido' })).toBeInTheDocument();
    expect(screen.getByText('Pago pendiente de tu plan.')).toBeInTheDocument();
    expect(screen.getByText('TRIMESTRAL')).toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
  });

  it('403 con el envelope {detail}: también se tolera', async () => {
    setToken('jwt-1');
    mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'GET /api/dashboard/x': { status: 403, body: { detail: { message: 'Bloqueado por mora.' } } },
    });
    renderApp('/inicio');
    await screen.findByRole('navigation', { name: 'Secciones' });

    await act(async () => {
      await apiFetch('/api/dashboard/x').catch(() => undefined);
    });

    expect(await screen.findByText('Bloqueado por mora.')).toBeInTheDocument();
  });

  it('"Ya pagué": si /me ya no está bloqueado vuelve al shell; si sigue, avisa', async () => {
    setToken('jwt-1');
    const api = mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, is_blocked: true } } });
    const user = userEvent.setup();
    renderApp('/inicio');

    await user.click(await screen.findByRole('button', { name: 'Ya pagué, reintentar verificación' }));
    expect(await screen.findByText(/Aún no vemos tu pago/)).toBeInTheDocument();

    api.set('GET /api/auth/me', { body: ME_OK });
    await user.click(screen.getByRole('button', { name: 'Ya pagué, reintentar verificación' }));

    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
  });
});

describe('Red caída', () => {
  it('con sesión lista: banner no bloqueante con Reintentar, sin logout ni suspensión', async () => {
    setToken('jwt-1');
    const api = mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'GET /api/dashboard/x': { networkError: true },
    });
    renderApp('/inicio');
    await screen.findByRole('navigation', { name: 'Secciones' });

    await act(async () => {
      await apiFetch('/api/dashboard/x').catch(() => undefined);
    });

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acceso Suspendido' })).not.toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');

    api.set('GET /api/dashboard/x', { body: {} });
    await act(async () => {
      await apiFetch('/api/dashboard/x');
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument());
  });

  it('red caída al restaurar la sesión: reintentable, sin cerrar sesión ni inventar datos', async () => {
    setToken('jwt-1');
    const api = mockApi({ 'GET /api/auth/me': { networkError: true } });
    const user = userEvent.setup();
    renderApp('/inicio');

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar tu sesión' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Celular o NIT')).not.toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');

    api.set('GET /api/auth/me', { body: ME_OK });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
  });
});

describe('Casos límite de sesión', () => {
  it('403 a mitad de sesión y luego /me sin bloqueo: "Ya pagué" devuelve al shell', async () => {
    setToken('jwt-1');
    const api = mockApi({
      'GET /api/auth/me': { body: ME_OK },
      'GET /api/dashboard/x': { status: 403, body: { message: 'Pago pendiente.' } },
    });
    const user = userEvent.setup();
    renderApp('/inicio');
    await screen.findByRole('navigation', { name: 'Secciones' });
    await act(async () => {
      await apiFetch('/api/dashboard/x').catch(() => undefined);
    });
    await user.click(await screen.findByRole('button', { name: 'Ya pagué, reintentar verificación' }));

    expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
    expect(screen.queryByText('Pago pendiente.')).not.toBeInTheDocument();
    expect(api.calls.filter((c) => c.path === '/api/auth/me')).toHaveLength(2);
  });

  it('403 en /me al restaurar la sesión: Servicio Suspendido, no "No pudimos cargar tu sesión"', async () => {
    setToken('jwt-1');
    mockApi({ 'GET /api/auth/me': { status: 403, body: { message: 'Bloqueado en /me.' } } });

    renderApp('/inicio');

    expect(await screen.findByRole('heading', { name: 'Acceso Suspendido' })).toBeInTheDocument();
    expect(screen.getByText('Bloqueado en /me.')).toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
  });

  it('5xx en /me: sesión abierta, un solo Reintentar y sin banner de red', async () => {
    setToken('jwt-1');
    mockApi({ 'GET /api/auth/me': { status: 500, body: { detail: 'Error interno.' } } });

    renderApp('/inicio');

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar tu sesión' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reintentar' })).toHaveLength(1);
    expect(screen.queryByLabelText('Celular o NIT')).not.toBeInTheDocument();
    expect(getToken()).toBe('jwt-1');
  });

  it('"Ya pagué" con /me caído: avisa que no se pudo verificar', async () => {
    setToken('jwt-1');
    const api = mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, is_blocked: true } } });
    const user = userEvent.setup();
    renderApp('/inicio');
    await screen.findByRole('heading', { name: 'Acceso Suspendido' });

    api.set('GET /api/auth/me', { status: 500, body: { detail: 'Error interno.' } });
    await user.click(screen.getByRole('button', { name: 'Ya pagué, reintentar verificación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos verificar tu estado');
    expect(screen.queryByText(/Aún no vemos tu pago/)).not.toBeInTheDocument();
  });

  it('una respuesta de /me que llega después de "Salir" no reabre la sesión', async () => {
    setToken('jwt-1');
    const api = mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, is_blocked: true } } });
    const user = userEvent.setup();
    renderApp('/inicio');
    await screen.findByRole('heading', { name: 'Acceso Suspendido' });

    let release: (reply: { body: unknown }) => void = () => undefined;
    api.set(
      'GET /api/auth/me',
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Ya pagué, reintentar verificación' }));
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    await screen.findByLabelText('Celular o NIT');

    await act(async () => {
      release({ body: ME_OK });
    });

    expect(screen.getByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it('sin negocio: "Salir" cierra la sesión', async () => {
    setToken('jwt-1');
    mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, business_id: null, is_provisioned: false } } });
    const user = userEvent.setup();
    renderApp('/inicio');

    await user.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });
});
