import { Link, useLocation, useParams } from 'react-router-dom';
import { getAdminClientDetail } from '../../api/adminEndpoints';
import { ResourceView } from '../../components/ScreenState';
import { fmtBogotaDate, fmtDeadline, fmtMoney, fmtNit, fmtPercent, fmtPeriod, jobStatus } from '../../format';
import { useResource } from '../../hooks/useResource';

function statusBadge(status?: string | null) {
  const s = (status || '').toUpperCase();
  let label = status || 'Sin estado';
  let colorClass = 'admin-badge-default';

  if (s === 'ACTIVO') {
    label = 'Activo';
    colorClass = 'admin-badge-activo';
  } else if (s === 'EN_MORA') {
    label = 'En mora';
    colorClass = 'admin-badge-mora';
  } else if (s === 'BLOQUEADO') {
    label = 'Bloqueado';
    colorClass = 'admin-badge-bloqueado';
  } else if (s === 'CANCELADO') {
    label = 'Cancelado';
    colorClass = 'admin-badge-cancelado';
  } else if (s === 'SIN_SUSCRIPCION') {
    label = 'Sin suscripción';
    colorClass = 'admin-badge-sin-sub';
  }

  return <span className={`admin-badge-status ${colorClass}`}>{label}</span>;
}

function tipoLabel(tipo?: string | null) {
  if (tipo === 'MANUAL_SALES') return 'Ventas manuales';
  if (tipo === 'DIAN') return 'DIAN';
  return tipo || '—';
}

function personaLabel(taxpayerType?: string | null) {
  if (taxpayerType === 'PERSONA_JURIDICA') return 'Persona Jurídica';
  if (taxpayerType === 'PERSONA_NATURAL') return 'Persona Natural';
  return taxpayerType || '—';
}

function formatExtractionError(errorCode?: string | null): string {
  if (!errorCode) return 'Sin errores';
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
      return `Error en la descarga (${errorCode})`;
  }
}

