import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../auth/session';
import {
  ADMIN_CLIENT_DETAIL,
  ADMIN_CLIENTS,
  ADMIN_PRICING,
  ADMIN_PRICING_HISTORY,
  ADMIN_PRICING_QUOTE,
} from '../../test/fixtures';
import { ME_ADMIN, mockApi, renderApp, resetSession } from '../../test/utils';
import { getTodayBogota } from './AdminTarifas';

beforeEach(() => {
  resetSession();
  setToken('jwt-admin');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** El texto de la cotización va partido por `<strong>`: compara el texto completo del párrafo. */
const quoteText = (re: RegExp) => (_: string, el: Element | null) =>
  !!el && el.classList.contains('admin-quote-text') && re.test(el.textContent ?? '');

describe('Story 9.3: Panel web — Tarifas, precio del cliente y aviso de monto', () => {
  describe('Pantalla Tarifas (/admin/tarifas) — AC #1 a #5', () => {
    it('navegación de AdminShell incluye pestaña "Tarifas" después de "Clientes"', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients': { body: ADMIN_CLIENTS },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
      });

      renderApp('/admin/clientes');

      const navTarifas = await screen.findByRole('link', { name: 'Tarifas' });
      expect(navTarifas).toBeInTheDocument();
      expect(navTarifas).toHaveAttribute('href', '/admin/tarifas');
    });

    it('muestra el banner fijo informativo superior (AC #4)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
      });

      renderApp('/admin/tarifas');

      expect(await screen.findByRole('heading', { name: 'Tarifas' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Los cambios aplican a clientes nuevos. Cada cliente conserva su precio; para cambiarlo usa su ficha.',
        ),
      ).toBeInTheDocument();
    });

    it('muestra tarjetas de tarifas vigentes por paquete, fechas de vigencia y botón Cambiar (AC #1)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
      });

      renderApp('/admin/tarifas');

      expect(
        await screen.findByRole('heading', { name: 'Valor mensual por paquete' }),
      ).toBeInTheDocument();

      // Tarifas del fixture (Con IVA y Sin IVA)
      expect(screen.getByRole('heading', { name: 'Con IVA' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sin IVA' })).toBeInTheDocument();
      expect(screen.getAllByText('$120.000').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$100.000').length).toBeGreaterThan(0);

      // Botón "Cambiar" en tarjetas
      const changeButtons = await screen.findAllByRole('button', { name: 'Cambiar' });
      expect(changeButtons).toHaveLength(2);
    });

    it('cambiar tarifa: abre modal, valida y envía POST a /api/admin/pricing/rates (AC #1)', async () => {
      const user = userEvent.setup();
      const updatedPricing = {
        ...ADMIN_PRICING,
        rates: ADMIN_PRICING.rates.map((r) =>
          r.package === 'CON_IVA'
            ? { ...r, monthly_price: '110000.00' }
            : r,
        ),
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'POST /api/admin/pricing/rates': {
          status: 200,
          body: {
            id: 'rate-1',
            package: 'CON_IVA',
            monthly_price: '110000.00',
            effective_from: getTodayBogota(),
          },
        },
      });

      renderApp('/admin/tarifas');

      await screen.findByRole('heading', { name: 'Tarifas' });

      const changeButtons = await screen.findAllByRole('button', { name: 'Cambiar' });
      await user.click(changeButtons[0]);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();

      const inputPrice = within(dialog).getByLabelText('Nuevo valor mensual');
      await user.clear(inputPrice);
      await user.type(inputPrice, '110000');

      const inputDate = within(dialog).getByLabelText('Fecha de vigencia');
      await user.clear(inputDate);
      await user.type(inputDate, getTodayBogota()); // la vigencia no puede ser anterior a hoy

      api.set('GET /api/admin/pricing', { body: updatedPricing });

      const submitBtn = within(dialog).getByRole('button', { name: 'Guardar tarifa' });
      await user.click(submitBtn);

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/pricing/rates',
        );
        expect(postCall).toBeDefined();
        expect(postCall?.body).toEqual({
          package: 'CON_IVA',
          monthly_price: 110000,
          effective_from: getTodayBogota(),
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('tarifas programadas: muestra lista y cancelar abre confirmación y envía DELETE (AC #1)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'DELETE /api/admin/pricing/rates/sched-1': {
          status: 200,
          body: { ok: true },
        },
      });

      renderApp('/admin/tarifas');

      expect(await screen.findByRole('heading', { name: 'Tarifas programadas' })).toBeInTheDocument();
      expect(screen.getByText('$135.000')).toBeInTheDocument();

      const cancelBtn = screen.getByRole('button', { name: 'Cancelar' });
      await user.click(cancelBtn);

      const dialog = await screen.findByRole('dialog', { name: 'Cancelar tarifa programada' });
      expect(dialog).toBeInTheDocument();

      const confirmBtn = within(dialog).getByRole('button', { name: 'Sí, cancelar tarifa' });
      await user.click(confirmBtn);

      await waitFor(() => {
        const delCall = api.calls.find(
          (c) => c.method === 'DELETE' && c.path === '/api/admin/pricing/rates/sched-1',
        );
        expect(delCall).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('ver historial por paquete: abre modal con GET /api/admin/pricing/rates/history (AC #5)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'GET /api/admin/pricing/rates/history': { body: ADMIN_PRICING_HISTORY },
      });

      renderApp('/admin/tarifas');

      await screen.findByRole('heading', { name: 'Tarifas' });

      const historyButtons = await screen.findAllByRole('button', { name: 'Ver historial' });
      await user.click(historyButtons[0]);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();

      expect(await within(dialog).findAllByText('Admin Principal')).toHaveLength(2);
      expect(within(dialog).getByText('$110.000')).toBeInTheDocument();
      expect(within(dialog).getByText('$120.000')).toBeInTheDocument();
    });

    it('planes y descuentos: editar en fila y guardar envía PUT a /api/admin/pricing/plans/{code} (AC #2)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'PUT /api/admin/pricing/plans/TRIMESTRAL': {
          status: 200,
          body: {
            code: 'TRIMESTRAL',
            name: 'Trimestral Promo',
            months: 3,
            discount_rate: 12,
            is_active: true,
          },
        },
      });

      renderApp('/admin/tarifas');

      expect(await screen.findByRole('heading', { name: 'Planes y descuentos' })).toBeInTheDocument();

      const nameInput = screen.getByLabelText('Nombre', { selector: '#plan-name-TRIMESTRAL' });
      const discInput = screen.getByLabelText('Descuento (%)', { selector: '#plan-disc-TRIMESTRAL' });

      await user.clear(nameInput);
      await user.type(nameInput, 'Trimestral Promo');

      await user.clear(discInput);
      await user.type(discInput, '12');

      // Botón guardar de la fila
      const saveButtons = screen.getAllByRole('button', { name: 'Guardar' });
      await user.click(saveButtons[0]);

      await waitFor(() => {
        const putCall = api.calls.find(
          (c) => c.method === 'PUT' && c.path === '/api/admin/pricing/plans/TRIMESTRAL',
        );
        expect(putCall).toBeDefined();
        expect(putCall?.body).toEqual({
          name: 'Trimestral Promo',
          discount_rate: 12,
          is_active: true,
        });
      });
    });

    it('planes y descuentos: muestra error LAST_ACTIVE_PLAN junto a la fila (AC #2)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'PUT /api/admin/pricing/plans/TRIMESTRAL': {
          status: 409,
          body: {
            code: 'LAST_ACTIVE_PLAN',
            detail: 'No puedes desactivar el único plan activo.',
          },
        },
      });

      renderApp('/admin/tarifas');

      await screen.findByRole('heading', { name: 'Planes y descuentos' });

      const activeCheckbox = screen.getByLabelText('Activo', { selector: '#plan-active-TRIMESTRAL' });
      await user.click(activeCheckbox);

      const saveButtons = screen.getAllByRole('button', { name: 'Guardar' });
      await user.click(saveButtons[0]);

      expect(await screen.findByText(/LAST_ACTIVE_PLAN/)).toBeInTheDocument();
    });

    it('nuevo plan: sugiere código, valida y envía POST; maneja error PLAN_EXISTS (AC #2)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'POST /api/admin/pricing/plans': {
          status: 409,
          body: {
            code: 'PLAN_EXISTS',
            detail: 'Ya existe un plan con ese código.',
          },
        },
      });

      renderApp('/admin/tarifas');

      await screen.findByRole('heading', { name: 'Planes y descuentos' });

      const newPlanBtn = screen.getByRole('button', { name: 'Nuevo plan' });
      await user.click(newPlanBtn);

      const dialog = await screen.findByRole('dialog', { name: 'Nuevo plan' });
      expect(dialog).toBeInTheDocument();

      const nameInput = within(dialog).getByLabelText('Nombre del plan');
      await user.type(nameInput, 'Bienvenida Empresa');

      // Sugerencia de código automática
      const codeInput = within(dialog).getByLabelText('Código del plan');
      expect(codeInput).toHaveValue('BIENVENIDA_EMPRESA');

      // Nota de inmutabilidad
      expect(
        within(dialog).getByText(
          'La duración no se puede cambiar después; para otra duración crea otro plan.',
        ),
      ).toBeInTheDocument();

      const submitBtn = within(dialog).getByRole('button', { name: 'Guardar plan' });
      await user.click(submitBtn);

      expect(await within(dialog).findByText(/PLAN_EXISTS/)).toBeInTheDocument();
    });

    it('periodo de gracia: guarda días (1-15) con PUT a /api/admin/pricing/settings y muestra nota (AC #2b)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'PUT /api/admin/pricing/settings': {
          status: 200,
          body: { grace_days: 5 },
        },
      });

      renderApp('/admin/tarifas');

      expect(await screen.findByRole('heading', { name: 'Periodo de gracia' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Aplica a los próximos cortes; los clientes que ya están en gracia conservan su fecha.',
        ),
      ).toBeInTheDocument();

      const graceInput = screen.getByLabelText('Días de gracia antes de bloquear');
      expect(graceInput).toHaveValue(3);

      await user.clear(graceInput);
      await user.type(graceInput, '5');

      const submitBtn = within(graceInput.closest('form') as HTMLElement).getByRole('button', { name: 'Guardar' });
      await user.click(submitBtn);

      await waitFor(() => {
        const putCall = api.calls.find(
          (c) => c.method === 'PUT' && c.path === '/api/admin/pricing/settings',
        );
        expect(putCall).toBeDefined();
        expect(putCall?.body).toEqual({ grace_days: 5 });
      });
    });

    it('lo que paga un cliente nuevo: muestra cotizaciones con valor del periodo y ahorro (AC #3)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
      });

      renderApp('/admin/tarifas');

      expect(
        await screen.findByRole('heading', { name: 'Lo que paga un cliente nuevo' }),
      ).toBeInTheDocument();

      // Cotizaciones con precios calculados y ahorros
      expect(screen.getAllByText('$270.000').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$510.000').length).toBeGreaterThan(0);
      expect(screen.getAllByText('$960.000').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Ahorro: \$30\.000/).length).toBeGreaterThan(0);
    });
  });

  describe('Ficha del cliente (/admin/clientes/:id) — AC #6 a #8', () => {
    it('muestra monthly_price, origen Tarifa o Precio especial con nota, y tarifa vigente si difiere (AC #6)', async () => {
      const clientWithSpecialPrice = {
        ...ADMIN_CLIENT_DETAIL,
        subscription: {
          ...ADMIN_CLIENT_DETAIL.subscription!,
          monthly_price: '85000.00',
          price_origin: 'PRECIO_ESPECIAL' as const,
          price_note: 'Descuento fidelidad 2026',
          current_rate_monthly: '100000.00',
        },
      };

      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: clientWithSpecialPrice },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      // Valor mensual y origen
      expect(screen.getByText('$85.000')).toBeInTheDocument();
      expect(screen.getByText('Precio especial')).toBeInTheDocument();
      expect(screen.getByText('Descuento fidelidad 2026')).toBeInTheDocument();

      // Tarifa vigente hoy en gris cuando difiere
      expect(screen.getByText('Tarifa vigente hoy: $100.000')).toBeInTheDocument();
    });

    it('botón Cambiar precio o plan: abre modal, calcula antes → después y envía PATCH (AC #7)', async () => {
      const user = userEvent.setup();
      const updatedClient = {
        ...ADMIN_CLIENT_DETAIL,
        subscription: {
          ...ADMIN_CLIENT_DETAIL.subscription!,
          final_price: '240000',
        },
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'PATCH /api/admin/clients/biz-1/subscription': {
          status: 200,
          body: updatedClient,
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      const btnChange = screen.getByRole('button', { name: 'Cambiar precio o plan' });
      await user.click(btnChange);

      const dialog = await screen.findByRole('dialog', { name: 'Cambiar precio o plan de suscripción' });
      expect(dialog).toBeInTheDocument();

      // Tres opciones excluyentes
      expect(within(dialog).getByLabelText('Precio especial')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Cambiar plan')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Volver a la tarifa vigente')).toBeInTheDocument();

      // Selección de precio especial
      const inputMonthly = within(dialog).getByLabelText('Nuevo valor mensual');
      await user.clear(inputMonthly);
      await user.type(inputMonthly, '80000');

      // Vista previa informativa del periodo antes → después
      expect(within(dialog).getByText(/Valor del periodo:/)).toBeInTheDocument();
      expect(within(dialog).getByText('Las fechas de corte no cambian.')).toBeInTheDocument();

      // Motivo obligatorio
      const reasonInput = within(dialog).getByLabelText('Motivo del cambio (obligatorio)');
      await user.type(reasonInput, 'Acuerdo especial de cliente antiguo');

      api.set('GET /api/admin/clients/biz-1', { body: updatedClient });

      const submitBtn = within(dialog).getByRole('button', { name: 'Guardar cambio' });
      await user.click(submitBtn);

      await waitFor(() => {
        const patchCall = api.calls.find(
          (c) => c.method === 'PATCH' && c.path === '/api/admin/clients/biz-1/subscription',
        );
        expect(patchCall).toBeDefined();
        expect(patchCall?.body).toMatchObject({
          monthly_price: 80000,
          reason: 'Acuerdo especial de cliente antiguo',
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('historial de cambios de precio: se muestra si hay items y se oculta si está vacío (AC #8)', async () => {
      // Caso 1: Con historial de cambios
      const clientWithHistory = {
        ...ADMIN_CLIENT_DETAIL,
        subscription: {
          ...ADMIN_CLIENT_DETAIL.subscription!,
          price_changes: [
            {
              id: 'pch-1',
              created_at: '2026-08-01T10:00:00',
              old_plan: 'TRIMESTRAL',
              new_plan: 'TRIMESTRAL',
              old_monthly_price: '100000.00',
              new_monthly_price: '100000.00',
              old_discount_rate: '0.00',
              new_discount_rate: '10.00',
              old_final_price: '300000.00',
              new_final_price: '270000.00',
              reason: 'Descuento trimestral inicial',
              admin: 'Katerinn',
            },
          ],
        },
      };

      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: clientWithHistory },
      });

      renderApp('/admin/clientes/biz-1');

      expect(await screen.findByRole('heading', { name: 'Cambios de precio' })).toBeInTheDocument();
      expect(screen.getAllByText(/Descuento trimestral inicial/)[0]).toBeInTheDocument();
      expect(screen.getAllByText('Katerinn')[0]).toBeInTheDocument();
      expect(screen.getAllByText(/\$300\.000 → \$270\.000/)[0]).toBeInTheDocument();
    });

    it('historial de cambios de precio se oculta si la lista está vacía (AC #8)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });
      expect(screen.queryByRole('heading', { name: 'Cambios de precio' })).not.toBeInTheDocument();
    });
  });

  describe('Nuevo cliente (/admin/clientes/nuevo) — AC #9 y #10', () => {
    it('selector de plan se llena con planes activos y cotización dinámica al cambiar plan/tipo (AC #9)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'GET /api/admin/pricing/quote': { body: ADMIN_PRICING_QUOTE },
      });

      renderApp('/admin/clientes/nuevo');

      expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument();

      // Cotización dinámica visible
      expect(
        await screen.findByText(quoteText(/Valor del periodo: \$324\.000 \(valor mensual \$120\.000, descuento 10 %\)/)),
      ).toBeInTheDocument();

      // Cambiar plan dispara cotización con nuevos parámetros
      const selectPlan = screen.getByLabelText('Plan');
      await user.selectOptions(selectPlan, 'SEMESTRAL');
      expect(selectPlan).toHaveValue('SEMESTRAL');
    });

    it('si la cotización responde NO_RATE, muestra el mensaje y deshabilita Crear (AC #9)', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'GET /api/admin/pricing/quote': {
          status: 409,
          body: {
            code: 'NO_RATE',
            detail: 'No hay tarifa configurada para este segmento.',
          },
        },
      });

      renderApp('/admin/clientes/nuevo');

      expect(await screen.findByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument();

      // Mensaje de no rate visible
      expect(
        await screen.findByText('No hay tarifa configurada para este segmento.'),
      ).toBeInTheDocument();

      // Botón crear cliente deshabilitado
      const submitBtn = screen.getByRole('button', { name: 'Crear cliente' });
      expect(submitBtn).toBeDisabled();
    });

    it('pantalla de éxito muestra valor del periodo y fecha de corte devuelta por la API (AC #10)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/pricing': { body: ADMIN_PRICING },
        'GET /api/admin/pricing/quote': { body: ADMIN_PRICING_QUOTE },
        'POST /api/admin/clients': {
          status: 201,
          body: {
            business_id: 'biz-new-price',
            user_id: 'usr-new-price',
            activation_link: 'https://t.me/KontableBot?start=tok-123',
            final_price: '324000.00',
            cutoff_date: '2027-01-15',
          },
        },
      });

      renderApp('/admin/clientes/nuevo');

      await screen.findByRole('heading', { name: 'Nuevo cliente' });

      await user.type(screen.getByLabelText('Nombre completo'), 'Marta Lucía');
      await user.type(screen.getByLabelText('Celular'), '3007654321');
      await user.type(screen.getByLabelText('Cédula de ciudadanía'), '43210987');

      const submitBtn = screen.getByRole('button', { name: 'Crear cliente' });
      await user.click(submitBtn);

      expect(await screen.findByRole('heading', { name: 'Cliente creado exitosamente' })).toBeInTheDocument();
      expect(screen.getByText('$324.000')).toBeInTheDocument();
      expect(screen.getByText('15 ene 2027')).toBeInTheDocument();
    });
  });

  describe('Confirmar pago en la ficha con aviso de monto — AC #11', () => {
    it('campo monto viene prellenado con final_price y muestra Valor del periodo: $X (AC #11)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));

      const dialog = await screen.findByRole('dialog', { name: 'Registrar pago' });
      expect(dialog).toBeInTheDocument();

      const inputAmount = within(dialog).getByLabelText('Monto del pago');
      expect(inputAmount).toHaveValue('270000');
      expect(within(dialog).getByText('Valor del periodo: $270.000')).toBeInTheDocument();
    });

    it('409 AMOUNT_MISMATCH muestra aviso de diferencia y Registrar de todas formas reenvía con allow_mismatch: true (AC #11)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'POST /api/admin/clients/biz-1/payments': (init) => {
          const body = JSON.parse(String(init.body));
          if (!body.allow_mismatch) {
            return {
              status: 409,
              body: {
                code: 'AMOUNT_MISMATCH',
                detail: 'El monto ingresado difiere del valor esperado.',
                expected_amount: '270000.00',
                amount: '250000.00',
                difference: '-20000.00',
              },
            };
          }
          return {
            status: 201,
            body: {
              payment: {
                id: 'pay-mismatch',
                amount: '250000.00',
                payment_date: '2026-10-10',
                reference_code: 'REF-MISMATCH',
              },
              new_cutoff_date: '2027-01-12',
              status: 'ACTIVO',
              client_notified: true,
            },
          };
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      const dialog = await screen.findByRole('dialog', { name: 'Registrar pago' });

      // Cambiamos el monto a 250000 para forzar mismatch
      const inputAmount = within(dialog).getByLabelText('Monto del pago');
      await user.clear(inputAmount);
      await user.type(inputAmount, '250000');
      await user.type(within(dialog).getByLabelText('Referencia de pago'), 'REF-MISMATCH');

      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));
      await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      // Se muestra el aviso de 409 AMOUNT_MISMATCH
      expect(await within(dialog).findByText('Aviso de diferencia de monto')).toBeInTheDocument();
      expect(within(dialog).getByText('$270.000')).toBeInTheDocument(); // esperado
      expect(within(dialog).getByText('$250.000')).toBeInTheDocument(); // recibido
      expect(within(dialog).getByText('-$20.000')).toBeInTheDocument(); // diferencia en rojo

      // Clic en "Registrar de todas formas"
      const btnAnyway = within(dialog).getByRole('button', { name: 'Registrar de todas formas' });
      await user.click(btnAnyway);

      await waitFor(() => {
        const calls = api.calls.filter(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/payments',
        );
        expect(calls).toHaveLength(2);
        expect(calls[1].body).toEqual({
          amount: 250000,
          reference: 'REF-MISMATCH',
          allow_mismatch: true,
        });
      });

      // El modal se cierra tras registrar con éxito
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('en 409 AMOUNT_MISMATCH el botón "Corregir monto" regresa al formulario para editar (AC #11)', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'POST /api/admin/clients/biz-1/payments': {
          status: 409,
          body: {
            code: 'AMOUNT_MISMATCH',
            detail: 'El monto ingresado difiere del valor esperado.',
            expected_amount: '270000.00',
            amount: '300000.00',
            difference: '30000.00',
          },
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
      const dialog = await screen.findByRole('dialog', { name: 'Registrar pago' });

      await user.type(within(dialog).getByLabelText('Referencia de pago'), 'REF-CORRECT');
      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));
      await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

      expect(await within(dialog).findByText('Aviso de diferencia de monto')).toBeInTheDocument();

      // Botón "Corregir monto"
      const btnCorregir = within(dialog).getByRole('button', { name: 'Corregir monto' });
      await user.click(btnCorregir);

      // Regresa al paso de input
      expect(within(dialog).getByLabelText('Monto del pago')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Continuar' })).toBeInTheDocument();
    });
  });
});
