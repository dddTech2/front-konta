import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getAdminClients } from '../../api/adminEndpoints';
import type { AdminClientListItem } from '../../api/adminTypes';
import { Icon } from '../../components/Icon';
import { ResourceView } from '../../components/ScreenState';
import { fmtBogotaDate, fmtNit } from '../../format';
import { useResource } from '../../hooks/useResource';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Todos los estados', value: '' },
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'En mora', value: 'EN_MORA' },
  { label: 'Bloqueado', value: 'BLOQUEADO' },
  { label: 'Cancelado', value: 'CANCELADO' },
  { label: 'Sin suscripción', value: 'SIN_SUSCRIPCION' },
];

const TIPO_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Todos los tipos', value: '' },
  { label: 'DIAN', value: 'DIAN' },
  { label: 'Ventas manuales', value: 'MANUAL_SALES' },
];

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

export default function AdminClientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const urlQ = searchParams.get('q') || '';
  const urlStatus = searchParams.get('status') || '';
  const urlTipo = searchParams.get('tipo') || '';
  const urlPage = parseInt(searchParams.get('page') || '1', 10) || 1;

  const [searchDraft, setSearchDraft] = useState(urlQ);

  // Sincroniza draft si la URL cambia por navegación (ej. atrás del navegador)
  useEffect(() => {
    setSearchDraft(urlQ);
  }, [urlQ]);

  // Espera de 300 ms tras teclear para actualizar el parámetro en la URL
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchDraft.trim();
      if (trimmed !== urlQ) {
        const next = new URLSearchParams(searchParams);
        if (trimmed) {
          next.set('q', trimmed);
        } else {
          next.delete('q');
        }
        next.set('page', '1');
        setSearchParams(next);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchDraft, urlQ, searchParams, setSearchParams]);

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

  function handleFilterTipo(val: string) {
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set('tipo', val);
    } else {
      next.delete('tipo');
    }
    next.set('page', '1');
    setSearchParams(next);
  }

  function handlePageChange(newPage: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
  }

  const { state, retry } = useResource(
    () =>
      getAdminClients({
        q: urlQ || undefined,
        status: urlStatus || undefined,
        income_source: urlTipo || undefined,
        page: urlPage,
        page_size: PAGE_SIZE,
      }),
    [urlQ, urlStatus, urlTipo, urlPage],
  );

  return (
    <section aria-label="Clientes" className="screen admin-screen">
      <div className="admin-screen-head">
        <h1 className="screen-title">Clientes</h1>
        <Link to="/admin/clientes/nuevo" className="btn-primary admin-btn-nuevo">
          Nuevo cliente
        </Link>
      </div>

      {/* Buscador con icono */}
      <div className="search-box admin-search-box">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Buscar clientes"
          placeholder="Buscar por negocio, NIT o contacto…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
      </div>

      {/* Filtros por tipo y estado */}
      <div className="filter-row admin-filter-row">
        <div className="admin-filter-group">
          <label htmlFor="filter-tipo" className="admin-filter-label">
            Tipo:
          </label>
          <select
            id="filter-tipo"
            className="month-select admin-select"
            aria-label="Filtrar por tipo de cliente"
            value={urlTipo}
            onChange={(e) => handleFilterTipo(e.target.value)}
          >
            {TIPO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-group">
          <label htmlFor="filter-status" className="admin-filter-label">
            Estado:
          </label>
          <select
            id="filter-status"
            className="month-select admin-select"
            aria-label="Filtrar por estado de suscripción"
            value={urlStatus}
            onChange={(e) => handleFilterStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Buscando clientes…">
        {(res) => {
          const totalPages = Math.max(1, Math.ceil(res.total / res.page_size));
          const hasPrev = res.page > 1;
          const hasNext = res.page < totalPages;

          return (
            <div className="admin-clients-content">
              <div className="admin-results-bar">
                <p className="result-count" role="status">
                  {res.total === 0
                    ? 'Sin resultados'
                    : `Mostrando ${res.items.length} de ${res.total} ${res.total === 1 ? 'cliente' : 'clientes'}`}
                </p>
              </div>

              {res.items.length === 0 ? (
                <div className="card admin-empty-card">
                  <p className="list-empty">No se encontraron clientes con los filtros seleccionados.</p>
                </div>
              ) : (
                <>
                  {/* Vista de tabla para escritorio (>= 1024 px) */}
                  <div className="card admin-table-container admin-desktop-only">
                    <table className="admin-table" aria-label="Lista de clientes">
                      <thead>
                        <tr>
                          <th scope="col">Negocio</th>
                          <th scope="col">NIT</th>
                          <th scope="col">Tipo</th>
                          <th scope="col">Plan</th>
                          <th scope="col">Estado</th>
                          <th scope="col">Corte</th>
                          <th scope="col">Telegram</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.items.map((client: AdminClientListItem) => (
                          <tr key={client.business_id} className="admin-table-row">
                            <td className="admin-td-business">
                              <Link
                                to={`/admin/clientes/${client.business_id}`}
                                state={{ from: location.search }}
                                className="admin-row-link"
                              >
                                <strong className="admin-business-name">{client.commercial_name}</strong>
                                {client.legal_name && client.legal_name !== client.commercial_name && (
                                  <span className="admin-legal-name">{client.legal_name}</span>
                                )}
                              </Link>
                            </td>
                            <td>{fmtNit(client.nit, client.dv)}</td>
                            <td>{tipoLabel(client.income_source)}</td>
                            <td>{client.plan || '—'}</td>
                            <td>{statusBadge(client.subscription_status)}</td>
                            <td>{client.cutoff_date ? fmtBogotaDate(client.cutoff_date) : '—'}</td>
                            <td>
                              <span
                                className={`admin-pill-telegram ${client.is_telegram_linked ? 'linked' : 'unlinked'}`}
                              >
                                {client.is_telegram_linked ? 'Vinculado' : 'Sin vincular'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista de tarjetas apiladas para móvil (< 1024 px) */}
                  <div className="admin-cards-list admin-mobile-only">
                    {res.items.map((client: AdminClientListItem) => (
                      <Link
                        key={client.business_id}
                        to={`/admin/clientes/${client.business_id}`}
                        state={{ from: location.search }}
                        className="card admin-client-card"
                      >
                        <div className="admin-client-card-top">
                          <div>
                            <strong className="admin-business-name">{client.commercial_name}</strong>
                            <span className="admin-client-card-nit">NIT {fmtNit(client.nit, client.dv)}</span>
                          </div>
                          {statusBadge(client.subscription_status)}
                        </div>

                        <div className="admin-client-card-meta">
                          <span className="admin-meta-item">
                            <span className="admin-meta-label">Tipo:</span> {tipoLabel(client.income_source)}
                          </span>
                          <span className="admin-meta-item">
                            <span className="admin-meta-label">Plan:</span> {client.plan || '—'}
                          </span>
                          <span className="admin-meta-item">
                            <span className="admin-meta-label">Corte:</span>{' '}
                            {client.cutoff_date ? fmtBogotaDate(client.cutoff_date) : '—'}
                          </span>
                        </div>

                        <div className="admin-client-card-footer">
                          <span
                            className={`admin-pill-telegram ${client.is_telegram_linked ? 'linked' : 'unlinked'}`}
                          >
                            Telegram: {client.is_telegram_linked ? 'Vinculado' : 'Sin vincular'}
                          </span>
                          <span className="admin-arrow-indicator">Ver ficha →</span>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Paginación */}
                  {totalPages > 1 && (
                    <div className="admin-pagination" role="navigation" aria-label="Paginación de clientes">
                      <button
                        type="button"
                        className="btn-outline admin-page-btn"
                        disabled={!hasPrev}
                        onClick={() => handlePageChange(res.page - 1)}
                      >
                        Anterior
                      </button>
                      <span className="admin-page-info">
                        Página {res.page} de {totalPages}
                      </span>
                      <button
                        type="button"
                        className="btn-outline admin-page-btn"
                        disabled={!hasNext}
                        onClick={() => handlePageChange(res.page + 1)}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
