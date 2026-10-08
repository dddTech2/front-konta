import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../auth/session';
import {
  ADMIN_CLIENT_DETAIL,
  ADMIN_CLIENTS,
} from '../../test/fixtures';
import { ME_ADMIN, mockApi, renderApp, resetSession } from '../../test/utils';

beforeEach(() => {
  resetSession();
  setToken('jwt-admin');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLIENT_UNLINKED = {
  ...ADMIN_CLIENT_DETAIL,
  business: {
    ...ADMIN_CLIENT_DETAIL.business,
    id: 'biz-unlinked',
    commercial_name: 'Cafetería Central',
  },
  contact: {
    ...ADMIN_CLIENT_DETAIL.contact,
    full_name: 'María Gómez',
    phone: '3109876543',
    is_telegram_linked: false,
    telegram_chat_id: null,
    telegram_username: null,
  },
};

const CLIENT_MANUAL = {
  ...ADMIN_CLIENT_DETAIL,
  business: {
    ...ADMIN_CLIENT_DETAIL.business,
    id: 'biz-manual',
    commercial_name: 'Ferretería El Tornillo',
    income_source: 'MANUAL_SALES',
  },
};

describe('Story 8.6: Panel admin — crear cliente, pagos y configuración', () => {
  describe('Nuevo cliente (/admin/clientes/nuevo) - AC #1', () => {
    it('crear persona: envía el cuerpo correcto, muestra pantalla de éxito, enlace y copia', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'POST /api/admin/clients': {
          status: 201,
          body: {
            business_id: 'biz-new-1',
            user_id: 'usr-new-1',
            activation_link: 'https://t.me/KontableBot?start=tok-persona-123',
          },
        },
      });

      renderApp('/admin/clientes/nuevo');

      expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument();

      // Selector de persona ya está activo por defecto
      const inputNombre = screen.getByLabelText('Nombre completo');
      const inputCelular = screen.getByLabelText('Celular');
      const inputCedula = screen.getByLabelText('Cédula de ciudadanía');
      const selectPlan = screen.getByLabelText('Plan');
      const selectOrigen = screen.getByLabelText('Tipo de negocio');

      await user.type(inputNombre, 'Carlos Gómez');
      await user.type(inputCelular, '3001234567');
      await user.type(inputCedula, '10203040');
      await user.selectOptions(selectPlan, 'TRIMESTRAL');
      await user.selectOptions(selectOrigen, 'DIAN');

      const submitBtn = screen.getByRole('button', { name: 'Crear cliente' });
      await user.click(submitBtn);

      await waitFor(() => {
        const postCall = api.calls.find((c) => c.method === 'POST' && c.path === '/api/admin/clients');
        expect(postCall).toBeDefined();
        expect(postCall?.body).toEqual({
          person_type: 'PERSONA',
          contact_name: 'Carlos Gómez',
          phone: '3001234567',
          document_number: '10203040',
          plan: 'TRIMESTRAL',
          income_source: 'DIAN',
        });
      });

      // Pantalla de éxito con enlace de activación
      expect(await screen.findByRole('heading', { name: 'Cliente creado exitosamente' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://t.me/KontableBot?start=tok-persona-123')).toBeInTheDocument();

      // Enlace a WhatsApp
      const waBtn = screen.getByRole('link', { name: 'Enviar por WhatsApp' });
      expect(waBtn).toHaveAttribute('href', expect.stringContaining('wa.me/573001234567'));
      expect(waBtn).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('https://t.me/KontableBot?start=tok-persona-123')));

      // Enlace a la ficha
      const fichaLink = screen.getByRole('link', { name: 'Ver ficha del cliente' });
      expect(fichaLink).toHaveAttribute('href', '/admin/clientes/biz-new-1');

      // Botón Copiar
      const copyBtn = screen.getByRole('button', { name: 'Copiar' });
      await user.click(copyBtn);
      expect(writeText).toHaveBeenCalledWith('https://t.me/KontableBot?start=tok-persona-123');
      expect(await screen.findByText('¡Copiado!')).toBeInTheDocument();
    });

    it('crear empresa: envía el cuerpo correcto para persona jurídica y muestra éxito', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'POST /api/admin/clients': {
          status: 201,
          body: {
            business_id: 'biz-emp-1',
            user_id: 'usr-emp-1',
            activation_link: 'https://t.me/KontableBot?start=tok-empresa-456',
          },
        },
      });

      renderApp('/admin/clientes/nuevo');

      await screen.findByRole('heading', { name: 'Nuevo cliente' });

      // Cambia a Empresa
      const btnEmpresa = screen.getByRole('radio', { name: 'Empresa' });
      await user.click(btnEmpresa);

      // Campos específicos de Empresa
      const inputContacto = screen.getByLabelText('Nombre de contacto');
      const inputCelular = screen.getByLabelText('Celular');
      const inputRazon = screen.getByLabelText('Nombre de la empresa / Razón social');
      const inputNit = screen.getByLabelText('NIT');
      const inputRepDoc = screen.getByLabelText('Cédula del representante legal');
      const selectPlan = screen.getByLabelText('Plan');
      const selectOrigen = screen.getByLabelText('Tipo de negocio');

      await user.type(inputContacto, 'Laura Restrepo');
      await user.type(inputCelular, '3157654321');
      await user.type(inputRazon, 'Distribuidora del Norte SAS');
      await user.type(inputNit, '901999888');
      await user.type(inputRepDoc, '52345678');
      await user.selectOptions(selectPlan, 'SEMESTRAL');
      await user.selectOptions(selectOrigen, 'MANUAL_SALES');

      const submitBtn = screen.getByRole('button', { name: 'Crear cliente' });
      await user.click(submitBtn);

      await waitFor(() => {
        const postCall = api.calls.find((c) => c.method === 'POST' && c.path === '/api/admin/clients');
        expect(postCall).toBeDefined();
        expect(postCall?.body).toEqual({
          person_type: 'EMPRESA',
          contact_name: 'Laura Restrepo',
          phone: '3157654321',
          company_name: 'Distribuidora del Norte SAS',
          nit: '901999888',
          legal_rep_doc: '52345678',
          plan: 'SEMESTRAL',
          income_source: 'MANUAL_SALES',
        });
      });

      expect(await screen.findByRole('heading', { name: 'Cliente creado exitosamente' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://t.me/KontableBot?start=tok-empresa-456')).toBeInTheDocument();
    });

    it('error 409 de NIT duplicado muestra mensaje legible y conserva el formulario', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'POST /api/admin/clients': {
          status: 409,
          body: {
            detail: 'Ya existe un negocio registrado con el NIT 900123456.',
            code: 'NIT_ALREADY_EXISTS',
          },
        },
      });

      renderApp('/admin/clientes/nuevo');

      await screen.findByRole('heading', { name: 'Nuevo cliente' });

      await user.click(screen.getByRole('radio', { name: 'Empresa' }));

      await user.type(screen.getByLabelText('Nombre de contacto'), 'Carlos Pérez');
      await user.type(screen.getByLabelText('Celular'), '3001112233');
      await user.type(screen.getByLabelText('Nombre de la empresa / Razón social'), 'La Espiga SAS');
      await user.type(screen.getByLabelText('NIT'), '900123456');
      await user.type(screen.getByLabelText('Cédula del representante legal'), '80123456');

      await user.click(screen.getByRole('button', { name: 'Crear cliente' }));

      // Error legible se muestra en un alert
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Ya existe un negocio registrado con el NIT 900123456.');

      // Los campos conservan todo lo escrito
      expect(screen.getByLabelText('Nombre de contacto')).toHaveValue('Carlos Pérez');
      expect(screen.getByLabelText('Celular')).toHaveValue('3001112233');
      expect(screen.getByLabelText('Nombre de la empresa / Razón social')).toHaveValue('La Espiga SAS');
      expect(screen.getByLabelText('NIT')).toHaveValue('900123456');
      expect(screen.getByLabelText('Cédula del representante legal')).toHaveValue('80123456');
    });

    it('validación en cliente para campos obligatorios vacíos', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
      });

      renderApp('/admin/clientes/nuevo');

      await screen.findByRole('heading', { name: 'Nuevo cliente' });

      // Intento de envío sin llenar campos
      await user.click(screen.getByRole('button', { name: 'Crear cliente' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('El nombre del cliente es obligatorio.');
      expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    });

    it('botón en Clientes (/admin/clientes) navega a /admin/clientes/nuevo (AC #1)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
      });

      renderApp('/admin/clientes');

      const nuevoLink = await screen.findByRole('link', { name: 'Nuevo cliente' });
      expect(nuevoLink).toHaveAttribute('href', '/admin/clientes/nuevo');
    });
  });

  describe('Confirmar pago en la ficha (AC #2)', () => {
    it('muestra formato en pesos mientras escribe, confirmación previa y recarga la ficha', async () => {
      const user = userEvent.setup();
      const updatedClient = {
        ...ADMIN_CLIENT_DETAIL,
        subscription: {
          ...ADMIN_CLIENT_DETAIL.subscription!,
          cutoff_date: '2027-01-12',
          status: 'ACTIVO',
        },
        recent_payments: [
          {
            id: 'pay-new',
            payment_date: '2026-10-07',
            amount: '270000.00',
            reference_code: 'REF-PAGO-999',
            payment_method: 'TRANSFERENCIA',
            verified_by_admin_id: 'adm-1',
            created_at: '2026-10-07T19:00:00',
          },
          ...ADMIN_CLIENT_DETAIL.recent_payments,
        ],
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'POST /api/admin/clients/biz-1/payments': {
          status: 201,
          body: {
            payment: {
              id: 'pay-new',
              amount: '270000.00',
              payment_date: '2026-10-07',
              reference_code: 'REF-PAGO-999',
            },
            new_cutoff_date: '2027-01-12',
            status: 'ACTIVO',
            client_notified: true,
          },
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      // Clic en "Registrar pago"
      const regPaymentBtn = screen.getByRole('button', { name: 'Registrar pago' });
      await user.click(regPaymentBtn);

      // Diálogo abierto con role="dialog"
      const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });
      expect(dialog).toBeInTheDocument();

      const inputAmount = within(dialog).getByLabelText('Monto del pago');
      const inputRef = within(dialog).getByLabelText('Referencia de pago');

      // Mientras teclea, se muestra el formato en pesos
      await user.type(inputAmount, '270000');
      expect(within(dialog).getByText(/Formato: \$270\.000/)).toBeInTheDocument();

      await user.type(inputRef, 'REF-PAGO-999');

      // Clic en "Continuar" para confirmación previa
      const btnContinuar = within(dialog).getByRole('button', { name: 'Continuar' });
      await user.click(btnContinuar);

      // Confirmación previa: "Registrar pago de $X a <negocio>"
      expect(
        // Solo el párrafo de confirmación: sus contenedores también contienen el mismo texto.
        within(dialog).getByText((_, el) =>
          Boolean(
            el?.classList.contains('admin-confirm-text') &&
              /Registrar pago de\s+\$270\.000\s+a\s+Panadería La Espiga/.test(el.textContent ?? ''),
          ),
        ),
      ).toBeInTheDocument();

      // Cambiamos el mock de get para simular la recarga de la ficha tras el pago
      api.set('GET /api/admin/clients/biz-1', { body: updatedClient });

      const btnConfirmar = within(dialog).getByRole('button', { name: 'Confirmar' });
      await user.click(btnConfirmar);

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/payments',
        );
        expect(postCall).toBeDefined();
        expect(postCall?.body).toEqual({
          amount: 270000,
          reference: 'REF-PAGO-999',
        });
      });

      // El diálogo se cierra
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // La ficha se recargó y muestra la nueva fecha de corte y el nuevo pago
      expect(await screen.findByText('REF-PAGO-999')).toBeInTheDocument();
      expect(screen.getByText('12 ene 2027')).toBeInTheDocument();
    });

    it('protección contra doble envío: clic rápido no duplica la petición a la API (AC #5)', async () => {
      const user = userEvent.setup();
      let resolvePayment: (val: any) => void;
      const paymentPromise = new Promise((resolve) => {
        resolvePayment = resolve;
      });

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'POST /api/admin/clients/biz-1/payments': () =>
          paymentPromise.then(() => ({
            status: 201,
            body: {
              payment: { id: 'p1', amount: '100000', payment_date: '2026-10-07' },
              new_cutoff_date: '2027-01-12',
              status: 'ACTIVO',
              client_notified: false,
            },
          })),
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });

      await user.type(within(dialog).getByLabelText('Monto del pago'), '100000');
      await user.type(within(dialog).getByLabelText('Referencia de pago'), 'REF-DOUBLE');
      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));

      const btnConfirmar = within(dialog).getByRole('button', { name: 'Confirmar' });

      // Doble clic inmediato
      await user.click(btnConfirmar);
      await user.click(btnConfirmar);

      // Desbloquea la promesa
      resolvePayment!({ ok: true });

      await waitFor(() => {
        const calls = api.calls.filter(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/payments',
        );
        expect(calls).toHaveLength(1);
      });
    });
  });

  describe('Tipo de negocio y perfil tributario (AC #3)', () => {
    it('cambiar tipo de negocio envía PATCH y recarga la ficha', async () => {
      const user = userEvent.setup();
      const updatedClient = {
        ...ADMIN_CLIENT_DETAIL,
        business: {
          ...ADMIN_CLIENT_DETAIL.business,
          income_source: 'MANUAL_SALES',
        },
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'PATCH /api/admin/clients/biz-1/income-source': {
          status: 200,
          body: updatedClient,
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      // Botón "Cambiar" junto a Origen de ingresos
      const btnCambiar = screen.getByRole('button', { name: 'Cambiar' });
      await user.click(btnCambiar);

      const dialog = screen.getByRole('dialog', { name: 'Cambiar origen de ingresos' });
      expect(dialog).toBeInTheDocument();

      const selectOrigen = within(dialog).getByLabelText('Origen de ingresos');
      expect(selectOrigen).toHaveValue('DIAN');

      await user.selectOptions(selectOrigen, 'MANUAL_SALES');

      // Actualizamos mock de GET para la recarga
      api.set('GET /api/admin/clients/biz-1', { body: updatedClient });

      const btnGuardar = within(dialog).getByRole('button', { name: 'Guardar' });
      await user.click(btnGuardar);

      await waitFor(() => {
        const patchCall = api.calls.find(
          (c) => c.method === 'PATCH' && c.path === '/api/admin/clients/biz-1/income-source',
        );
        expect(patchCall).toBeDefined();
        expect(patchCall?.body).toEqual({ income_source: 'MANUAL_SALES' });
      });

      // Se cierra el diálogo y la ficha ahora muestra Ventas manuales
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(screen.getAllByText('Ventas manuales').length).toBeGreaterThan(0);
    });

    it('perfil tributario está oculto para clientes con ventas manuales (AC #3)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-manual': { body: CLIENT_MANUAL },
      });

      renderApp('/admin/clientes/biz-manual');

      await screen.findByRole('heading', { name: 'Ferretería El Tornillo' });

      // No debe existir el encabezado ni tarjeta "Perfil tributario"
      expect(screen.queryByRole('heading', { name: 'Perfil tributario' })).not.toBeInTheDocument();
    });

    it('editar perfil tributario para clientes DIAN con valores preseleccionados y PATCH', async () => {
      const user = userEvent.setup();
      const updatedClient = {
        ...ADMIN_CLIENT_DETAIL,
        tax_profile: {
          iva_periodicity: 'CUATRIMESTRAL',
          is_withholding_agent: false,
        },
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'PATCH /api/admin/clients/biz-1/tax-profile': {
          status: 200,
          body: updatedClient,
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      expect(screen.getByRole('heading', { name: 'Perfil tributario' })).toBeInTheDocument();

      const btnEditar = screen.getByRole('button', { name: 'Editar perfil' });
      await user.click(btnEditar);

      const dialog = screen.getByRole('dialog', { name: 'Editar perfil tributario' });
      expect(dialog).toBeInTheDocument();

      const selectIva = within(dialog).getByLabelText('Periodicidad de IVA');
      const checkRet = within(dialog).getByLabelText('Agente de retención en la fuente');

      // Valores preseleccionados
      expect(selectIva).toHaveValue('BIMESTRAL');
      expect(checkRet).toBeChecked();

      // Cambiar a Cuatrimestral y desmarcar retención
      await user.selectOptions(selectIva, 'CUATRIMESTRAL');
      await user.click(checkRet);
      expect(checkRet).not.toBeChecked();

      api.set('GET /api/admin/clients/biz-1', { body: updatedClient });

      const btnGuardar = within(dialog).getByRole('button', { name: 'Guardar' });
      await user.click(btnGuardar);

      await waitFor(() => {
        const patchCall = api.calls.find(
          (c) => c.method === 'PATCH' && c.path === '/api/admin/clients/biz-1/tax-profile',
        );
        expect(patchCall).toBeDefined();
        expect(patchCall?.body).toEqual({
          iva_periodicity: 'CUATRIMESTRAL',
          is_withholding_agent: false,
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      expect(screen.getByText('CUATRIMESTRAL')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });
  });

  describe('Telegram (AC #4)', () => {
    it('cliente sin vincular: generar enlace de activación muestra enlace, botón copiar y whatsapp', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-unlinked': { body: CLIENT_UNLINKED },
        'POST /api/admin/clients/biz-unlinked/activation-link': {
          status: 200,
          body: {
            activation_link: 'https://t.me/KontableBot?start=tok-act-789',
          },
        },
      });

      renderApp('/admin/clientes/biz-unlinked');

      await screen.findByRole('heading', { name: 'Cafetería Central' });

      expect(screen.getByText('Sin vincular')).toBeInTheDocument();

      const btnGenerar = screen.getByRole('button', { name: 'Generar enlace de activación' });
      await user.click(btnGenerar);

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-unlinked/activation-link',
        );
        expect(postCall).toBeDefined();
      });

      const dialog = await screen.findByRole('dialog', { name: 'Enlace de activación de Telegram' });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByDisplayValue('https://t.me/KontableBot?start=tok-act-789')).toBeInTheDocument();

      // Botón WhatsApp
      const waLink = within(dialog).getByRole('link', { name: 'Enviar por WhatsApp' });
      expect(waLink).toHaveAttribute('href', expect.stringContaining('wa.me/573109876543'));
      expect(waLink).toHaveAttribute('href', expect.stringContaining(encodeURIComponent('https://t.me/KontableBot?start=tok-act-789')));

      // Botón Copiar
      const btnCopiar = within(dialog).getByRole('button', { name: 'Copiar' });
      await user.click(btnCopiar);
      expect(writeText).toHaveBeenCalledWith('https://t.me/KontableBot?start=tok-act-789');
      expect(await within(dialog).findByText('¡Copiado!')).toBeInTheDocument();
    });

    it('cliente vinculado: desvincular Telegram muestra confirmación de consecuencias y envía petición', async () => {
      const user = userEvent.setup();
      const updatedClient = {
        ...ADMIN_CLIENT_DETAIL,
        contact: {
          ...ADMIN_CLIENT_DETAIL.contact,
          is_telegram_linked: false,
          telegram_chat_id: null,
          telegram_username: null,
        },
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'POST /api/admin/clients/biz-1/release-telegram': {
          status: 200,
          body: updatedClient,
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      const btnDesvincular = screen.getByRole('button', { name: 'Desvincular Telegram' });
      await user.click(btnDesvincular);

      // Confirmación con advertencia de consecuencias
      const dialog = screen.getByRole('dialog', { name: 'Desvincular Telegram' });
      expect(dialog).toBeInTheDocument();
      expect(
        within(dialog).getByText(/El cliente dejará de recibir alertas de vencimiento/),
      ).toBeInTheDocument();

      api.set('GET /api/admin/clients/biz-1', { body: updatedClient });

      const btnConfirmar = within(dialog).getByRole('button', { name: 'Desvincular' });
      await user.click(btnConfirmar);

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/release-telegram',
        );
        expect(postCall).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Ficha recargada ahora muestra "Sin vincular"
      expect(await screen.findByText('Sin vincular')).toBeInTheDocument();
    });
  });

  describe('Accesibilidad y tecla Escape (AC #5)', () => {
    it('tecla Escape cierra el diálogo modal accesible', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));

      const dialog = screen.getByRole('dialog', { name: 'Registrar pago' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      // Presiona Escape
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