export default function AdminFicha() {
  const { businessId = '' } = useParams<{ businessId: string }>();
  const location = useLocation();

  // Preserva los filtros y búsqueda de la pantalla de clientes si se navega desde allí
  const backSearch = (location.state as { from?: string } | null)?.from || '';
  const backUrl = `/admin/clientes${backSearch}`;

  const { state, retry } = useResource(
    () => getAdminClientDetail(businessId),
    [businessId],
  );

  return (
    <section aria-label="Ficha del cliente" className="screen admin-screen admin-ficha-screen">
      <div className="admin-ficha-nav">
        <Link to={backUrl} className="admin-back-btn">
          ← Volver a clientes
        </Link>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando ficha del cliente…">
        {(ficha) => {
          const { business, contact, tax_profile, subscription, recent_payments, recent_extractions } = ficha;
          const phoneDigits = contact.phone ? contact.phone.replace(/\D/g, '') : '';
          const waPhone = phoneDigits.startsWith('57') ? phoneDigits : `57${phoneDigits}`;

          return (
            <div className="admin-ficha-content">
              {/* Encabezado: Negocio, NIT-DV, Tipo y Estado */}
              <div className="card admin-ficha-header">
                <div className="admin-ficha-header-top">
                  <div>
                    <span className="admin-pill-category">{personaLabel(business.taxpayer_type)}</span>
                    <h1 className="h-title admin-ficha-title">{business.commercial_name}</h1>
                    {business.legal_name && (
                      <p className="admin-ficha-subtitle">Razón social: {business.legal_name}</p>
                    )}
                  </div>
                  <div>
                    {statusBadge(subscription?.status || (business.is_active ? 'ACTIVO' : 'SIN_SUSCRIPCION'))}
                  </div>
                </div>

                <div className="admin-ficha-header-meta">
                  <div className="admin-meta-col">
                    <span className="admin-meta-label">NIT</span>
                    <strong className="admin-meta-value">{fmtNit(business.nit, business.dv)}</strong>
                  </div>
                  <div className="admin-meta-col">
                    <span className="admin-meta-label">Origen de ingresos</span>
                    <strong className="admin-meta-value">{tipoLabel(business.income_source)}</strong>
                  </div>
                  <div className="admin-meta-col">
                    <span className="admin-meta-label">ID del negocio</span>
                    <code className="admin-code-id">{business.id}</code>
                  </div>
                </div>
              </div>

              {/* Grid 2 columnas: Contacto y Perfil Tributario */}
              <div className="admin-grid admin-grid-2">
                {/* Contacto */}
                <div className="card admin-card">
                  <h2 className="admin-section-title">Contacto</h2>
                  <div className="admin-kv-list">
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Nombre</span>
                      <strong className="admin-kv-val">{contact.full_name}</strong>
                    </div>
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Correo</span>
                      <span className="admin-kv-val">{contact.email}</span>
                    </div>
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Celular</span>
                      <div className="admin-kv-val admin-phone-actions">
                        {contact.phone ? (
                          <>
                            <span>{contact.phone}</span>
                            <div className="admin-contact-links">
                              <a
                                href={`tel:${phoneDigits}`}
                                className="admin-link-btn"
                                aria-label={`Llamar a ${contact.full_name}`}
                              >
                                Llamar
                              </a>
                              <a
                                href={`https://wa.me/${waPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-link-btn admin-link-wa"
                                aria-label={`Escribir por WhatsApp a ${contact.full_name}`}
                              >
                                WhatsApp
                              </a>
                            </div>
                          </>
                        ) : (
                          <span className="admin-muted-text">No registrado</span>
                        )}
                      </div>
                    </div>
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Telegram</span>
                      <span className="admin-kv-val">
                        <span
                          className={`admin-pill-telegram ${contact.is_telegram_linked ? 'linked' : 'unlinked'}`}
                        >
                          {contact.is_telegram_linked ? 'Vinculado' : 'Sin vincular'}
                        </span>
                        {contact.telegram_username && (
                          <span className="admin-tg-username"> (@{contact.telegram_username})</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Perfil tributario */}
                <div className="card admin-card">
                  <h2 className="admin-section-title">Perfil tributario</h2>
                  <div className="admin-kv-list">
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Periodicidad IVA</span>
                      <strong className="admin-kv-val">
                        {tax_profile.iva_periodicity || 'No definida'}
                      </strong>
                    </div>
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Agente de retención</span>
                      <span className="admin-kv-val">
                        {tax_profile.is_withholding_agent ? 'Sí' : 'No'}
                      </span>
                    </div>
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Actividad económica</span>
                      <span className="admin-kv-val">
                        {business.economic_activity || 'No registrada'}
                      </span>
                    </div>
                    {business.legal_rep_doc && (
                      <div className="admin-kv-item">
                        <span className="admin-kv-key">Doc. Rep. Legal</span>
                        <span className="admin-kv-val">{business.legal_rep_doc}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Suscripción */}
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Suscripción</h2>
                  {subscription && statusBadge(subscription.status)}
                </div>

                {subscription ? (
                  <div className="admin-sub-grid">
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Plan</span>
                      <strong className="admin-sub-value">{subscription.plan}</strong>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Precio base</span>
                      <span className="admin-sub-value">
                        {subscription.base_price ? fmtMoney(Number(subscription.base_price)) : '—'}
                      </span>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Descuento</span>
                      <span className="admin-sub-value">
                        {subscription.discount_rate ? `${fmtPercent(Number(subscription.discount_rate))} %` : '—'}
                      </span>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Precio final</span>
                      <strong className="admin-sub-value text-accent">
                        {subscription.final_price ? fmtMoney(Number(subscription.final_price)) : '—'}
                      </strong>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Fecha de inicio</span>
                      <span className="admin-sub-value">
                        {subscription.start_date ? fmtDeadline(subscription.start_date) : '—'}
                      </span>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Próximo corte</span>
                      <strong className="admin-sub-value">
                        {subscription.cutoff_date ? fmtDeadline(subscription.cutoff_date) : '—'}
                      </strong>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Fin periodo de gracia</span>
                      <span className="admin-sub-value">
                        {subscription.grace_period_end ? fmtDeadline(subscription.grace_period_end) : '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="admin-empty-text">El cliente no tiene una suscripción activa configurada.</p>
                )}
              </div>

              {/* Pagos recientes */}
              <div className="card admin-card">
                <h2 className="admin-section-title">Pagos recientes</h2>
                {recent_payments.length === 0 ? (
                  <p className="admin-empty-text">No hay pagos registrados.</p>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table" aria-label="Historial de pagos">
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Monto</th>
                          <th scope="col">Referencia</th>
                          <th scope="col">Método</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent_payments.map((p) => (
                          <tr key={p.id} className="admin-table-row">
                            <td>
                              {p.payment_date
                                ? fmtDeadline(p.payment_date)
                                : p.created_at
                                  ? fmtBogotaDate(p.created_at)
                                  : '—'}
                            </td>
                            <td>
                              <strong>{fmtMoney(Number(p.amount))}</strong>
                            </td>
                            <td>
                              <code>{p.reference_code || '—'}</code>
                            </td>
                            <td>{p.payment_method || 'TRANSFERENCIA'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Descargas DIAN recientes */}
              <div className="card admin-card">
                <h2 className="admin-section-title">Descargas DIAN recientes</h2>
                {recent_extractions.length === 0 ? (
                  <p className="admin-empty-text">No hay descargas DIAN registradas.</p>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table" aria-label="Historial de extracciones DIAN">
                      <thead>
                        <tr>
                          <th scope="col">Periodo</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Intentos</th>
                          <th scope="col">Detalle / Error</th>
                          <th scope="col">Fecha finalización</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent_extractions.map((ext) => (
                          <tr key={ext.id} className="admin-table-row">
                            <td>{fmtPeriod(ext.period)}</td>
                            <td>
                              <span
                                className={`admin-pill-status status-${jobStatus(ext.status).tone}`}
                              >
                                {jobStatus(ext.status).label}
                              </span>
                            </td>
                            <td>{ext.attempts}</td>
                            <td>{formatExtractionError(ext.error_code)}</td>
                            <td>
                              {ext.finished_at
                                ? fmtBogotaDate(ext.finished_at)
                                : ext.next_run_at
                                  ? `Próx: ${fmtBogotaDate(ext.next_run_at)}`
                                  : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Documentos */}
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Documentos</h2>
                  <span className="admin-count-badge">{ficha.active_documents_count}</span>
                </div>
                <div className="admin-docs-summary">
                  <p>
                    El cliente cuenta con <strong>{ficha.active_documents_count}</strong>{' '}
                    {ficha.active_documents_count === 1 ? 'documento activo' : 'documentos activos'} en su expediente.
                  </p>
                  <p className="admin-muted-text">
                    La visualización y gestión de documentos desde este panel estará disponible próximamente.
                  </p>
                </div>
              </div>
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
