import { Link } from 'react-router-dom';
import { getDashboard } from '../api/endpoints';
import type { DashboardResponse } from '../api/types';
import { Icon } from '../components/Icon';
import { ResourceView } from '../components/ScreenState';
import { StatusDot } from '../components/StatusDot';
import { capitalize, fmtMoney, fmtNit, fmtPercent, fmtPeriod, taxLabel, vencePhrase } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

const QUIET_STATES = new Set(['aldia', 'completado', 'sin_datos']);

function Hero({ data }: { data: DashboardResponse }) {
  const { business, resumen, alertaProximoVencimiento: alerta } = data;
  const up = resumen.variacion >= 0;
  return (
    <section className="hero" aria-label="Resumen del mes">
      <div className="row-between hero-top">
        <div>
          <div className="hero-biz">
            <span className="hero-name">{business.commercial_name}</span>
            <span className="hero-nit">NIT {fmtNit(business.nit, business.dv)}</span>
          </div>
        </div>
        <Link className="hero-bell" to="/calendario" aria-label="Ver calendario de vencimientos">
          <Icon name="bell" />
          {!QUIET_STATES.has(alerta.estado) && <span className="dot pulse hero-bell-dot" aria-hidden="true" />}
        </Link>
      </div>
      <p className="hero-label">Total facturado · {fmtPeriod(resumen.periodo)}</p>
      <p className="hero-total">{fmtMoney(resumen.total)}</p>
      <span className={up ? 'hero-var hero-var-up' : 'hero-var hero-var-down'}>
        <Icon name={up ? 'arrowUp' : 'arrowDown'} />
        {fmtPercent(resumen.variacion)}% vs. mes anterior
      </span>
    </section>
  );
}

function GraceBanner({ data }: { data: DashboardResponse }) {
  const { suscripcion } = data;
  if (!suscripcion.has_warning_banner) return null;
  const days = suscripcion.days_left_in_grace;
  let detail: string;
  if (days === null) detail = 'Tu suscripción está en mora. Regulariza tu pago para evitar el bloqueo del servicio.';
  else if (days <= 0) detail = 'Tu suscripción está en mora. Hoy es el último día antes del bloqueo del servicio.';
  else
    detail = `Tu suscripción está en mora. Restan ${days} ${days === 1 ? 'día' : 'días'} antes del bloqueo del servicio.`;
  return (
    <div className="grace-banner" role="status">
      <Icon name="alert" />
      <div>
        <strong>Periodo de Gracia Activo:</strong> {detail}
      </div>
    </div>
  );
}

function Bars({ data }: { data: DashboardResponse }) {
  const { historico } = data;
  const max = Math.max(0, ...historico.map((bar) => bar.total));
  return (
    <ul className="card bars" aria-label="Facturación de los últimos meses">
      {historico.map((bar, index) => {
        const height = max > 0 ? Math.max(8, (bar.total / max) * 100) : 8;
        const current = index === historico.length - 1;
        return (
          <li key={bar.period_year_month} className="bar-col" aria-label={`${bar.mes}: ${fmtMoney(bar.total)}`}>
            <div className={current ? 'bar bar-current' : 'bar'} style={{ height: `${height}%` }} />
            <span className="bar-label">{bar.mes}</span>
          </li>
        );
      })}
    </ul>
  );
}

function RecentInvoices({ data }: { data: DashboardResponse }) {
  const invoices = data.facturasRecientes.slice(0, 4);
  return (
    <>
      <div className="row-between section-head">
        <h2 className="section-title">Facturas recientes</h2>
        <Link className="link-small" to="/historial">
          Ver todas
        </Link>
      </div>
      <div className="card list-card">
        {invoices.length === 0 && <p className="list-empty">Aún no hay facturas emitidas.</p>}
        {invoices.map((invoice) => (
          <div className="list-row" key={invoice.id}>
            <div>
              <p className="row-title">{invoice.cliente}</p>
              <p className="row-sub">
                {invoice.num} · {invoice.fecha}
              </p>
            </div>
            <p className="row-amount">{fmtMoney(invoice.valor)}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardContent({ data }: { data: DashboardResponse }) {
  const { resumen, alertaProximoVencimiento: alerta } = data;
  // Una API anterior a la 4.1b no envía `tax_type`: se trata como sin tipo.
  const taxType = alerta.tax_type ?? null;
  const linkTo = taxType?.startsWith('IVA') ? '/iva' : '/calendario';
  const title =
    taxType !== null
      ? `${taxLabel(taxType)}${alerta.dias !== null ? ` ${vencePhrase(alerta.dias)}` : ''}`
      : alerta.etiqueta;
  let subtitle: string | null = null;
  if (alerta.limite !== null) {
    subtitle = `${capitalize(alerta.etiqueta)} · límite ${alerta.limite}`;
  } else if (taxType !== null) {
    subtitle = capitalize(alerta.etiqueta);
  }

  return (
    <>
      <Hero data={data} />
      <GraceBanner data={data} />
      <div className="metric-row">
        <div className="card metric">
          <p className="metric-label">IVA acumulado</p>
          <p className="metric-value">{fmtMoney(resumen.ivaAcumulado)}</p>
        </div>
        <div className="card metric">
          <p className="metric-label">Facturas emitidas</p>
          <p className="metric-value">{resumen.numFacturas}</p>
        </div>
      </div>

      <Link className="iva-link" to={linkTo}>
        <StatusDot estado={alerta.estado} />
        <div className="iva-link-text">
          <p className="iva-link-title">{title}</p>
          {subtitle !== null && <p className="iva-link-sub">{subtitle}</p>}
        </div>
        <Icon name="chevronRight" />
      </Link>

      <h2 className="section-title">Últimos 6 meses</h2>
      <Bars data={data} />
      <RecentInvoices data={data} />
    </>
  );
}

export default function Dashboard({ businessId }: { businessId: string }) {
  const { state, retry } = useResource(() => getDashboard(businessId), [businessId]);
  return (
    <section aria-label="Inicio" className="screen">
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tu resumen…">
        {(data) => <DashboardContent data={data} />}
      </ResourceView>
    </section>
  );
}
