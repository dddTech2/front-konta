/**
 * Cliente HTTP único de la SPA. Aquí (y solo aquí) se decide qué significa cada status:
 *   401 -> sesión inválida: `onUnauthorized` (la app vuelve al login).
 *   403 -> negocio bloqueado: `onForbidden` (la app muestra Servicio Suspendido, sesión intacta).
 *   sin respuesta HTTP -> `onNetworkError` (banner con "Reintentar"), nunca logout ni suspensión.
 * Nunca se intercambian 401 y 403 (ADR-005).
 */

const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

/** Devuelve la URL anteponiendo API_BASE si está configurado. */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'network' | 'http';

export interface SuspensionDetail {
  message?: string;
  plan?: string;
  amountDue?: number;
}

/** Forma de `GET /api/auth/me` (Story 5.1). */
export interface Me {
  business_id: string | null;
  is_provisioned: boolean;
  is_blocked: boolean;
  subscription_status: string | null;
  has_warning_banner: boolean;
  redirect_url: string | null;
  income_source?: 'DIAN' | 'MANUAL_SALES' | null;
  role?: 'CLIENT' | 'ADMIN';
}

/** Un negocio sin `income_source` (API anterior) o sin negocio se trata como DIAN. */
export function isManualSales(me: Me | null): boolean {
  return me?.income_source === 'MANUAL_SALES';
}

/** Un usuario sin `role` (API anterior) se trata como CLIENT. */
export function isAdmin(me: Me | null): boolean {
  return me?.role === 'ADMIN';
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;

  constructor(kind: ApiErrorKind, status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export interface ApiHandlers {
  getToken: () => string | null;
  onUnauthorized: () => void;
  onForbidden: (detail: SuspensionDetail) => void;
  onNetworkError: () => void;
  onNetworkRecovered: () => void;
}

const noop = () => undefined;
const DEFAULT_HANDLERS: ApiHandlers = {
  getToken: () => null,
  onUnauthorized: noop,
  onForbidden: noop,
  onNetworkError: noop,
  onNetworkRecovered: noop,
};
let handlers: ApiHandlers = DEFAULT_HANDLERS;

export function configureApi(next: ApiHandlers): void {
  handlers = next;
}

export function resetApi(): void {
  handlers = DEFAULT_HANDLERS;
}

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';

export const VALIDATION_ERROR_MESSAGE = 'Los datos enviados no son válidos. Revisa los campos e inténtalo de nuevo.';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Tolera `{detail: "..."}`, `{detail: {message}}` y el cuerpo plano `{message}` del 403 de la API. */
function extractMessage(body: unknown): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;
  if (typeof record.detail === 'string') return record.detail;
  // 422 de FastAPI por esquema: `detail` es una lista en inglés; se muestra un aviso genérico en español.
  if (Array.isArray(record.detail)) return VALIDATION_ERROR_MESSAGE;
  const nested = asRecord(record.detail);
  if (nested && typeof nested.message === 'string') return nested.message;
  if (typeof record.message === 'string') return record.message;
  return undefined;
}

function extractSuspension(body: unknown): SuspensionDetail {
  const record = asRecord(body);
  const source = asRecord(record?.detail) ?? record ?? {};
  const detail: SuspensionDetail = {};
  const message = extractMessage(body);
  if (message) detail.message = message;
  if (typeof source.plan === 'string') detail.plan = source.plan;
  if (typeof source.amount_due === 'number') detail.amountDue = source.amount_due;
  return detail;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function genericMessage(status: number): string {
  return `El servidor respondió con un error (${status}). Inténtalo de nuevo.`;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** false = llamada pública (login): sin Bearer y sin manejo global de 401/403. */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = handlers.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    if (auth) handlers.onNetworkError();
    throw new ApiError('network', 0, NETWORK_ERROR_MESSAGE);
  }
  if (auth) handlers.onNetworkRecovered();

  if (response.ok) {
    const data = await readBody(response);
    if (data === undefined) throw new ApiError('http', response.status, genericMessage(response.status));
    return data as T;
  }

  const errorBody = await readBody(response);
  const message = extractMessage(errorBody) ?? genericMessage(response.status);

  // Único punto de manejo de status. Las llamadas públicas devuelven el error al formulario.
  if (auth) {
    switch (response.status) {
      case 401:
        handlers.onUnauthorized();
        throw new ApiError('unauthorized', 401, message);
      case 403:
        handlers.onForbidden(extractSuspension(errorBody));
        throw new ApiError('forbidden', 403, message);
      default:
        break;
    }
  }
  throw new ApiError('http', response.status, message);
}

export const getMe = (): Promise<Me> => apiFetch<Me>('/api/auth/me');

export const requestOtp = (identifier: string): Promise<{ detail: string }> =>
  apiFetch('/api/auth/request-otp', { method: 'POST', body: { identifier }, auth: false });

export const verifyOtp = (identifier: string, code: string): Promise<{ access_token: string }> =>
  apiFetch('/api/auth/verify-otp', { method: 'POST', body: { identifier, code }, auth: false });

export const linkLogin = (token: string): Promise<{ access_token: string; token_type?: string }> =>
  apiFetch('/api/auth/link-login', { method: 'POST', body: { token }, auth: false });

export const adminPing = (): Promise<{ ok: boolean }> => apiFetch<{ ok: boolean }>('/api/admin/ping');
