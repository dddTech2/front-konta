import { useEffect, useRef, useState } from 'react';
import { isMixed } from '../api/client';
import { getIncomeSummary } from '../api/endpoints';
import type { IncomeSummaryItem, IncomeSummaryResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RecentSales from '../components/RecentSales';
import { ResourceView } from '../components/ScreenState';
import { fmtMoney, fmtMoneyCompact, fmtMoneyExact, fmtPercent, fmtPeriod, recentMonths } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function shortMonth(ym: string): string {
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const idx = Number(parts[1]) - 1;
  return SHORT_MONTHS[idx] ?? ym;
}

function MixedBars({
  historial,
  selectedMonth,
}: {
  historial: IncomeSummaryItem[];
  selectedMonth: string;
}) {
  if (!historial || historial.length === 0) return null;

  const maxTotal = Math.max(
    0,
    ...historial.map((h) => {
      const e = Number(h.emitido ?? 0);
      const v = Number(h.ventas ?? 0);
      return e + v > 0 ? e + v : Number(h.ingresos ?? 0);
    }),
  );

  return (
    <>
      <ul className="card bars" aria-label="Ingresos de los últimos meses">
        {historial.map((item) => {
          const emitidoVal = Number(item.emitido ?? 0);
          const ventasVal = Number(item.ventas ?? 0);
          const total = emitidoVal + ventasVal > 0 ? emitidoVal + ventasVal : Number(item.ingresos ?? 0);
          const heightPct = maxTotal > 0 ? Math.max(8, (total / maxTotal) * 100) : 8;
          const isSelected = item.month === selectedMonth;
          const emitidoPortion = total > 0 ? (emitidoVal / total) * 100 : 0;
          const ventasPortion = total > 0 ? (ventasVal / total) * 100 : 0;
          const label = shortMonth(item.month);

          return (
            <li
              key={item.month}
              className="bar-col"
              aria-label={`${label}: ${fmtMoney(total)}`}
            >
              <div className="bar-track">
                <span className={isSelected ? 'bar-value bar-value-current' : 'bar-value'} aria-hidden="true">
                  {fmtMoneyCompact(total)}
                </span>
                <div className="bar mixed-bar-stacked" style={{ height: `${heightPct}%` }}>
                  {emitidoPortion > 0 && (
                    <div
                      className="mixed-bar-stack-emitido"
                      style={{ height: `${emitidoPortion}%` }}
                      title={`Facturado: ${fmtMoney(emitidoVal)}`}
                    />
                  )}
                  {ventasPortion > 0 && (
                    <div
                      className="mixed-bar-stack-ventas"
                      style={{ height: `${ventasPortion}%` }}
                      title={`Ventas: ${fmtMoney(ventasVal)}`}
                    />
                  )}
                  {emitidoPortion === 0 && ventasPortion === 0 && (
                    <div style={{ height: '100%', width: '100%', background: 'var(--beige)' }} />
                  )}
                </div>
              </div>
              <span className="bar-label">{label}</span>
            </li>
          );
        })}
      </ul>
      <div className="mixed-chart-legend">
        <span className="mixed-legend-item">
          <span className="mixed-legend-dot dot-emitido" aria-hidden="true" />
          Facturado
        </span>
        <span className="mixed-legend-item">
          <span className="mixed-legend-dot dot-ventas" aria-hidden="true" />
          Ventas
        </span>
      </div>
    </>
  );
}

function MixedFacturadoVsVentas({ data }: { data: IncomeSummaryResponse }) {
  const emitidoNum = Number(data.emitido ?? 0);
  const ventasNum = Number(data.ventas ?? 0);
  const diffNum = data.diferencia !== undefined ? Number(data.diferencia) : emitidoNum - ventasNum;
  const absDiff = Math.abs(diffNum);
  const formattedDiff = fmtMoneyExact(absDiff);

  // Participación sobre los ingresos del mes, en 0–100 (Story 10.4).
  const rawEmitidoPct = Number(data.emitido_pct ?? 0);
  const rawVentasPct = Number(data.ventas_pct ?? 0);

  let diffPhrase = '';
  if (emitidoNum > ventasNum || (emitidoNum === ventasNum && diffNum > 0)) {
    diffPhrase = `Facturaste ${formattedDiff} más de lo que registraste como ventas`;
  } else if (ventasNum > emitidoNum || (emitidoNum === ventasNum && diffNum < 0)) {
    diffPhrase = `Registraste ${formattedDiff} más en ventas que en facturas`;
  } else {
    diffPhrase = 'Facturación y ventas registradas son iguales';
  }

  return (
    <section className="mixed-contrast-block" aria-label="Facturado vs Ventas">
      <h2 className="section-title">Facturado vs Ventas</h2>
      <div className="metric-row">
        <div className="card metric card-emitido">
          <p className="metric-label">Facturado electrónicamente</p>
          <p className="metric-value">{fmtMoneyExact(data.emitido ?? '0')}</p>
          <p className="metric-sub">
            {data.emitido_count ?? 0} {data.emitido_count === 1 ? 'factura' : 'facturas'}
          </p>
        </div>
        <div className="card metric card-ventas">
          <p className="metric-label">Ventas registradas</p>
          <p className="metric-value">{fmtMoneyExact(data.ventas ?? '0')}</p>
          <p className="metric-sub">
            {data.ventas_count ?? 0} {data.ventas_count === 1 ? 'venta' : 'ventas'}
          </p>
        </div>
      </div>

      <div className="mixed-bar-wrapper">
        <div className="mixed-bar-track" aria-label="Participación">
          <div
            className="mixed-bar-segment mixed-bar-emitido"
            style={{ width: `${rawEmitidoPct}%` }}
            title={`Facturado: ${fmtPercent(rawEmitidoPct)} %`}
          />
          <div
            className="mixed-bar-segment mixed-bar-ventas"
            style={{ width: `${rawVentasPct}%` }}
            title={`Ventas: ${fmtPercent(rawVentasPct)} %`}
          />
        </div>
        <div className="mixed-bar-legend">
          <span className="mixed-legend-item">
            <span className="mixed-legend-dot dot-emitido" aria-hidden="true" />
            <span className="mixed-legend-label">Facturado</span>{' '}
            <strong className="mixed-legend-pct">{fmtPercent(rawEmitidoPct)} %</strong>
          </span>
          <span className="mixed-legend-item">
            <span className="mixed-legend-dot dot-ventas" aria-hidden="true" />
            <span className="mixed-legend-label">Ventas</span>{' '}
            <strong className="mixed-legend-pct">{fmtPercent(rawVentasPct)} %</strong>
          </span>
        </div>
      </div>

      <div className="card mixed-diff-box">
        <p className="mixed-diff-line">Diferencia: {formattedDiff}</p>
        <p className="mixed-diff-text">{diffPhrase}</p>
        <p className="mixed-clients-count">Clientes facturados: {data.clientes_count ?? 0}</p>
      </div>
    </section>
  );
}

/**
 * Resumen de un negocio de ventas manuales o perfil mixto (Story 6.4, Story 10.5).
 * `refreshKey` cambia al registrar una venta: vuelve al mes en curso y se consulta de nuevo.
 * 401/403/red los resuelve `apiFetch` (ADR-005); aquí solo se pintan los estados de carga, error y sin datos.
 */
export default function Resumen({
  businessId,
  refreshKey = 0,
  isMixedProfile,
}: {
  businessId: string;
  refreshKey?: number;
  isMixedProfile?: boolean;
}) {
  const { me } = useAuth();
  const mixed = isMixedProfile ?? isMixed(me);

  const months = recentMonths(6);
  const [month, setMonth] = useState<string>(() => months[0]);
  const [voidVersion, setVoidVersion] = useState(0);
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    if (prevRefreshKey.current !== refreshKey) {
      prevRefreshKey.current = refreshKey;
      setMonth(recentMonths(6)[0]);
    }
  }, [refreshKey]);

  const { state, retry } = useResource(
    () => getIncomeSummary(businessId, month),
    [businessId, month, refreshKey, voidVersion],
  );

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
              {mixed && <MixedFacturadoVsVentas data={data} />}

              <section className="hero" aria-label="Utilidad del mes">
                <p className="hero-label">Utilidad estimada · {fmtPeriod(month)}</p>
                <p className="hero-total">{fmtMoneyExact(data.utilidad)}</p>
              </section>

              <div className="metric-row">
                <div className="card metric">
                  <p className="metric-label">{mixed ? 'Ingresos totales' : 'Ingresos'}</p>
                  <p className="metric-value">{fmtMoneyExact(data.ingresos)}</p>
                </div>
                <div className="card metric">
                  <p className="metric-label">Egresos</p>
                  <p className="metric-value">{fmtMoneyExact(data.egresos)}</p>
                </div>
              </div>

              {mixed && data.historial && data.historial.length > 0 && (
                <section className="mixed-history-section" aria-label="Historial de facturación y ventas">
                  <h2 className="section-title">Últimos meses</h2>
                  <MixedBars historial={data.historial} selectedMonth={month} />
                </section>
              )}

              {sinDatos && <p className="list-empty">Aún no hay ventas ni facturas recibidas en este mes.</p>}
              <p className="row-sub">
                {mixed
                  ? 'Estimación de gestión: ingresos (facturado + ventas) menos facturas recibidas.'
                  : 'Estimación de gestión: ingresos por ventas menos facturas recibidas.'}
              </p>
            </>
          );
        }}
      </ResourceView>
      <RecentSales
        businessId={businessId}
        month={month}
        refreshKey={refreshKey}
        onVoided={() => setVoidVersion((n) => n + 1)}
      />
    </section>
  );
}
