import type { ReactNode } from 'react';
import type { ResourceState } from '../hooks/useResource';

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="screen-loading" role="status">
      {label}
    </p>
  );
}

/**
 * Error de carga (red o 5xx) con reintento. Un 401/403 no llega aquí: lo resuelve el wrapper de `apiFetch`.
 * Si además se cayó la red, el banner global de 5.2a aparece por su cuenta.
 */
export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="screen-error" role="alert">
      <p>{message}</p>
      <button className="btn-outline" type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

interface ResourceViewProps<T> {
  state: ResourceState<T>;
  onRetry: () => void;
  loadingLabel?: string;
  children: (data: T) => ReactNode;
}

/** Elige entre cargando, error y contenido según el estado del recurso. */
export function ResourceView<T>({ state, onRetry, loadingLabel, children }: ResourceViewProps<T>) {
  if (state.status === 'loading') return <LoadingBlock label={loadingLabel} />;
  if (state.status === 'error') return <ErrorBlock message={state.message} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}
