import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAdminJobs, getAdminWorkerStatus } from '../../api/adminEndpoints';
import type { AdminJobItem, AdminJobsListResponse, AdminWorkerStatusResponse } from '../../api/adminTypes';
import { ResourceView } from '../../components/ScreenState';
import { capitalize, fmtBogotaDate, fmtNit, fmtPeriod, jobStatus } from '../../format';
import { useResource } from '../../hooks/useResource';

const PAGE_SIZE = 20;

const JOB_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Todos los estados', value: '' },
  { label: 'En cola', value: 'ENQUEUED' },
  { label: 'Procesando', value: 'PROCESSING' },
  { label: 'Exitosa', value: 'SUCCESS' },
  { label: 'Reintento pendiente', value: 'RETRY_PENDING' },
  { label: 'Fallida', value: 'FAILED' },
];

function formatJobError(errorCode?: string | null, errorMessage?: string | null): string {
  // Los textos de causa del back (admin_alerts) vienen en minúscula porque allá van dentro de una frase.
  if (errorMessage) return capitalize(errorMessage);
  if (!errorCode) return '—';
  switch (errorCode) {
    case 'DIAN_SLOW_RESPONSE':
      return 'Respuesta lenta de la DIAN';
    case 'DIAN_PORTAL_UNAVAILABLE':
      return 'Portal de la DIAN no disponible';
    case 'CERTIFICATE_EXPIRED':
      return 'Certificado digital vencido';
    case 'CREDENTIALS_INVALID':
      return 'Credenciales de acceso inválidas';
    default:
      return `Error (${errorCode})`;
  }
}

interface OperacionData {
  worker: AdminWorkerStatusResponse;
  jobs: AdminJobsListResponse;
}

