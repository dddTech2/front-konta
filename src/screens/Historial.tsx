import { useEffect, useRef, useState } from 'react';
import { getInvoices, type InvoiceQuery } from '../api/endpoints';
import type { GroupType, InvoiceDetailItem } from '../api/types';
import { Icon } from '../components/Icon';
import { ResourceView } from '../components/ScreenState';
import { fmtMoney, fmtPeriod, recentMonths } from '../format';
import { errorMessage, isSessionError, useResource } from '../hooks/useResource';
import '../styles/screens.css';

const SEARCH_DEBOUNCE_MS = 300;
const MONTH_OPTIONS = 12;
const GROUPS: Array<{ label: string; value: GroupType | null }> = [
  { label: 'Todas', value: null },
  { label: 'Emitido', value: 'Emitido' },
  { label: 'Recibido', value: 'Recibido' },
];

interface Filters {
  group: GroupType | null;
  period: string;
  search: string;
}

function toQuery(filters: Filters): InvoiceQuery {
  return {
    group: filters.group ?? undefined,
    period: filters.period || undefined,
    search: filters.search,
  };
}

function InvoiceRow({ invoice }: { invoice: InvoiceDetailItem }) {
  return (
    <li className="list-row">
      <div className="row-lead">
        <div className="icon-tile">
          <Icon name="check" />
        </div>
        <div>
          <p className="row-title">{invoice.cliente}</p>
          <p className="row-sub">
            {invoice.num} · {invoice.fecha_corta} · {invoice.group_type}
          </p>
        </div>
      </div>
      <p className="row-amount">{fmtMoney(invoice.valor)}</p>
    </li>
  );
}

/**
 * Resultados de una combinación de filtros. El padre le cambia la `key` al cambiar los filtros, así que cada
 * combinación arranca limpia y una respuesta tardía de otra combinación nunca se mezcla con esta lista.
 */
function InvoiceResults({ businessId, filters }: { businessId: string; filters: Filters }) {
  const first = useResource(() => getInvoices(businessId, { ...toQuery(filters), offset: 0 }), [businessId]);
  const [extra, setExtra] = useState<InvoiceDetailItem[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <ResourceView state={first.state} onRetry={first.retry} loadingLabel="Buscando facturas…">
      {(page) => {
        // Si la lista cambió en el servidor entre páginas, una factura puede repetirse: se descarta el duplicado.
        const seen = new Set<string>();
        const items = [...page.invoices, ...extra].filter((invoice) => {
          if (seen.has(invoice.id)) return false;
          seen.add(invoice.id);
          return true;
        });
        // El offset cuenta las filas pedidas al servidor (con duplicados), no las que se muestran.
        const fetched = page.invoices.length + extra.length;
        const canLoadMore = !exhausted && page.invoices.length > 0 && fetched < page.total_count;

        async function loadMore() {
          if (loadingMore) return;
          setLoadingMore(true);
          setMoreError(null);
          try {
            const next = await getInvoices(businessId, { ...toQuery(filters), offset: fetched });
            if (mounted.current) {
              setExtra((current) => [...current, ...next.invoices]);
              if (next.invoices.length === 0) setExhausted(true);
            }
          } catch (error) {
            if (mounted.current && !isSessionError(error)) setMoreError(errorMessage(error));
          } finally {
            if (mounted.current) setLoadingMore(false);
          }
        }

        return (
          <>
            <p className="result-count" role="status">
              {page.total_count === 0
                ? 'Sin resultados'
                : `Mostrando ${items.length} de ${page.total_count} ${page.total_count === 1 ? 'factura' : 'facturas'}`}
            </p>
            <ul className="card list-card plain-list">
              {items.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
              {items.length === 0 && <li className="list-empty">No se encontraron facturas.</li>}
            </ul>
            {moreError && (
              <p className="form-error" role="alert">
                {moreError}
              </p>
            )}
            {canLoadMore && (
              <button className="btn-outline load-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </>
        );
      }}
    </ResourceView>
  );
}

export default function Historial({ businessId }: { businessId: string }) {
  const [group, setGroup] = useState<GroupType | null>(null);
  const [period, setPeriod] = useState('');
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const months = recentMonths(MONTH_OPTIONS);

  // La búsqueda va al servidor: se espera a que el usuario deje de teclear para no pedir una lista por letra.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchText.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const filters: Filters = { group, period, search };
  const resultsKey = `${businessId}|${group ?? ''}|${period}|${search}`;

  return (
    <section aria-label="Facturas" className="screen">
      <h1 className="screen-title">Historial de facturas DIAN</h1>
      <label className="search-box">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Buscar facturas"
          placeholder="Buscar por cliente o número..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
      </label>
      <div className="filter-row">
        <div className="chips" role="group" aria-label="Tipo de factura">
          {GROUPS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={option.value === group ? 'chip-btn chip-btn-active' : 'chip-btn'}
              aria-pressed={option.value === group}
              onClick={() => setGroup(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <select
          className="month-select"
          aria-label="Mes"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="">Todos los meses</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {fmtPeriod(month)}
            </option>
          ))}
        </select>
      </div>
      <InvoiceResults key={resultsKey} businessId={businessId} filters={filters} />
    </section>
  );
}
