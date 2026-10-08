import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../../auth/session';
import {
  ADMIN_CLIENT_DETAIL,
  ADMIN_DOCUMENTS,
  ADMIN_JOBS,
  ADMIN_WORKER_STATUS,
} from '../../test/fixtures';
import { ME_ADMIN, mockApi, renderApp, resetSession } from '../../test/utils';

vi.mock('../../navigation', () => ({ navigateTo: vi.fn() }));

beforeEach(() => {
  resetSession();
  setToken('jwt-admin');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Story 8.7: Panel admin — documentos y operación DIAN', () => {
  describe('Documentos en la ficha (AC #1)', () => {
    it('lista los documentos activos con número, tipo legible, descripción, fecha y tamaño', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
      });

      renderApp('/admin/clientes/biz-1');

      expect(await screen.findByRole('heading', { name: 'Panadería La Espiga' })).toBeInTheDocument();

      // Sección de documentos
      const docsHeading = screen.getByRole('heading', { name: 'Documentos' });
      expect(docsHeading).toBeInTheDocument();

      // Comprueba los 3 documentos cargados en tabla y móvil (usamos getAllByText)
      expect(screen.getAllByText('RUT').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cámara de comercio').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Contrato de arrendamiento').length).toBeGreaterThan(0);

      // Metadatos
      expect(screen.getAllByText('#1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('230 KB').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1,2 MB').length).toBeGreaterThan(0);
      expect(screen.getAllByText('999 B').length).toBeGreaterThan(0);
    });

    it('subir PDF válido: envía FormData con campos file, doc_type y description y recarga la lista', async () => {
      const user = userEvent.setup();
      const updatedDocs = [
        {
          id: 'doc-new',
          number: 4,
          doc_type: 'CERTIFICACION_BANCARIA',
          description: 'Certificado Bancolombia',
          original_filename: 'cert_bancolombia.pdf',
          content_type: 'application/pdf',
          size_bytes: 512000,
          created_at: '2026-10-07T20:00:00',
        },
        ...ADMIN_DOCUMENTS,
      ];

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
        'POST /api/admin/clients/biz-1/documents': {
          status: 201,
          body: updatedDocs[0],
        },
      });

      renderApp('/admin/clientes/biz-1');

      await screen.findByRole('heading', { name: 'Panadería La Espiga' });
      expect((await screen.findAllByText('RUT_2026.pdf')).length).toBeGreaterThan(0);

      // Crear archivo simulado PDF
      const file = new File(['dummy-pdf-content'], 'cert_bancolombia.pdf', { type: 'application/pdf' });
      const fileInput = screen.getByLabelText('Elegir archivo');
      await user.upload(fileInput, file);

      // Verifica que se muestra el archivo seleccionado
      expect(screen.getByText(/cert_bancolombia\.pdf/)).toBeInTheDocument();

      // Selecciona tipo de documento
      const selectTipo = screen.getByLabelText('Tipo de documento');
      await user.selectOptions(selectTipo, 'CERTIFICACION_BANCARIA');

      // Escribe descripción
      const inputDesc = screen.getByLabelText(/Descripción/);
      await user.type(inputDesc, 'Certificado Bancolombia');

      // Actualiza mock de GET documents para la recarga
      api.set('GET /api/admin/clients/biz-1/documents', { body: updatedDocs });

      // Envía el formulario
      const submitBtn = screen.getByRole('button', { name: 'Subir documento' });
      await user.click(submitBtn);

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/documents',
        );
        expect(postCall).toBeDefined();
        const fd = postCall?.body as FormData;
        expect(fd).toBeInstanceOf(FormData);
        expect(fd.get('doc_type')).toBe('CERTIFICACION_BANCARIA');
        expect(fd.get('description')).toBe('Certificado Bancolombia');
        expect(fd.get('file')).toBeTruthy();
      });

      // La lista se recargó y muestra el nuevo documento
      expect((await screen.findAllByText('cert_bancolombia.pdf')).length).toBeGreaterThan(0);
    });

    it('rechazo local de archivo que supera 10 MB (11 MB)', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      // Archivo de 11 MB
      const bigFile = new File(['a'], 'pesado.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 });

      const fileInput = screen.getByLabelText('Elegir archivo');
      await user.upload(fileInput, bigFile);

      // Al intentar subir o al seleccionar aparece el error
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('El archivo supera el tamaño máximo permitido de 10 MB.');

      // No se envía nada al backend
      const postCalls = api.calls.filter((c) => c.method === 'POST' && c.path.includes('/documents'));
      expect(postCalls).toHaveLength(0);
    });

    it('rechazo local de tipo inválido (ej. ejecutable o zip)', async () => {
      // Sin applyAccept: false, userEvent descarta el archivo por el atributo accept y la validación propia nunca corre.
      const user = userEvent.setup({ applyAccept: false });
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      const invalidFile = new File(['binary'], 'virus.exe', { type: 'application/x-msdownload' });
      const fileInput = screen.getByLabelText('Elegir archivo');
      await user.upload(fileInput, invalidFile);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Tipo de archivo no permitido/);

      const postCalls = api.calls.filter((c) => c.method === 'POST' && c.path.includes('/documents'));
      expect(postCalls).toHaveLength(0);
    });

    it('rechazo local cuando el tipo es OTRO y no se escribe descripción', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      const validFile = new File(['ok'], 'otro_archivo.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Elegir archivo'), validFile);

      await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'OTRO');

      // Descripción vacía
      await user.click(screen.getByRole('button', { name: 'Subir documento' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/La descripción es obligatoria/);

      const postCalls = api.calls.filter((c) => c.method === 'POST' && c.path.includes('/documents'));
      expect(postCalls).toHaveLength(0);
    });

    it('error 415 del servidor muestra mensaje claro al usuario', async () => {
      const user = userEvent.setup();
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
        'POST /api/admin/clients/biz-1/documents': {
          status: 415,
          body: { detail: 'Tipo de archivo no permitido por el servidor.' },
        },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      const validFile = new File(['ok'], 'archivo.pdf', { type: 'application/pdf' });
      await user.upload(screen.getByLabelText('Elegir archivo'), validFile);

      await user.click(screen.getByRole('button', { name: 'Subir documento' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Tipo de archivo no permitido/);
    });

    it('retirar documento: muestra diálogo de confirmación previa y recarga la lista al confirmar', async () => {
      const user = userEvent.setup();
      const remainingDocs = ADMIN_DOCUMENTS.filter((d) => d.id !== 'doc-1');

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
        'DELETE /api/admin/clients/biz-1/documents/doc-1': { status: 204 },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      // Botón Retirar para el primer documento
      const btnRetirar = screen.getAllByRole('button', { name: 'Retirar RUT' })[0];
      await user.click(btnRetirar);

      // Diálogo modal de confirmación
      const dialog = screen.getByRole('dialog', { name: 'Retirar documento' });
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/¿Estás seguro de que deseas retirar el documento/)).toBeInTheDocument();

      // Cambiamos el mock de GET para simular la lista actualizada tras el DELETE
      api.set('GET /api/admin/clients/biz-1/documents', { body: remainingDocs });

      // Confirmar retiro
      const btnConfirmar = within(dialog).getByRole('button', { name: 'Retirar' });
      await user.click(btnConfirmar);

      await waitFor(() => {
        const deleteCall = api.calls.find(
          (c) => c.method === 'DELETE' && c.path === '/api/admin/clients/biz-1/documents/doc-1',
        );
        expect(deleteCall).toBeDefined();
      });

      // El diálogo se cierra
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // La lista se recargó y ya no tiene el RUT
      await waitFor(() => {
        expect(screen.queryByText('RUT_2026.pdf')).not.toBeInTheDocument();
      });
    });

    it('abrir documento: abre popup síncrono y solicita el enlace firmado temporal', async () => {
      const user = userEvent.setup();
      const popupMock = { location: { href: '' }, close: vi.fn(), closed: false } as unknown as Window;
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(popupMock);

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
        'POST /api/admin/clients/biz-1/documents/doc-1/link': {
          status: 200,
          body: { url: '/api/documents/file/tok-admin-1', expires_in: 300 },
        },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      const btnAbrir = screen.getAllByRole('button', { name: 'Abrir RUT' })[0];
      await user.click(btnAbrir);

      await waitFor(() => {
        expect(popupMock.location.href).toBe('/api/documents/file/tok-admin-1');
      });

      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      const linkCall = api.calls.find(
        (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/documents/doc-1/link',
      );
      expect(linkCall).toBeDefined();
    });
  });

  describe('Lanzar extracción en la ficha (AC #2)', () => {
    it('opción Un mes: por defecto mes actual, confirma y recarga extracciones recientes', async () => {
      const user = userEvent.setup();
      const updatedClient = {
        ...ADMIN_CLIENT_DETAIL,
        recent_extractions: [
          {
            id: 'ext-new',
            period: '2026-10',
            status: 'ENQUEUED',
            attempts: 0,
            next_run_at: '2026-10-07T21:00:00',
            finished_at: null,
            error_code: null,
          },
          ...ADMIN_CLIENT_DETAIL.recent_extractions,
        ],
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
        'POST /api/admin/clients/biz-1/extractions': {
          status: 201,
          body: {
            job_id: 'job-ext-1',
            business_id: 'biz-1',
            target_period: '2026-10',
            status: 'ENQUEUED',
            attempt_count: 0,
            max_attempts: 3,
          },
        },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      // Botón "Descargar de la DIAN"
      const btnDescargar = screen.getByRole('button', { name: 'Descargar de la DIAN' });
      await user.click(btnDescargar);

      const dialog = screen.getByRole('dialog', { name: 'Descargar de la DIAN' });
      expect(dialog).toBeInTheDocument();

      // Opción Un mes preseleccionada
      const selectMes = within(dialog).getByLabelText('Mes a descargar');
      expect(selectMes).toBeInTheDocument();

      // Continuar hacia confirmación
      const btnContinuar = within(dialog).getByRole('button', { name: 'Continuar' });
      await user.click(btnContinuar);

      // Confirmación
      expect(within(dialog).getByText(/¿Confirmas solicitar la descarga de la DIAN para/)).toBeInTheDocument();

      api.set('GET /api/admin/clients/biz-1', { body: updatedClient });

      const btnConfirmar = within(dialog).getByRole('button', { name: 'Confirmar descarga' });
      await user.click(btnConfirmar);

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/extractions',
        );
        expect(postCall).toBeDefined();
        expect(postCall?.body).toHaveProperty('period');
      });

      // Paso de resultado exitoso
      expect(within(dialog).getByText('La solicitud ha sido registrada correctamente en el sistema.')).toBeInTheDocument();
      const btnAceptar = within(dialog).getByRole('button', { name: 'Aceptar' });
      await user.click(btnAceptar);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Las extracciones recientes muestran la nueva
      expect(screen.getByText('En cola')).toBeInTheDocument();
    });

    it('opción Últimos N meses: envía months=N y confirma correctamente', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/clients/biz-1': { body: ADMIN_CLIENT_DETAIL },
        'GET /api/admin/clients/biz-1/documents': { body: ADMIN_DOCUMENTS },
        'POST /api/admin/clients/biz-1/extractions': {
          status: 201,
          body: {
            job_id: 'job-ext-range',
            business_id: 'biz-1',
            target_period: '2026-05',
            status: 'ENQUEUED',
            attempt_count: 0,
            max_attempts: 3,
          },
        },
      });

      renderApp('/admin/clientes/biz-1');
      await screen.findByRole('heading', { name: 'Panadería La Espiga' });

      await user.click(screen.getByRole('button', { name: 'Descargar de la DIAN' }));
      const dialog = screen.getByRole('dialog', { name: 'Descargar de la DIAN' });

      // Cambiar a "Últimos N meses"
      const btnRange = within(dialog).getByRole('radio', { name: 'Últimos N meses' });
      await user.click(btnRange);

      const inputMonths = within(dialog).getByLabelText('Cantidad de meses (1–12)');
      await user.clear(inputMonths);
      await user.type(inputMonths, '6');

      await user.click(within(dialog).getByRole('button', { name: 'Continuar' }));

      expect(within(dialog).getByText(/los últimos 6 meses/)).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Confirmar descarga' }));

      await waitFor(() => {
        const postCall = api.calls.find(
          (c) => c.method === 'POST' && c.path === '/api/admin/clients/biz-1/extractions',
        );
        expect(postCall).toBeDefined();
        expect(postCall?.body).toEqual({ months: 6 });
      });
    });
  });

  describe('Pantalla Operación (/admin/operacion) - AC #3 y #4', () => {
    it('muestra tarjeta del worker y lista de trabajos con estado, color, intentos y error legible', async () => {
      mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/worker': { body: ADMIN_WORKER_STATUS },
        'GET /api/admin/jobs': { body: ADMIN_JOBS },
      });

      renderApp('/admin/operacion');

      expect(await screen.findByRole('heading', { name: 'Operación' })).toBeInTheDocument();

      // Monitor de worker
      expect(screen.getByText('worker-dian-1')).toBeInTheDocument();
      expect(screen.getByText(/hace 3 min/)).toBeInTheDocument();
      expect(screen.getByText(/15 minutos/)).toBeInTheDocument();

      // Trabajos
      expect(screen.getAllByText('Panadería La Espiga').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cafetería Central').length).toBeGreaterThan(0);

      // Estados legibles con color
      expect(screen.getAllByText('Exitosa').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Fallida').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Procesando').length).toBeGreaterThan(0);

      // Intentos
      expect(screen.getAllByText('1 / 3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('3 / 3').length).toBeGreaterThan(0);

      // Error legible
      expect(screen.getAllByText('Portal de la DIAN no disponible').length).toBeGreaterThan(0);

      // Enlaces a la ficha de cliente
      const links = screen.getAllByRole('link', { name: /Panadería La Espiga/ });
      expect(links[0]).toHaveAttribute('href', '/admin/clientes/biz-1');
    });

    it('filtrar por estado actualiza la consulta de jobs con status=FAILED', async () => {
      const user = userEvent.setup();
      const failedJobs = {
        ...ADMIN_JOBS,
        items: [ADMIN_JOBS.items[1]],
        total: 1,
      };

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/worker': { body: ADMIN_WORKER_STATUS },
        'GET /api/admin/jobs': { body: ADMIN_JOBS },
      });

      renderApp('/admin/operacion');
      await screen.findByRole('heading', { name: 'Operación' });

      api.set('GET /api/admin/jobs', (_init, path) => {
        if (path.includes('status=FAILED')) {
          return { body: failedJobs };
        }
        return { body: ADMIN_JOBS };
      });

      // El filtro aparece cuando terminan de cargar los trabajos, después del título.
      const selectStatus = await screen.findByLabelText('Filtrar por estado');
      await user.selectOptions(selectStatus, 'FAILED');

      await waitFor(() => {
        const jobCall = api.calls.find((c) => c.path.includes('/api/admin/jobs') && c.path.includes('status=FAILED'));
        expect(jobCall).toBeDefined();
      });

      expect(await screen.findByText('Mostrando 1 de 1 trabajo')).toBeInTheDocument();
      // "Exitosa" sigue existiendo como opción del filtro; lo que no debe quedar es una fila con ese estado.
      expect(screen.queryAllByText('Exitosa').filter((el) => el.tagName !== 'OPTION')).toHaveLength(0);
    });

    it('botón Actualizar recarga worker y jobs', async () => {
      const user = userEvent.setup();
      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/worker': { body: ADMIN_WORKER_STATUS },
        'GET /api/admin/jobs': { body: ADMIN_JOBS },
      });

      renderApp('/admin/operacion');
      await screen.findByRole('heading', { name: 'Operación' });

      const initialCallsCount = api.calls.length;

      const refreshBtn = screen.getByRole('button', { name: 'Actualizar estado de la operación' });
      await user.click(refreshBtn);

      await waitFor(() => {
        expect(api.calls.length).toBeGreaterThan(initialCallsCount);
      });
    });

    it('el intervalo de 30 s no corre cuando la pestaña está oculta', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const api = mockApi({
        'GET /api/auth/me': { body: ME_ADMIN },
        'GET /api/admin/worker': { body: ADMIN_WORKER_STATUS },
        'GET /api/admin/jobs': { body: ADMIN_JOBS },
      });

      renderApp('/admin/operacion');

      // Esperar a que cargue
      await act(async () => {
        await Promise.resolve();
      });

      const callsBefore = api.calls.filter((c) => c.path.includes('/api/admin/jobs')).length;

      // Ocultar la pestaña
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });

      // Avanzar 30 s
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // No debe haberse llamado nuevamente a jobs mientras estuvo oculta
      const callsWhileHidden = api.calls.filter((c) => c.path.includes('/api/admin/jobs')).length;
      expect(callsWhileHidden).toBe(callsBefore);

      // Hacer visible la pestaña
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

      // Avanzar otros 30 s
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Ahora sí se debe haber ejecutado la recarga
      const callsAfterVisible = api.calls.filter((c) => c.path.includes('/api/admin/jobs')).length;
      expect(callsAfterVisible).toBeGreaterThan(callsBefore);
    });
  });
});
