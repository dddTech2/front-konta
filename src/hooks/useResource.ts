import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string };

export const LOAD_ERROR_MESSAGE = 'No pudimos cargar esta información. Inténtalo de nuevo.';

/** 401 y 403 los resuelve el wrapper de `apiFetch` (login / Servicio Suspendido): la pantalla no los pinta. */
export function isSessionError(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === 'unauthorized' || error.kind === 'forbidden');
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : LOAD_ERROR_MESSAGE;
}

/**
 * Carga un recurso al montar y cada vez que cambian `deps`. Estado local por pantalla, sin store global (ADR-004).
 * Una respuesta que llega después de desmontar o de cambiar `deps` se descarta.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const stateRef = useRef(state);
  stateRef.current = state;

  // El "Reintentar" del banner de red (5.2a) vuelve a consultar `/me`; si responde, `me` es un objeto nuevo y una
  // pantalla que había quedado en error vuelve a pedir sus datos en lugar de esperar un segundo reintento.
  const { me } = useAuth();
  const lastMe = useRef(me);
  useEffect(() => {
    if (lastMe.current === me) return;
    lastMe.current = me;
    if (stateRef.current.status === 'error') setAttempt((n) => n + 1);
  }, [me]);

  useEffect(() => {
    let active = true;
    setState((current) => (current.status === 'loading' ? current : { status: 'loading' }));
    fetcherRef
      .current()
      .then((data) => {
        if (active) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!active || isSessionError(error)) return;
        setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
