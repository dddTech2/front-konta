import { useState } from 'react';
import { getIva } from '../api/endpoints';
import type { IvaDetailResponse, IvaPeriodItem } from '../api/types';
import { Icon } from '../components/Icon';
import RingSvg from '../components/RingSvg';
import { ResourceView } from '../components/ScreenState';
import { StatusDot } from '../components/StatusDot';
import { capitalize, fmtMoney, vencePhrase } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

const ESTADO_LABEL: Record<string, string> = { en_curso: 'En curso', presentado: 'Presentado' };

/** Presentado se decide por `estado`; los días solo cuentan mientras el periodo sigue en curso. */
function DueLine({ period }: { period: IvaPeriodItem }) {
  if (period.estado === 'presentado') {
    return <p className="ring-due ring-due-done">Presentado · límite era {period.limite}</p>;
  }
  if (period.dias !== null) {
    return (
      <p className="ring-due">
        {capitalize(vencePhrase(period.dias))} · {period.limite}
      </p>
    );
  }
  return <p className="ring-due">Límite {period.limite}</p>;
}

function PeriodBody({ period }: { period: IvaPeriodItem }) {
  const toPay = period.saldo >= 0;
  return (
    <>
      <div className="card ring-card">
        <RingSvg pct={period.pct} />
        <div>
          <p className="metric-label">{toPay ? 'Saldo a pagar' : 'Saldo a favor'}</p>
          <p className="ring-amount">{fmtMoney(Math.abs(period.saldo))}</p>
          <DueLine period={period} />
        </div>
      </div>

      <div className="card breakdown">
        <div className="breakdown-row">
          <span>IVA generado</span>
          <strong>{fmtMoney(period.generado)}</strong>
        </div>
        <div className="breakdown-row">
          <span>IVA descontable</span>
          <strong>{fmtMoney(period.descontable)}</strong>
        </div>
      </div>

      <h2 className="section-title">Facturas de este periodo</h2>
      <div className="card list-card">
        {period.facturas.length === 0 && <p className="list-empty">No hay facturas en este periodo.</p>}
        {period.facturas.map((invoice, index) => (
          <div className="list-row" key={`${invoice.fecha}-${invoice.cliente}-${index}`}>
            <div>
              <p className="row-title">{invoice.cliente}</p>
              <p className="row-sub">
                {invoice.fecha} · {invoice.tipo}
              </p>
            </div>
            <p className="row-amount">{fmtMoney(invoice.valor)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function IvaContent({ data }: { data: IvaDetailResponse }) {
  // La API entrega los periodos del más reciente al más antiguo.
  const [index, setIndex] = useState(0);
  const periods = data.periodos;
  if (periods.length === 0) {
    return <p className="list-empty">Aún no hay periodos de IVA para tu negocio.</p>;
  }
  const safeIndex = Math.min(index, periods.length - 1);
  const period = periods[safeIndex];
  const olderDisabled = safeIndex >= periods.length - 1;
  const newerDisabled = safeIndex <= 0;

  return (
    <>
      <section className="iva-hero" aria-label="Periodo de IVA">
        <p className="iva-hero-biz">{data.nombre}</p>
        <div className="row-between">
          <button
            type="button"
            className="round-btn"
            aria-label="Periodo anterior"
            disabled={olderDisabled}
            onClick={() => setIndex(safeIndex + 1)}
          >
            <Icon name="chevronLeft" />
          </button>
          <div className="iva-hero-center">
            <p className="iva-hero-title">{period.etiqueta}</p>
            <span className="chip">
              <StatusDot estado={period.estado} /> {ESTADO_LABEL[period.estado] ?? period.estado}
            </span>
          </div>
          <button
            type="button"
            className="round-btn"
            aria-label="Periodo siguiente"
            disabled={newerDisabled}
            onClick={() => setIndex(safeIndex - 1)}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </section>
      <PeriodBody period={period} />
    </>
  );
}

export default function IvaDetail({ businessId }: { businessId: string }) {
  const { state, retry } = useResource(() => getIva(businessId), [businessId]);
  return (
    <section aria-label="IVA" className="screen">
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tu IVA…">
        {(data) => <IvaContent data={data} />}
      </ResourceView>
    </section>
  );
}
