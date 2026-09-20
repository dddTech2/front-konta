import { getIva } from '../api/endpoints';
import type { IvaDetailResponse, IvaPeriodItem } from '../api/types';
import { Icon } from '../components/Icon';
import { ResourceView } from '../components/ScreenState';
import { StatusDot } from '../components/StatusDot';
import { estadoColor } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

/** Umbral del prototipo (`DB.calendario`): a 10 días o menos el vencimiento se marca "próximo". */
const PROXIMO_DIAS = 10;

type CalendarState = 'completado' | 'proximo' | 'aldia';

interface Obligation {
  key: string;
  titulo: string;
  detalle: string;
  estado: CalendarState;
  dias: number | null;
}

/** Solo IVA: cada periodo de `/api/iva` es una obligación. No hay endpoint de calendario (Story 4.1 pendiente). */
export function deriveObligations(periodos: IvaPeriodItem[]): Obligation[] {
  return periodos.map((period) => {
    let estado: CalendarState;
    if (period.estado === 'presentado') estado = 'completado';
    else estado = period.dias !== null && period.dias <= PROXIMO_DIAS ? 'proximo' : 'aldia';
    return {
      key: period.period_key,
      titulo: 'Declaración de IVA',
      detalle: `${period.etiqueta} · ${period.limite}`,
      estado,
      dias: period.dias,
    };
  });
}

function pillLabel(item: Obligation): string {
  if (item.estado === 'completado') return 'Completado';
  if (item.dias === null) return 'Al día';
  if (item.dias === 0) return 'Vence hoy';
  if (item.dias > 0) return `En ${item.dias} ${item.dias === 1 ? 'día' : 'días'}`;
  return 'Venció';
}

function ObligationList({ items, empty }: { items: Obligation[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="card list-card">
        <p className="list-empty">{empty}</p>
      </div>
    );
  }
  return (
    <ul className="card list-card plain-list">
      {items.map((item) => (
        <li className="list-row" key={item.key}>
          <div className="row-lead">
            <div className="icon-tile">
              <Icon name="calendar" />
            </div>
            <div>
              <p className="row-title">{item.titulo}</p>
              <p className="row-sub">{item.detalle}</p>
            </div>
          </div>
          <span className="due-pill" style={{ color: estadoColor(item.estado) }}>
            <StatusDot estado={item.estado} /> {pillLabel(item)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CalendarContent({ data }: { data: IvaDetailResponse }) {
  const obligations = deriveObligations(data.periodos);
  const upcoming = obligations
    .filter((item) => item.estado !== 'completado')
    .sort((a, b) => (a.dias ?? Number.POSITIVE_INFINITY) - (b.dias ?? Number.POSITIVE_INFINITY));
  const done = obligations.filter((item) => item.estado === 'completado');
  return (
    <>
      <h2 className="group-title">Próximas ({upcoming.length})</h2>
      <ObligationList items={upcoming} empty="No tienes obligaciones próximas." />
      <h2 className="group-title">Completadas ({done.length})</h2>
      <ObligationList items={done} empty="Aún no hay obligaciones completadas." />
    </>
  );
}

export default function Calendario({ businessId }: { businessId: string }) {
  const { state, retry } = useResource(() => getIva(businessId), [businessId]);
  return (
    <section aria-label="Calendario" className="screen">
      <h1 className="screen-title">Calendario de vencimientos</h1>
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tus vencimientos…">
        {(data) => <CalendarContent data={data} />}
      </ResourceView>
    </section>
  );
}
