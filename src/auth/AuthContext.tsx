import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { ApiError, configureApi, getMe, resetApi, type Me, type SuspensionDetail } from '../api/client';
import { clearToken, getToken, restoreToken, setToken } from './session';

/**
 * anonymous   -> sin token: login.
 * loading     -> hay token y se está consultando `/me`.
 * ready       -> `/me` respondió: `me` está disponible.
 * unavailable -> hay token pero `/me` no pudo cargarse (red caída o error del servidor): se puede reintentar.
 */
export type SessionStatus = 'anonymous' | 'loading' | 'ready' | 'unavailable';

interface AuthState {
  status: SessionStatus;
  me: Me | null;
  /** Detalle del último 403 recibido; null si no hubo o si `/me` confirmó que ya no está bloqueado. */
  suspended: SuspensionDetail | null;
  networkError: boolean;
}

type Action =
  | { type: 'loading' }
  | { type: 'me'; me: Me }
  | { type: 'unavailable' }
  | { type: 'logout' }
  | { type: 'forbidden'; detail: SuspensionDetail }
  | { type: 'network'; down: boolean };

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'loading':
      return { ...state, status: 'loading' };
    case 'me':
      return {
        ...state,
        status: 'ready',
        me: action.me,
        suspended: action.me.is_blocked ? state.suspended : null,
      };
    case 'unavailable':
      return { ...state, status: 'unavailable' };
    case 'logout':
      return { status: 'anonymous', me: null, suspended: null, networkError: false };
    case 'forbidden':
      // Un 403 tardío de una sesión ya cerrada no debe dejar detalle de suspensión para el siguiente login.
      return state.status === 'anonymous' ? state : { ...state, suspended: action.detail };
    case 'network':
      return state.networkError === action.down ? state : { ...state, networkError: action.down };
  }
}

export interface AuthContextValue extends AuthState {
  /** true si el negocio está bloqueado (`/me` o un 403 en cualquier llamada). */
  isSuspended: boolean;
  /** Guarda el token, consulta `/me` y deja la sesión lista. */
  login: (token: string) => Promise<void>;
  logout: () => void;
  /** Vuelve a consultar `/me` (reintento de red o "ya pagué"); true si `/me` respondió. */
  refreshMe: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function initialState(): AuthState {
  const token = restoreToken();
  return { status: token ? 'loading' : 'anonymous', me: null, suspended: null, networkError: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Se incrementa en cada login/logout para descartar respuestas de `/me` de una sesión anterior.
  const epochRef = useRef(0);

  const loadMe = useCallback(async (): Promise<boolean> => {
    if (!getToken()) return false;
    const epoch = epochRef.current;
    if (stateRef.current.status !== 'ready') dispatch({ type: 'loading' });
    try {
      const me = await getMe();
      if (epoch !== epochRef.current) return false;
      dispatch({ type: 'me', me });
      return true;
    } catch (error) {
      if (epoch !== epochRef.current) return false;
      // Un 401 ya cerró la sesión en el handler; el resto (red, 5xx) deja la sesión y permite reintentar.
      if (!(error instanceof ApiError && error.kind === 'unauthorized')) {
        if (stateRef.current.status !== 'ready') dispatch({ type: 'unavailable' });
      }
      return false;
    }
  }, []);

  // Se declara antes del efecto de restauración: React ejecuta los efectos en orden, así que los
  // handlers ya están listos cuando `loadMe` hace la primera llamada.
  useEffect(() => {
    configureApi({
      getToken,
      onUnauthorized: () => {
        epochRef.current += 1;
        clearToken();
        dispatch({ type: 'logout' });
      },
      onForbidden: (detail) => dispatch({ type: 'forbidden', detail }),
      onNetworkError: () => dispatch({ type: 'network', down: true }),
      onNetworkRecovered: () => dispatch({ type: 'network', down: false }),
    });
    return () => resetApi();
  }, []);

  useEffect(() => {
    if (stateRef.current.status === 'loading') void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (token: string) => {
      epochRef.current += 1;
      setToken(token);
      dispatch({ type: 'loading' });
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    epochRef.current += 1;
    clearToken();
    dispatch({ type: 'logout' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isSuspended: state.suspended !== null || state.me?.is_blocked === true,
      login,
      logout,
      refreshMe: loadMe,
    }),
    [state, login, logout, loadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return value;
}
