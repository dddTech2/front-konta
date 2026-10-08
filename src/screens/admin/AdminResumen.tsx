import { Link } from 'react-router-dom';
import { getAdminSummary } from '../../api/adminEndpoints';
import type { AdminSummaryResponse } from '../../api/adminTypes';
import { ResourceView } from '../../components/ScreenState';
import { fmtBogotaDate, fmtMoney, fmtNit } from '../../format';
import { useResource } from '../../hooks/useResource';

function WorkerIndicator({ summary }: { summary: AdminSummaryResponse }) {
  const worker = summary.worker?.workers?.[0];
  const isSilent = summary.worker ? (worker ? worker.is_silent : true) : true;
  const minutes = worker?.minutes_since != null ? worker.minutes_since : null;
  const signalText =
    minutes !== null
      ? `última señal hace ${minutes} min`
      : 'sin señal';

  return (
    <div
      className={`admin-worker-badge ${isSilent ? 'admin-worker-silent' : 'admin-worker-active'}`}
      role="status"
      aria-label={`Estado del worker: ${isSilent ? 'Silencioso' : 'Activo'}, ${signalText}`}
    >
      <span className={`admin-worker-dot ${isSilent ? 'admin-worker-dot-red' : 'admin-worker-dot-green'}`} />
      <span className="admin-worker-title">{isSilent ? 'Worker en alerta' : 'Worker activo'}</span>
      <span className="admin-worker-sub">({signalText})</span>
    </div>
  );
}

export default function AdminResumen() {
  const { state, retry } = useResource(() => getAdminSummary(), []);

  return (
    <section aria-label="Resumen" className="screen admin-screen">
      <div className="admin-screen-head">
        <h1 className="screen-title">Resumen</h1>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando resumen de administración…">
        {(summary) => {
          const statusCounts = summary.clients_by_status;
          const activos = statusCounts.ACTIVO ?? 0;
          const enMora = statusCounts.EN_MORA ?? 0;
          const bloqueados = statusCounts.BLOQUEADO ?? 0;
          const sinSuscripcion = statusCounts.SIN_SUSCRIPCION ?? 0;

          const tipoCounts = summary.clients_by_income_source;
          const tipoDian = tipoCounts.DIAN ?? 0;
          const tipoManual = tipoCounts.MANUAL_SALES ?? 0;

          return (
            <div className="admin-resumen-content">
              {/* Worker status banner */}
              <div className="card admin-worker-card">
                <div className="admin-worker-card-content">
                  <div>
                    <h2 className="admin-section-subtitle">Monitor de sincronización</h2>
                    <p className="admin-muted-text">Estado de los procesos de fondo</p>
                  </div>
                  <WorkerIndicator summary={summary} />
                </div>
              </div>

              {/* Clientes por estado */}
              <div className="admin-block">
                <h2 className="admin-section-title">Clientes por estado</h2>
                <div className="admin-grid admin-grid-4">
                  <div className="card admin-metric-card admin-metric-activo">
                    <span className="admin-metric-label">Activos</span>
                    <strong className="admin-metric-num">{activos}</strong>
                  </div>
                  <div className="card admin-metric-card admin-metric-mora">
                    <span className="admin-metric-label">En mora</span>
                    <strong className="admin-metric-num">{enMora}</strong>
                  </div>
                  <div className="card admin-metric-card admin-metric-bloqueado">
                    <span className="admin-metric-label">Bloqueados</span>
                    <strong className="admin-metric-num">{bloqueados}</strong>
                  </div>
                  <div className="card admin-metric-card admin-metric-sin-sub">
                    <span className="admin-metric-label">Sin suscripción</span>
                    <strong className="admin-metric-num">{sinSuscripcion}</strong>
                  </div>
                </div>
              </div>

              {/* Clientes por tipo y métricas operativas */}
              <div className="admin-grid admin-grid-2">
                <div className="card admin-card">
                  <h2 className="admin-section-title">Clientes por tipo</h2>
                  <div className="admin-stat-row">
                    <span>DIAN</span>
                    <strong>{tipoDian}</strong>
                  </div>
                  <div className="admin-stat-row">
                    <span>Ventas manuales</span>
                    <strong>{tipoManual}</strong>
                  </div>
                </div>

                <div className="card admin-card">
                  <h2 className="admin-section-title">Operación y alertas</h2>
                  <div className="admin-stat-row">
                    <span>Pagos del mes</span>
                    <strong>
                      {summary.payments_this_month.count} ({fmtMoney(summary.payments_this_month.total)})
                    </strong>
                  </div>
                  <div className="admin-stat-row">
                    <span>Descargas fallidas 24 h</span>
                    <strong className={summary.failed_jobs_24h > 0 ? 'text-alert' : ''}>
                      {summary.failed_jobs_24h}
                    </strong>
                  </div>
                  <div className="admin-stat-row">
                    <span>Clientes sin Telegram</span>
                    <strong className={summary.unlinked_telegram > 0 ? 'text-muted' : ''}>
                      {summary.unlinked_telegram}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Listas de atención: Cortes próximos y En periodo de gracia */}
              <div className="admin-grid admin-grid-2">
                {/* Cortes en los próximos 7 días */}
                <div className="card admin-card">
                  <div className="admin-card-head">
                    <h2 className="admin-section-title">Cortes en los próximos 7 días</h2>
                    <span className="admin-count-badge">{summary.upcoming_cutoffs.length}</span>
                  </div>
                  {summary.upcoming_cutoffs.length === 0 ? (
                    <p className="admin-empty-text">No hay cortes en los próximos 7 días.</p>
                  ) : (
                    <ul className="admin-action-list plain-list">
                      {summary.upcoming_cutoffs.map((item) => (
                        <li key={item.business_id} className="admin-action-item">
                          <Link to={`/admin/clientes/${item.business_id}`} className="admin-action-link">
                            <div className="admin-action-lead">
                              <span className="admin-item-title">{item.commercial_name}</span>
                              <span className="admin-item-sub">NIT {fmtNit(item.nit)}</span>
                            </div>
                            <span className="admin-item-badge admin-badge-corte">
                              Corte: {fmtBogotaDate(item.cutoff_date)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* En periodo de gracia */}
                <div className="card admin-card">
                  <div className="admin-card-head">
                    <h2 className="admin-section-title">En periodo de gracia</h2>
                    <span className="admin-count-badge admin-badge-alert-count">
                      {summary.in_grace.length}
                    </span>
                  </div>
                  {summary.in_grace.length === 0 ? (
                    <p className="admin-empty-text">No hay clientes en periodo de gracia.</p>
                  ) : (
                    <ul className="admin-action-list plain-list">
                      {summary.in_grace.map((item) => (
                        <li key={item.business_id} className="admin-action-item">
                          <Link to={`/admin/clientes/${item.business_id}`} className="admin-action-link">
                            <div className="admin-action-lead">
                              <span className="admin-item-title">{item.commercial_name}</span>
                              <span className="admin-item-sub">NIT {fmtNit(item.nit)}</span>
                            </div>
                            <span className="admin-item-badge admin-badge-gracia">
                              Gracia hasta: {fmtBogotaDate(item.grace_period_end)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
