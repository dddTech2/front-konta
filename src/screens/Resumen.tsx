import { useEffect, useRef, useState } from 'react';
import { isMixed } from '../api/client';
import { getIncomeSummary } from '../api/endpoints';
import type { IncomeSummaryItem, IncomeSummaryResponse } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import RecentSales from '../components/RecentSales';
import { ResourceView } from '../components/ScreenState';
import { fmtMoney, fmtMoneyExact, fmtPeriod, recentMonths } from '../format';
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

  // Facturado y ventas son cifras independientes (Q-10b): barras lado a lado, cada una contra el máximo.
  const maxValue = Math.max(
    0,
    ...historial.flatMap((h) => [Number(h.emitido ?? 0), Number(h.ventas ?? 0)]),
  );
  const heightOf = (value: number) => (maxValue > 0 && value > 0 ? Math.max(4, (value / maxValue) * 100) : 0);

  return (
    <>
      <ul className="card bars" aria-label="Facturado y ventas de los últimos meses">
        {historial.map((item) => {
          const emitidoVal = Number(item.emitido ?? 0);
          const ventasVal = Number(item.ventas ?? 0);
          const isSelected = item.month === selectedMonth;
          const label = shortMonth(item.month);

          return (
            <li
              key={item.month}
              className="bar-col"
              aria-label={`${label}: facturado ${fmtMoney(emitidoVal)}, ventas ${fmtMoney(ventasVal)}`}
            >
              <div className="bar-track mixed-bar-pair">
                <div
                  className="mixed-bar-single mixed-bar-single-emitido"
                  style={{ height: `${heightOf(emitidoVal)}%` }}
                  title={`Facturado: ${fmtMoney(emitidoVal)}`}
                />
                <div
                  className="mixed-bar-single mixed-bar-single-ventas"
                  style={{ height: `${heightOf(ventasVal)}%` }}
                  title={`Ventas: ${fmtMoney(ventasVal)}`}
                />
              </div>
              <span className={isSelected ? 'bar-label bar-value-current' : 'bar-label'}>{label}</span>
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
  const formattedDiff = fmtMoneyExact(Math.abs(diffNum));

  let diffPhrase = '';
  if (diffNum > 0) {
    diffPhrase = `Facturaste ${formattedDiff} más de lo que registraste como ventas`;
  } else if (diffNum < 0) {
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
          if (mixed) {
            const sinDatosMixto =
              Number(data.emitido ?? 0) === 0 && Number(data.ventas ?? 0) === 0 && Number(data.egresos) === 0;
            return (
              <>
                <MixedFacturadoVsVentas data={data} />

                <div className="metric-row">
                  <div className="card metric">
                    <p className="metric-label">Egresos</p>
                    <p className="metric-value">{fmtMoneyExact(data.egresos)}</p>
                  </div>
                </div>

                {data.historial && data.historial.length > 0 && (
                  <section className="mixed-history-section" aria-label="Historial de facturación y ventas">
                    <h2 className="section-title">Últimos meses</h2>
                    <MixedBars historial={data.historial} selectedMonth={month} />
                  </section>
                )}

                {sinDatosMixto && <p className="list-empty">Aún no hay facturas ni ventas en este mes.</p>}
                <p className="row-sub">
                  Lo facturado y las ventas se muestran por separado; no se suman. Los egresos son tus facturas
                  recibidas.
                </p>
              </>
            );
          }

          const sinDatos = Number(data.ingresos) === 0 && Number(data.egresos) === 0;
          return (
            <>
              <section className="hero" aria-label="Utilidad del mes">
                <p className="hero-label">Utilidad estimada · {fmtPeriod(month)}</p>
                <p className="hero-total">{fmtMoneyExact(data.utilidad ?? '0')}</p>
              </section>

              <div className="metric-row">
                <div className="card metric">
                  <p className="metric-label">Ingresos</p>
                  <p className="metric-value">{fmtMoneyExact(data.ingresos ?? '0')}</p>
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
      <RecentSales
        businessId={businessId}
        month={month}
        refreshKey={refreshKey}
        onVoided={() => setVoidVersion((n) => n + 1)}
      />
    </section>
  );
}
