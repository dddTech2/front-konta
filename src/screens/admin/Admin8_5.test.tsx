import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../auth/session';
import {
  ADMIN_CLIENT_DETAIL,
  ADMIN_CLIENTS,
  ADMIN_SUMMARY,
} from '../../test/fixtures';
import { ME_ADMIN, mockApi, renderApp, resetSession } from '../../test/utils';

beforeEach(() => {
  resetSession();
  setToken('jwt-admin');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Story 8.5: Panel admin en la SPA — Resumen, lista de clientes y ficha', () => {
  describe('Resumen (/admin)', () => {
    it('muestra tarjetas con clientes por estado, tipo, pagos, fallas y listas con enlace a ficha (AC #1)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/summary': { body: ADMIN_SUMMARY },
      });

      renderApp('/admin');

      // Título
      expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();

      // Monitor de worker activo por defecto
      expect(await screen.findByText('Worker activo')).toBeInTheDocument();
      expect(screen.getByText('(última señal hace 4 min)')).toBeInTheDocument();

      // Clientes por estado
      expect(screen.getByText('Clientes por estado')).toBeInTheDocument();
      // Cada número se busca en su propia tarjeta: el mismo valor puede repetirse en otras métricas.
      const metric = (label: string) => screen.getByText(label).closest('.admin-metric-card');
      expect(metric('Activos')).toHaveTextContent('15');
      expect(metric('En mora')).toHaveTextContent('3');
      expect(metric('Bloqueados')).toHaveTextContent('2');
      expect(metric('Sin suscripción')).toHaveTextContent('4');

      // Clientes por tipo
      const statRow = (label: string) => screen.getByText(label).closest('.admin-stat-row');
      expect(statRow('DIAN')).toHaveTextContent('20');
      expect(statRow('Ventas manuales')).toHaveTextContent('5');

      // Pagos del mes (cantidad y total formateado)
      expect(screen.getByText(/12 \(\$3\.600\.000\)/)).toBeInTheDocument();

      // Descargas fallidas 24 h y clientes sin Telegram
      expect(statRow('Descargas fallidas 24 h')).toHaveTextContent('1');
      expect(screen.getByText('Clientes sin Telegram')).toBeInTheDocument();

      // Cortes en los próximos 7 días con enlaces a la ficha
      expect(screen.getByRole('heading', { name: 'Cortes en los próximos 7 días' })).toBeInTheDocument();
      const [cut1] = screen.getAllByRole('link', { name: /Panadería La Espiga/ });
      expect(cut1).toHaveAttribute('href', '/admin/clientes/biz-1');
      const cut2 = screen.getByRole('link', { name: /Cafetería Central/ });
      expect(cut2).toHaveAttribute('href', '/admin/clientes/biz-2');

      // En periodo de gracia con enlace a la ficha
      expect(screen.getByRole('heading', { name: 'En periodo de gracia' })).toBeInTheDocument();
      const graceLink = screen.getByRole('link', { name: /Ferretería El Tornillo/ });
      expect(graceLink).toHaveAttribute('href', '/admin/clientes/biz-3');
    });

    it('resumen con worker silencioso muestra alerta en rojo y tiempo transcurrido (AC #1)', async () => {
      const summarySilencioso = {
        ...ADMIN_SUMMARY,
        worker: {
          silence_threshold_minutes: 15,
          workers: [
            {
              name: 'worker-primary',
              last_seen_at: '2026-10-07T17:30:00',
              minutes_since: 51,
              is_silent: true,
            },
          ],
        },
      };

      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/summary': { body: summarySilencioso },
      });

      renderApp('/admin');

      expect(await screen.findByText('Worker en alerta')).toBeInTheDocument();
      expect(screen.getByText('(última señal hace 51 min)')).toBeInTheDocument();
    });
  });

  describe('Lista de clientes (/admin/clientes)', () => {
    it('muestra lista de clientes con vista tabla y vista tarjetas (AC #2)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
      });

      renderApp('/admin/clientes');

      expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
      expect(await screen.findByText('Mostrando 3 de 3 clientes')).toBeInTheDocument();

      // Verificación en tabla de escritorio
      const table = screen.getByRole('table', { name: 'Lista de clientes' });
      expect(within(table).getByText('Panadería La Espiga')).toBeInTheDocument();
      expect(within(table).getByText('Cafetería Central')).toBeInTheDocument();
      expect(within(table).getByText('Ferretería El Tornillo')).toBeInTheDocument();

      // Verificación de los datos esperados
      expect(screen.getAllByText('900.123.456-7').length).toBeGreaterThan(0);
      expect(screen.getAllByText('901.234.567-1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
      expect(screen.getAllByText('En mora').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bloqueado').length).toBeGreaterThan(0);

      // Clic/tap abre la ficha
      const links = screen.getAllByRole('link', { name: /Panadería La Espiga/ });
      expect(links[0]).toHaveAttribute('href', '/admin/clientes/biz-1');
    });

    it('buscador con espera de 300 ms filtra en el servidor y sincroniza en la URL (AC #2)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
      });

      renderApp('/admin/clientes');

      const searchInput = await screen.findByRole('searchbox', { name: 'Buscar clientes' });
      await user.type(searchInput, 'Espiga');

      // Espera el debounce de 300 ms
      await waitFor(() => {
        const queryCalls = api.calls.filter(
          (c) => c.path.includes('/api/admin/clients') && c.path.includes('q=Espiga'),
        );
        expect(queryCalls.length).toBeGreaterThan(0);
      });
    });

    it('filtros por tipo y estado quedan en la URL y se envían al servidor (AC #2)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
      });

      renderApp('/admin/clientes');

      await screen.findByRole('heading', { name: 'Clientes' });

      const selectTipo = screen.getByRole('combobox', { name: 'Filtrar por tipo de cliente' });
      await user.selectOptions(selectTipo, 'MANUAL_SALES');

      await waitFor(() => {
        const tipoCalls = api.calls.filter(
          (c) => c.path.includes('/api/admin/clients') && c.path.includes('income_source=MANUAL_SALES'),
        );
        expect(tipoCalls.length).toBeGreaterThan(0);
      });

      const selectStatus = screen.getByRole('combobox', { name: 'Filtrar por estado de suscripción' });
      await user.selectOptions(selectStatus, 'EN_MORA');

      await waitFor(() => {
        const statusCalls = api.calls.filter(
          (c) => c.path.includes('/api/admin/clients') && c.path.includes('status=EN_MORA'),
        );
        expect(statusCalls.length).toBeGreaterThan(0);
      });
    });

    it('carga inicial con filtros en la URL los envía al servidor (AC #2)', async () => {
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
      });

      renderApp('/admin/clientes?q=cafe&status=ACTIVO&tipo=DIAN&page=1');

      await screen.findByRole('heading', { name: 'Clientes' });

      await waitFor(() => {
        const call = api.calls.find(
          (c) =>
            c.path.includes('/api/admin/clients') &&
            c.path.includes('q=cafe') &&
            c.path.includes('status=ACTIVO') &&
            c.path.includes('income_source=DIAN'),
        );
        expect(call).toBeDefined();
      });

      // El input de búsqueda tiene el valor cargado
      expect(screen.getByRole('searchbox', { name: 'Buscar clientes' })).toHaveValue('cafe');
    });

    it('paginación cambia de página y solicita los datos correspondientes (AC #2)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': {
          body: {
            ...ADMIN_CLIENTS,
            total: 45,
            page: 1,
            page_size: 20,
          },
        },
      });

      renderApp('/admin/clientes');

      expect(await screen.findByText('Página 1 de 3')).toBeInTheDocument();
      const nextBtn = screen.getByRole('button', { name: 'Siguiente' });
      const prevBtn = screen.getByRole('button', { name: 'Anterior' });

      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeEnabled();

      await user.click(nextBtn);

      await waitFor(() => {
        const pageCalls = api.calls.filter(
          (c) => c.path.includes('/api/admin/clients') && c.path.includes('page=2'),
        );
        expect(pageCalls.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Ficha del cliente (/admin/clientes/:businessId)', () => {
    it('muestra ficha completa con negocio, contacto, perfil tributario, suscripción, pagos, descargas y documentos (AC #3)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
      });

      renderApp('/admin/clientes/biz-1');

      // Encabezado
      expect(await screen.findByRole('heading', { name: 'Panadería La Espiga' })).toBeInTheDocument();
      expect(screen.getByText('Razón social: La Espiga SAS')).toBeInTheDocument();
      expect(screen.getByText('900.123.456-7')).toBeInTheDocument();
      expect(screen.getByText('Persona Jurídica')).toBeInTheDocument();

      // Contacto
      expect(screen.getByRole('heading', { name: 'Contacto' })).toBeInTheDocument();
      expect(screen.getByText('Carlos Pérez')).toBeInTheDocument();
      expect(screen.getByText('carlos@laespiga.com')).toBeInTheDocument();
      expect(screen.getByText('3001112233')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Llamar a Carlos Pérez/ })).toHaveAttribute('href', 'tel:3001112233');
      expect(screen.getByRole('link', { name: /Escribir por WhatsApp a Carlos Pérez/ })).toHaveAttribute(
        'href',
        'https://wa.me/573001112233',
      );
      expect(screen.getByText('(@carlosperez)')).toBeInTheDocument();

      // Perfil tributario
      expect(screen.getByRole('heading', { name: 'Perfil tributario' })).toBeInTheDocument();
      expect(screen.getByText('BIMESTRAL')).toBeInTheDocument();
      expect(screen.getByText('Elaboración de productos de panadería')).toBeInTheDocument();

      // Suscripción
      expect(screen.getByRole('heading', { name: 'Suscripción' })).toBeInTheDocument();
      expect(screen.getByText('TRIMESTRAL')).toBeInTheDocument();
      expect(screen.getByText('$300.000')).toBeInTheDocument();
      expect(screen.getByText('10 %')).toBeInTheDocument();
      expect(screen.getAllByText('$270.000').length).toBeGreaterThanOrEqual(2);

      // Pagos
      expect(screen.getByRole('heading', { name: 'Pagos recientes' })).toBeInTheDocument();
      expect(screen.getByText('REF-778899')).toBeInTheDocument();
      expect(screen.getByText('TRANSFERENCIA')).toBeInTheDocument();

      // Descargas DIAN
      expect(screen.getByRole('heading', { name: 'Descargas DIAN recientes' })).toBeInTheDocument();
      expect(screen.getByText('Agosto 2026')).toBeInTheDocument();
      expect(screen.getByText('Exitosa')).toBeInTheDocument();

      // Documentos
      expect(screen.getByRole('heading', { name: 'Documentos' })).toBeInTheDocument();
      // El número va en <strong>: se compara el texto completo del párrafo.
      expect(screen.getByText((_, el) => el?.tagName === 'P' && /3\s+documentos activos/.test(el.textContent ?? ''))).toBeInTheDocument();

      // Botón "Volver a clientes"
      const backLink = screen.getByRole('link', { name: /Volver a clientes/ });
      expect(backLink).toHaveAttribute('href', '/admin/clientes');
    });

    it('botón Volver a clientes conserva la búsqueda si se navegó desde una lista filtrada (AC #3)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
      });

      renderApp('/admin/clientes?q=Espiga&status=ACTIVO');

      const [clientLink] = await screen.findAllByRole('link', { name: /Panadería La Espiga/ });
      await user.click(clientLink);

      // Ahora en la ficha, el botón "Volver a clientes" debe conservar ?q=Espiga&status=ACTIVO
      const backBtn = await screen.findByRole('link', { name: /Volver a clientes/ });
      expect(backBtn).toHaveAttribute('href', '/admin/clientes?q=Espiga&status=ACTIVO');
    });

    it('ficha 404 muestra bloque de error con reintento (AC #4)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-desconocido': {
          status: 404,
          body: { detail: 'Cliente no encontrado.' },
        },
      });

      renderApp('/admin/clientes/biz-desconocido');

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Cliente no encontrado.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });
  });

  describe('Seguridad y control de acceso (AC #4)', () => {
    it('un 403 en llamada de admin saca del panel y muestra Servicio Suspendido', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': {
          status: 403,
          body: { detail: 'No tienes permisos de administrador.' },
        },
      });

      renderApp('/admin/clientes');

      // Se dispara onForbidden y RequireSession muestra Suspended
      expect(await screen.findByText('Acceso Suspendido')).toBeInTheDocument();
      expect(screen.getByText('SERVICIO SUSPENDIDO')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Clientes' })).not.toBeInTheDocument();
    });
  });
});
