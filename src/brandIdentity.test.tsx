import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BRAND_NAME } from './brand';
import { setToken } from './auth/session';
import { ME_ADMIN, ME_OK, mockApi, renderApp, resetSession } from './test/utils';

beforeEach(() => {
  resetSession();
});

describe('Identidad visual (Story 7.5)', () => {
  describe('Login (AC #3, #5, #6)', () => {
    it('muestra isotipo claro en brand-mark de 64x64 y logotipo horizontal con alt en el pie', () => {
      mockApi({});
      const { container } = renderApp('/login');

      // AC #3 y #6: brand-mark como <img> con isotipoClaro, decorativa (alt="" y aria-hidden="true")
      const brandMark = container.querySelector('img.brand-mark');
      expect(brandMark).toBeInTheDocument();
      expect(brandMark).toHaveAttribute('src', expect.stringContaining('isotipo-claro.svg'));
      expect(brandMark).toHaveAttribute('alt', '');
      expect(brandMark).toHaveAttribute('aria-hidden', 'true');
      expect(brandMark).toHaveAttribute('width', '64');
      expect(brandMark).toHaveAttribute('height', '64');

      // AC #5: pie con "Un servicio de" y logotipo horizontal descriptivo
      const footer = container.querySelector('footer.login-brand-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent('Un servicio de');

      const footerLogo = screen.getByRole('img', {
        name: 'Katerinn Romero — Asesoría contable, tributaria y financiera',
      });
      expect(footerLogo).toBeInTheDocument();
      expect(footerLogo).toHaveClass('login-brand-logo');
      expect(footerLogo).toHaveAttribute('src', expect.stringContaining('logotipo-horizontal-claro.svg'));
    });
  });

  describe('SinNegocio (AC #3, #6)', () => {
    it('muestra isotipo claro en brand-mark de 64x64 como imagen decorativa', async () => {
      setToken('jwt-1');
      mockApi({
        'GET /api/auth/me': { body: { ...ME_OK, business_id: null, is_provisioned: false } },
      });

      const { container } = renderApp('/inicio');
      expect(await screen.findByRole('heading', { name: 'Estamos preparando tu cuenta' })).toBeInTheDocument();

      const brandMark = container.querySelector('img.brand-mark');
      expect(brandMark).toBeInTheDocument();
      expect(brandMark).toHaveAttribute('src', expect.stringContaining('isotipo-claro.svg'));
      expect(brandMark).toHaveAttribute('alt', '');
      expect(brandMark).toHaveAttribute('aria-hidden', 'true');
      expect(brandMark).toHaveAttribute('width', '64');
      expect(brandMark).toHaveAttribute('height', '64');
    });
  });

  describe('Encabezado del cliente (AC #4, #6, #8)', () => {
    it('muestra isotipo oscuro (shell-logo de 32x32) delante de BRAND_NAME', async () => {
      setToken('jwt-1');
      mockApi({ 'GET /api/auth/me': { body: ME_OK } });

      const { container } = renderApp('/inicio');
      await screen.findByRole('navigation', { name: 'Secciones' });

      const header = container.querySelector('.shell-header');
      expect(header).toBeInTheDocument();

      const logo = header?.querySelector('img.shell-logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', expect.stringContaining('isotipo-oscuro.svg'));
      expect(logo).toHaveAttribute('alt', '');
      expect(logo).toHaveAttribute('aria-hidden', 'true');
      expect(logo).toHaveAttribute('width', '32');
      expect(logo).toHaveAttribute('height', '32');

      const brandSpan = header?.querySelector('.shell-brand');
      expect(brandSpan).toBeInTheDocument();
      expect(brandSpan).toHaveTextContent(BRAND_NAME);
    });
  });

  describe('Encabezado de administración (AC #4, #6)', () => {
    it('muestra isotipo oscuro (admin-logo de 32x32) delante de BRAND_NAME', async () => {
      setToken('jwt-admin');
      mockApi({ 'GET /api/auth/me': { body: ME_ADMIN } });

      const { container } = renderApp('/admin');
      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();

      const header = container.querySelector('.admin-header');
      expect(header).toBeInTheDocument();

      const logo = header?.querySelector('img.admin-logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', expect.stringContaining('isotipo-oscuro.svg'));
      expect(logo).toHaveAttribute('alt', '');
      expect(logo).toHaveAttribute('aria-hidden', 'true');
      expect(logo).toHaveAttribute('width', '32');
      expect(logo).toHaveAttribute('height', '32');

      const brandSpan = header?.querySelector('.admin-brand');
      expect(brandSpan).toBeInTheDocument();
      expect(brandSpan).toHaveTextContent(BRAND_NAME);
      expect(screen.getByText('Administración')).toBeInTheDocument();
    });
  });
});