export default function AdminOperacion() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlStatus = searchParams.get('status') || '';
  const urlPage = parseInt(searchParams.get('page') || '1', 10) || 1;

  const [refreshing, setRefreshing] = useState(false);
  const refreshBusy = useRef(false);

  const { state, retry } = useResource<OperacionData>(
    () =>
      Promise.all([
        getAdminWorkerStatus(),
        getAdminJobs({
          status: urlStatus || undefined,
          page: urlPage,
          page_size: PAGE_SIZE,
        }),
      ]).then(([worker, jobs]) => ({ worker, jobs })),
    [urlStatus, urlPage],
  );

  // Actualización automática cada 30 s solo mientras la pestaña está visible (Story 8.7 AC #3)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        retry();
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [retry]);

  async function handleRefresh() {
    if (refreshBusy.current) return;
    refreshBusy.current = true;
    setRefreshing(true);
    try {
      await retry();
    } finally {
      refreshBusy.current = false;
      setRefreshing(false);
    }
  }

  function handleFilterStatus(val: string) {
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set('status', val);
    } else {
      next.delete('status');
    }
    next.set('page', '1');
    setSearchParams(next);
  }

  function handlePageChange(newPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  }

  return (
    <section aria-label="Operación" className="screen admin-screen admin-operacion-screen">
      <div className="admin-operacion-head">
        <h1 className="screen-title">Operación</h1>
        <button
          type="button"
          className="btn-outline admin-btn-action admin-operacion-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Actualizar estado de la operación"
        >
          {refreshing ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando estado de la operación…">
        {({ worker, jobs }) => {
          const totalPages = Math.max(1, Math.ceil(jobs.total / jobs.page_size));
          const hasPrev = jobs.page > 1;
          const hasNext = jobs.page < totalPages;

          return (
            <div className="admin-operacion-content">
              {/* Tarjeta del Worker (AC #3) */}
              <div className="card admin-card admin-worker-card">
                <div className="admin-card-head">
                  <div>
                    <h2 className="admin-section-title" style={{ margin: 0 }}>
                      Monitor de sincronización
                    </h2>
                    <p className="admin-muted-text">
                      Umbral de alerta por silencio: {worker.silence_threshold_minutes} minutos
                    </p>
                  </div>
                </div>

                {worker.workers.length === 0 ? (
                  <p className="admin-empty-text">No hay workers registrados.</p>
                ) : (
                  <div className="admin-worker-grid">
                    {worker.workers.map((w) => {
                      const signalText =
                        w.minutes_since != null
                          ? `última señal hace ${w.minutes_since} min`
                          : w.last_seen_at
                            ? `última señal: ${fmtBogotaDate(w.last_seen_at)}`
                            : 'sin señal';

                      return (
                        <div key={w.name} className="admin-worker-item-card">
                          <div className="admin-worker-info">
                            <span className="admin-worker-name">{w.name}</span>
                            <span className="admin-worker-last-seen">{signalText}</span>
                          </div>
                          <div
                            className={`admin-worker-badge ${
                              w.is_silent ? 'admin-worker-silent' : 'admin-worker-active'
                            }`}
                            role="status"
                            aria-label={`Worker ${w.name}: ${w.is_silent ? 'Silencioso' : 'Activo'}`}
                          >
                            <span
                              className={`admin-worker-dot ${
                                w.is_silent ? 'admin-worker-dot-red' : 'admin-worker-dot-green'
                              }`}
                            />
                            <span>{w.is_silent ? 'Silencioso' : 'Activo'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Lista de Trabajos DIAN con filtro y paginación (AC #3) */}
              <div className="card admin-card">
                <div className="admin-card-head" style={{ flexWrap: 'wrap', gap: '12px' }}>
                  <h2 className="admin-section-title" style={{ margin: 0 }}>
                    Trabajos de extracción DIAN
                  </h2>
                  <div className="admin-filter-group">
                    <label htmlFor="filter-job-status" className="admin-filter-label">
                      Estado:
                    </label>
                    <select
                      id="filter-job-status"
                      className="month-select admin-select"
                      aria-label="Filtrar por estado"
                      value={urlStatus}
                      onChange={(e) => handleFilterStatus(e.target.value)}
                    >
                      {JOB_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="admin-results-bar">
                  <p className="result-count" role="status">
                    {jobs.total === 0
                      ? 'Sin trabajos de extracción'
                      : `Mostrando ${jobs.items.length} de ${jobs.total} ${
                          jobs.total === 1 ? 'trabajo' : 'trabajos'
                        }`}
                  </p>
                </div>

                {jobs.items.length === 0 ? (
                  <p className="admin-empty-text">No hay trabajos con el filtro seleccionado.</p>
                ) : (
                  <>
                    {/* Tabla de trabajos para escritorio (>= 1024 px) */}
                    <div className="admin-table-container admin-desktop-only">
                      <table className="admin-table" aria-label="Lista de trabajos de extracción">
                        <thead>
                          <tr>
                            <th scope="col">Negocio</th>
                            <th scope="col">Periodo</th>
                            <th scope="col">Estado</th>
                            <th scope="col">Intentos</th>
                            <th scope="col">Próxima ejecución</th>
                            <th scope="col">Error / Detalle</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobs.items.map((job: AdminJobItem) => (
                            <tr key={job.job_id} className="admin-table-row">
                              <td>
                                <Link to={`/admin/clientes/${job.business_id}`} className="admin-row-link">
                                  <strong className="admin-business-name">{job.commercial_name}</strong>
                                  <span className="admin-legal-name">NIT {fmtNit(job.nit)}</span>
                                </Link>
                              </td>
                              <td>{fmtPeriod(job.target_period)}</td>
                              <td>
                                <span className={`admin-pill-status status-${jobStatus(job.status).tone}`}>
                                  {jobStatus(job.status).label}
                                </span>
                              </td>
                              <td>
                                {job.attempt_count} / {job.max_attempts}
                              </td>
                              <td>{job.next_run_at ? fmtBogotaDate(job.next_run_at) : '—'}</td>
                              <td>
                                <span className={job.error_code || job.error_message ? 'text-alert' : ''}>
                                  {formatJobError(job.error_code, job.error_message)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tarjetas de trabajos para móvil (< 1024 px) */}
                    <div className="admin-mobile-only" style={{ gap: '10px' }}>
                      {jobs.items.map((job: AdminJobItem) => (
                        <div key={job.job_id} className="card admin-job-card">
                          <div className="admin-job-card-top">
                            <div>
                              <Link
                                to={`/admin/clientes/${job.business_id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                              >
                                <strong className="admin-business-name">{job.commercial_name}</strong>
                              </Link>
                              <span className="admin-legal-name" style={{ display: 'block' }}>
                                NIT {fmtNit(job.nit)}
                              </span>
                            </div>
                            <span className={`admin-pill-status status-${jobStatus(job.status).tone}`}>
                              {jobStatus(job.status).label}
                            </span>
                          </div>

                          <div className="admin-job-card-meta">
                            <span>
                              <strong>Periodo:</strong> {fmtPeriod(job.target_period)}
                            </span>
                            <span>
                              <strong>Intentos:</strong> {job.attempt_count}/{job.max_attempts}
                            </span>
                            {job.next_run_at && (
                              <span>
                                <strong>Próx:</strong> {fmtBogotaDate(job.next_run_at)}
                              </span>
                            )}
                          </div>

                          {(job.error_code || job.error_message) && (
                            <div className="admin-job-error">
                              {formatJobError(job.error_code, job.error_message)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Paginación */}
                    {totalPages > 1 && (
                      <div className="admin-pagination" role="navigation" aria-label="Paginación de trabajos">
                        <button
                          type="button"
                          className="btn-outline admin-page-btn"
                          disabled={!hasPrev}
                          onClick={() => handlePageChange(jobs.page - 1)}
                        >
                          Anterior
                        </button>
                        <span className="admin-page-info">
                          Página {jobs.page} de {totalPages}
                        </span>
                        <button
                          type="button"
                          className="btn-outline admin-page-btn"
                          disabled={!hasNext}
                          onClick={() => handlePageChange(jobs.page + 1)}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
