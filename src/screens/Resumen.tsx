import { useEffect, useRef, useState } from 'react';
import { getIncomeSummary } from '../api/endpoints';
import { ResourceView } from '../components/ScreenState';
import { fmtMoneyExact, fmtPeriod, recentMonths } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

/**
 * Resumen de un negocio de ventas manuales: ingresos, egresos y utilidad estimada del mes (Story 6.4).
 * `refreshKey` cambia al registrar una venta: vuelve al mes en curso y se consulta de nuevo.
 * 401/403/red los resuelve `apiFetch` (ADR-005); aquí solo se pintan los estados de carga, error y sin datos.
 */
export default function Resumen({ businessId, refreshKey = 0 }: { businessId: string; refreshKey?: number }) {
  const months = recentMonths(6);
  const [month, setMonth] = useState<string>(() => months[0]);
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    if (prevRefreshKey.current !== refreshKey) {
      prevRefreshKey.current = refreshKey;
      setMonth(recentMonths(6)[0]);
    }
  }, [refreshKey]);

  const { state, retry } = useResource(() => getIncomeSummary(businessId, month), [businessId, month, refreshKey]);

  return (
    <section aria-label="Resumen" className="screen">
      <div className="filter-row">
        <select
          className="month-select"
          aria-label="Mes"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {fmtPeriod(m)}
            </option>
          ))}
        </select>
      </div>
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tu resumen…">
        {(data) => {
          const sinDatos = Number(data.ingresos) === 0 && Number(data.egresos) === 0;
          return (
            <>
              <section className="hero" aria-label="Utilidad del mes">
                <p className="hero-label">Utilidad estimada · {fmtPeriod(month)}</p>
                <p className="hero-total">{fmtMoneyExact(data.utilidad)}</p>
              </section>
              <div className="metric-row">
                <div className="card metric">
                  <p className="metric-label">Ingresos</p>
                  <p className="metric-value">{fmtMoneyExact(data.ingresos)}</p>
                </div>
                <div className="card metric">
                  <p className="metric-label">Egresos</p>
                  <p className="metric-value">{fmtMoneyExact(data.egresos)}</p>
                </div>
              </div>
              {sinDatos && <p className="list-empty">Aún no hay ventas ni facturas recibidas en este mes.</p>}
              <p className="row-sub">Estimación de gestión: ingresos por ventas menos facturas recibidas.</p>
            </>
          );
        }}
      </ResourceView>
    </section>
  );
}
