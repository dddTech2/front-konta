import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Me } from '../api/client';
import App from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { clearToken } from '../auth/session';
import { ROUTER_FUTURE } from '../routerFuture';
import { DATA_ROUTES } from './fixtures';

export const ME_OK: Me = {
  business_id: 'biz-1',
  is_provisioned: true,
  is_blocked: false,
  subscription_status: 'ACTIVA',
  has_warning_banner: false,
  redirect_url: null,
  income_source: 'DIAN',
};

export const ME_MANUAL: Me = {
  ...ME_OK,
  income_source: 'MANUAL_SALES',
};

export interface MockReply {
  status?: number;
  body?: unknown;
  /** true = `fetch` rechaza sin respuesta HTTP (red caída). */
  networkError?: boolean;
}

/** Una función recibe el `init` del fetch y la ruta completa (con query) para responder según los parámetros. */
export type Route = MockReply | ((init: RequestInit, path: string) => MockReply | Promise<MockReply>);

export interface FetchCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Sustituye `fetch` por un enrutador simple `"METHOD /ruta"` -> respuesta. Devuelve las llamadas hechas.
 * La ruta puede llevar query o no (se prueba primero exacta y luego sin query). Las pantallas de datos de la
 * Story 5.2b tienen respuestas por defecto (`DATA_ROUTES`) que cada prueba puede sustituir.
 */
export function mockApi(routes: Record<string, Route>) {
  const calls: FetchCall[] = [];
  const table: Record<string, Route> = { ...DATA_ROUTES, ...routes };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toUpperCase();
    const path = String(input);
    calls.push({
      method,
      path,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const route = table[`${method} ${path}`] ?? table[`${method} ${path.split('?')[0]}`];
    if (!route) throw new Error(`Ruta no simulada: ${method} ${path}`);
    const reply = await (typeof route === 'function' ? route(init, path) : route);
    if (reply.networkError) throw new TypeError('Failed to fetch');
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls,
    /** Cambia la respuesta de una ruta a mitad de una prueba. */
    set(key: string, route: Route) {
      table[key] = route;
    },
  };
}

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

export function resetSession() {
  clearToken();
  window.sessionStorage.clear();
  window.localStorage.clear();
}
