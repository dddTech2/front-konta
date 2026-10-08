import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminPing, configureApi, isAdmin, resetApi } from '../../api/client';
import { getToken, setToken } from '../../auth/session';
import { BRAND_NAME } from '../../brand';
import {
  ME_ADMIN,
  ME_CLIENT,
  ME_MANUAL,
  ME_OK,
  mockApi,
  renderApp,
  resetSession,
} from '../../test/utils';

beforeEach(() => {
  resetSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminShell (Story 8.2)', () => {
  describe('Layout y marcadores (AC #8)', () => {
    it('ADMIN en /admin muestra cabecera completa, navegación y marcador de Resumen', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/admin');

      // Cabecera: Marca, "Administración" y botón Salir
      expect(await screen.findByText(BRAND_NAME)).toBeInTheDocument();
      expect(document.querySelector('.admin-header img.admin-logo')).toBeInTheDocument();
      expect(screen.getByText('Administración')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();

      // Navegación
      const nav = screen.getByRole('navigation', { name: 'Secciones de administración' });
      const resumenLink = within(nav).getByRole('link', { name: 'Resumen' });
      const clientesLink = within(nav).getByRole('link', { name: 'Clientes' });
      const operacionLink = within(nav).getByRole('link', { name: 'Operación' });

      expect(resumenLink).toHaveAttribute('href', '/admin');
      expect(clientesLink).toHaveAttribute('href', '/admin/clientes');
      expect(operacionLink).toHaveAttribute('href', '/admin/operacion');
      expect(resumenLink).toHaveClass('active');
      expect(clientesLink).not.toHaveClass('active');
      expect(operacionLink).not.toHaveClass('active');

      // Pantalla de Resumen
      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();

      // No muestra SinNegocio a pesar de business_id null
      expect(screen.queryByText(/Estamos preparando tu cuenta/)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    });

    it('ADMIN en /admin/clientes muestra pantalla de Clientes con enlace activo', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/admin/clientes');

      expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();

      const nav = screen.getByRole('navigation', { name: 'Secciones de administración' });
      expect(within(nav).getByRole('link', { name: 'Clientes' })).toHaveClass('active');
      expect(within(nav).getByRole('link', { name: 'Resumen' })).not.toHaveClass('active');
      expect(within(nav).getByRole('link', { name: 'Operación' })).not.toHaveClass('active');
    });

    it('ADMIN en /admin/operacion muestra la pantalla de Operación con enlace activo', async () => {
      setToken('jwt-admin');
      // Desde la Story 8.7 la pantalla ya no es un marcador: carga el worker y los trabajos.
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } }); // worker y trabajos vienen de DATA_ROUTES

      renderApp('/admin/operacion');

      expect(await screen.findByRole('heading', { name: 'Operación' })).toBeInTheDocument();

      const nav = screen.getByRole('navigation', { name: 'Secciones de administración' });
      expect(within(nav).getByRole('link', { name: 'Operación' })).toHaveClass('active');
      expect(within(nav).getByRole('link', { name: 'Resumen' })).not.toHaveClass('active');
      expect(within(nav).getByRole('link', { name: 'Clientes' })).not.toHaveClass('active');
    });

    it('ADMIN puede navegar entre pestañas usando los enlaces', async () => {
      const user = userEvent.setup();
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/admin');

      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();

      const nav = screen.getByRole('navigation', { name: 'Secciones de administración' });
      await user.click(within(nav).getByRole('link', { name: 'Clientes' }));
      expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();

      await user.click(within(nav).getByRole('link', { name: 'Operación' }));
      expect(await screen.findByRole('heading', { name: 'Operación' })).toBeInTheDocument();

      await user.click(within(nav).getByRole('link', { name: 'Resumen' }));
      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    });

    it('ADMIN en subruta desconocida /admin/xyz vuelve a /admin', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/admin/xyz');

      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    });
  });

  describe('Redirecciones de ADMIN (AC #7, AC #9)', () => {
    it('ADMIN que entra a / es redirigido a /admin (no muestra SinNegocio)', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/');

      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
      expect(screen.queryByText(/Estamos preparando tu cuenta/)).not.toBeInTheDocument();
    });

    it('ADMIN que entra a /inicio es redirigido a /admin', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/inicio');

      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
    });

    it('ADMIN con sesión que visita /login es redirigido a /admin', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/login');

      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    });

    it('tras /entrar/:token exitoso, ADMIN termina en /admin (AC #9)', async () => {
      mockApi({
        'POST /api/auth/link-login': { body: { access_token: 'jwt-admin-token' } },
        'GET /api/auth/me': { body: ME_ADMIN },
      });

      renderApp('/entrar/admin-link-token-123');

      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
      expect(screen.getByText('Administración')).toBeInTheDocument();
      expect(getToken()).toBe('jwt-admin-token');
    });
  });

  describe('Protección y guardas para CLIENT y anónimo (AC #7)', () => {
    it('CLIENT (DIAN) que intenta entrar a /admin es redirigido a /inicio', async () => {
      setToken('jwt-client');
      mockApi({ 'GET /api/auth/me': { body: ME_OK } });

      renderApp('/admin');

      expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument();
    });

    it('CLIENT con role explícito que intenta entrar a /admin/clientes es redirigido a /inicio', async () => {
      setToken('jwt-client');
      mockApi({ 'GET /api/auth/me': { body: ME_CLIENT } });

      renderApp('/admin/clientes');

      expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Clientes' })).not.toBeInTheDocument();
    });

    it('CLIENT (MANUAL_SALES) que intenta entrar a /admin es redirigido a /resumen', async () => {
      setToken('jwt-client');
      mockApi({ 'GET /api/auth/me': { body: ME_MANUAL } });

      renderApp('/admin');

      expect(await screen.findByRole('navigation', { name: 'Secciones' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument();
    });

    it('CLIENT sin negocio que intenta entrar a /admin es redirigido a /inicio y muestra SinNegocio', async () => {
      setToken('jwt-client');
      mockApi({ 'GET /api/auth/me': { body: { ...ME_OK, business_id: null, is_provisioned: false } } });

      renderApp('/admin');

      expect(await screen.findByRole('heading', { name: 'Estamos preparando tu cuenta' })).toBeInTheDocument();
    });

    it('usuario sin sesión que intenta entrar a /admin es redirigido a /login', async () => {
      mockApi({});

      renderApp('/admin');

      expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument();
    });

    it('usuario sin sesión que intenta entrar a /admin/clientes es redirigido a /login', async () => {
      mockApi({});

      renderApp('/admin/clientes');

      expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument();
    });
  });

  describe('Cierre de sesión (Salir)', () => {
    it('botón Salir en AdminShell cierra sesión y vuelve a /login', async () => {
      const user = userEvent.setup();
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      renderApp('/admin');

      await user.click(await screen.findByRole('button', { name: 'Salir' }));

      expect(await screen.findByLabelText('Celular o NIT')).toBeInTheDocument();
      expect(getToken()).toBeNull();
      expect(screen.queryByRole('navigation', { name: 'Secciones de administración' })).not.toBeInTheDocument();
    });
  });

  describe('Helpers y API client', () => {
    it('isAdmin identifica correctamente roles y APIs antiguas', () => {
      expect(isAdmin(ME_ADMIN)).toBe(true);
      expect(isAdmin(ME_OK)).toBe(false);
      expect(isAdmin(ME_CLIENT)).toBe(false);
      expect(isAdmin(ME_MANUAL)).toBe(false);
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin({ ...ME_OK, role: undefined })).toBe(false);
    });

    it('adminPing llama a /api/admin/ping con Bearer token', async () => {
      // Sin AuthProvider montado, apiFetch toma el token de los handlers configurados.
      setToken('jwt-admin-ping');
      configureApi({
        getToken,
        onUnauthorized: () => {},
        onForbidden: () => {},
        onNetworkError: () => {},
        onNetworkRecovered: () => {},
      });
      const api = mockApi({
        'GET /api/admin/ping': { body: { ok: true } },
      });

      const res = await adminPing().finally(resetApi);
      expect(res).toEqual({ ok: true });

      const call = api.calls.find((c) => c.path === '/api/admin/ping');
      expect(call).toBeDefined();
      expect(call?.headers.Authorization).toBe('Bearer jwt-admin-ping');
    });
  });
});
