import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  apiFetch,
  configureApi,
  linkLogin,
  requestOtp,
  VALIDATION_ERROR_MESSAGE,
  verifyOtp,
  type ApiHandlers,
} from './client';
import { mockApi } from '../test/utils';

function handlers(overrides: Partial<ApiHandlers> = {}): ApiHandlers {
  return {
    getToken: () => 'jwt-abc',
    onUnauthorized: vi.fn(),
    onForbidden: vi.fn(),
    onNetworkError: vi.fn(),
    onNetworkRecovered: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('200: adjunta el Bearer y entrega el JSON', async () => {
    const h = handlers();
    configureApi(h);
    const api = mockApi({ 'GET /api/x': { body: { ok: 1 } } });

    await expect(apiFetch('/api/x')).resolves.toEqual({ ok: 1 });

    expect(api.calls[0].headers.Authorization).toBe('Bearer jwt-abc');
    expect(h.onUnauthorized).not.toHaveBeenCalled();
    expect(h.onForbidden).not.toHaveBeenCalled();
  });

  it('401: avisa a onUnauthorized y no a onForbidden', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'GET /api/x': { status: 401, body: { detail: 'Sesión inválida o expirada.' } } });

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });

    expect(h.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(h.onForbidden).not.toHaveBeenCalled();
  });

  it('403: avisa a onForbidden y no a onUnauthorized (cuerpo plano con message)', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({
      'GET /api/x': {
        status: 403,
        body: { status_code: 403, error: 'SUBSCRIPTION_BLOCKED', message: 'Suspendido.', plan: 'TRIMESTRAL', amount_due: 150000 },
      },
    });

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ kind: 'forbidden', status: 403 });

    expect(h.onForbidden).toHaveBeenCalledWith({ message: 'Suspendido.', plan: 'TRIMESTRAL', amountDue: 150000 });
    expect(h.onUnauthorized).not.toHaveBeenCalled();
  });

  it('403: tolera el envelope {detail: {message}}', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'GET /api/x': { status: 403, body: { detail: { message: 'Bloqueado.', plan: 'MENSUAL' } } } });

    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(ApiError);

    expect(h.onForbidden).toHaveBeenCalledWith({ message: 'Bloqueado.', plan: 'MENSUAL' });
  });

  it('red caída: avisa a onNetworkError, sin unauthorized ni forbidden', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'GET /api/x': { networkError: true } });

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ kind: 'network', status: 0 });

    expect(h.onNetworkError).toHaveBeenCalledTimes(1);
    expect(h.onUnauthorized).not.toHaveBeenCalled();
    expect(h.onForbidden).not.toHaveBeenCalled();
  });

  it('cualquier respuesta HTTP marca la red como recuperada', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'GET /api/x': { body: {} } });

    await apiFetch('/api/x');

    expect(h.onNetworkRecovered).toHaveBeenCalledTimes(1);
  });

  it('422 con detail en lista (validación de FastAPI): mensaje genérico en español, sin logout ni suspensión', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'POST /api/x': { status: 422, body: { detail: [{ type: 'decimal_parsing', msg: 'Input should be a valid decimal' }] } } });

    await expect(apiFetch('/api/x', { method: 'POST', body: {} })).rejects.toMatchObject({
      kind: 'http',
      status: 422,
      message: VALIDATION_ERROR_MESSAGE,
    });

    expect(h.onUnauthorized).not.toHaveBeenCalled();
    expect(h.onForbidden).not.toHaveBeenCalled();
  });

  it('5xx sin cuerpo JSON: error http con mensaje genérico', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'GET /api/x': { status: 502 } });

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ kind: 'http', status: 502 });
    expect(h.onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('llamadas públicas de login', () => {
  it('verify-otp: 401 = código inválido; no dispara logout y no envía Bearer', async () => {
    const h = handlers();
    configureApi(h);
    const api = mockApi({
      'POST /api/auth/verify-otp': { status: 401, body: { detail: 'Código inválido o expirado.' } },
    });

    await expect(verifyOtp('3001234567', '123456')).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: 'Código inválido o expirado.',
    });

    expect(h.onUnauthorized).not.toHaveBeenCalled();
    expect(api.calls[0].headers.Authorization).toBeUndefined();
    expect(api.calls[0].body).toEqual({ identifier: '3001234567', code: '123456' });
  });

  it('request-otp: 404/409/429 llegan al formulario con el detalle de la API', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'POST /api/auth/request-otp': { status: 429, body: { detail: 'Demasiadas solicitudes.' } } });

    await expect(requestOtp('3001234567')).rejects.toMatchObject({ status: 429, message: 'Demasiadas solicitudes.' });
    expect(h.onForbidden).not.toHaveBeenCalled();
  });

  it('red caída en login: error network sin activar el banner global', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({ 'POST /api/auth/request-otp': { networkError: true } });

    await expect(requestOtp('3001234567')).rejects.toMatchObject({ kind: 'network' });
    expect(h.onNetworkError).not.toHaveBeenCalled();
  });

  it('link-login: 200 entrega el access_token sin enviar Bearer', async () => {
    const h = handlers();
    configureApi(h);
    const api = mockApi({
      'POST /api/auth/link-login': {
        status: 200,
        body: { access_token: 'jwt-link', token_type: 'bearer' },
      },
    });

    await expect(linkLogin('token-123')).resolves.toEqual({
      access_token: 'jwt-link',
      token_type: 'bearer',
    });

    expect(h.onUnauthorized).not.toHaveBeenCalled();
    expect(api.calls[0].headers.Authorization).toBeUndefined();
    expect(api.calls[0].body).toEqual({ token: 'token-123' });
  });

  it('link-login: 401 rechaza con error http sin disparar onUnauthorized', async () => {
    const h = handlers();
    configureApi(h);
    mockApi({
      'POST /api/auth/link-login': {
        status: 401,
        body: { detail: 'El enlace venció o no es válido.' },
      },
    });

    await expect(linkLogin('token-bad')).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      message: 'El enlace venció o no es válido.',
    });

    expect(h.onUnauthorized).not.toHaveBeenCalled();
  });
});
