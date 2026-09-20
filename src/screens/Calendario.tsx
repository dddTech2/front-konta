import { ApiError } from '../api/client';
import { getCalendar } from '../api/endpoints';
import type { CalendarObligation, CalendarResponse } from '../api/types';
import { Icon } from '../components/Icon';
import { ResourceView } from '../components/ScreenState';
import { StatusDot } from '../components/StatusDot';
import { estadoColor, fmtDeadline, taxLabel } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

function pillLabel(item: CalendarObligation): string {
  if (item.estado === 'completado') return 'Completado';
  if (item.dias === 0) return 'Vence hoy';
  if (item.dias !== null && item.dias > 0) return `En ${item.dias} ${item.dias === 1 ? 'día' : 'días'}`;
  return 'Al día';
}

function ObligationList({ items, empty }: { items: CalendarObligation[]; empty: string }) {
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
        <li className="list-row" key={`${item.tax_type}|${item.etiqueta}|${item.fecha_limite}`}>
          <div className="row-lead">
            <div className="icon-tile">
              <Icon name="calendar" />
            </div>
            <div>
              <p className="row-title">{taxLabel(item.tax_type)}</p>
              <p className="row-sub">{`${item.etiqueta} · ${fmtDeadline(item.fecha_limite)}`}</p>
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

function CalendarContent({ data }: { data: CalendarResponse | null }) {
  if (data === null) {
    return (
      <div className="card list-card" role="status">
        <h2 className="group-title" style={{ paddingTop: '12px' }}>
          Calendario no disponible
        </h2>
        <p className="list-empty">
          Aún no tenemos cargado el calendario tributario de este año. Inténtalo de nuevo más tarde.
        </p>
      </div>
    );
  }

  const upcoming = data.obligaciones.filter((item) => item.estado === 'proximo' || item.estado === 'aldia');
  const done = data.obligaciones.filter((item) => item.estado === 'completado');

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
  const { state, retry } = useResource(
    () =>
      getCalendar(businessId).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 409) return null;
        throw error;
      }),
    [businessId],
  );
  return (
    <section aria-label="Calendario" className="screen">
      <h1 className="screen-title">Calendario de vencimientos</h1>
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tus vencimientos…">
        {(data) => <CalendarContent data={data} />}
      </ResourceView>
    </section>
  );
}
