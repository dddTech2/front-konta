import type { ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Login from './screens/Login';
import SinNegocio from './screens/SinNegocio';
import Suspended from './screens/Suspended';

function NetworkBanner() {
  const { networkError, refreshMe } = useAuth();
  if (!networkError) return null;
  return (
    <div className="network-banner" role="status">
      <span>No pudimos conectar con el servidor.</span>
      <button type="button" onClick={() => void refreshMe()}>
        Reintentar
      </button>
    </div>
  );
}

function LoginRoute() {
  const { status } = useAuth();
  if (status !== 'anonymous') return <Navigate to="/inicio" replace />;
  return <Login />;
}

/** Guarda de rutas: decide qué pantalla corresponde a la sesión antes de mostrar el shell. */
function RequireSession({ children }: { children: ReactNode }) {
  const { status, me, isSuspended, refreshMe } = useAuth();

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  // Un 403 de cualquier llamada (incluida `/me`) es Servicio Suspendido, aunque `/me` no haya cargado.
  // La sesión no se toca: 401 y 403 nunca se confunden.
  if (isSuspended) return <Suspended />;
  if (status === 'loading') return <p className="loading">Cargando tu sesión…</p>;
  if (status === 'unavailable' || !me) {
    return (
      <main className="page page-center">
        <h1 className="h-title">No pudimos cargar tu sesión</h1>
        <p className="lead">Tu sesión sigue abierta. Revisa tu conexión o inténtalo de nuevo en unos minutos.</p>
        <button className="btn-primary" type="button" onClick={() => void refreshMe()}>
          Reintentar
        </button>
      </main>
    );
  }
  if (me.business_id === null) return <SinNegocio />;
  return <>{children}</>;
}

/** Espacio reservado para las pantallas de la Story 5.2b. */
function Slot({ name }: { name: string }) {
  return (
    <section aria-label={name} className="slot-empty">
      <h2 className="h-title" style={{ fontSize: 20 }}>
        {name}
      </h2>
      <p>Esta sección estará disponible próximamente.</p>
    </section>
  );
}

const SECTIONS = [
  { path: '/inicio', label: 'Inicio' },
  { path: '/iva', label: 'IVA' },
  { path: '/historial', label: 'Facturas' },
  { path: '/calendario', label: 'Calendario' },
];

function Shell() {
  const { logout } = useAuth();
  return (
    <div className="shell">
      <header className="shell-header">
        <div className="row-between">
          <span className="shell-brand">Kontable</span>
          <button className="btn-link" type="button" onClick={logout}>
            Salir
          </button>
        </div>
      </header>
      <nav className="shell-nav" aria-label="Secciones">
        {SECTIONS.map((section) => (
          <NavLink key={section.path} to={section.path} className={({ isActive }) => (isActive ? 'active' : '')}>
            {section.label}
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        <Routes>
          {SECTIONS.map((section) => (
            <Route key={section.path} path={section.path} element={<Slot name={section.label} />} />
          ))}
          <Route path="*" element={<Navigate to="/inicio" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { status } = useAuth();
  return (
    <>
      {status === 'ready' && <NetworkBanner />}
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/*"
          element={
            <RequireSession>
              <Shell />
            </RequireSession>
          }
        />
      </Routes>
    </>
  );
}
