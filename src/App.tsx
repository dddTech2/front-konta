import { useState, type ComponentType, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import type { SaleResponse } from './api/types';
import { useAuth } from './auth/AuthContext';
import SalesForm from './components/SalesForm';
import SalesMenuItem from './components/SalesMenuItem';
import { fmtMoneyExact } from './format';
import Calendario from './screens/Calendario';
import Dashboard from './screens/Dashboard';
import Historial from './screens/Historial';
import IvaDetail from './screens/IvaDetail';
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

interface Section {
  path: string;
  label: string;
  Screen: ComponentType<{ businessId: string }>;
}

const SECTIONS: Section[] = [
  { path: '/inicio', label: 'Inicio', Screen: Dashboard },
  { path: '/iva', label: 'IVA', Screen: IvaDetail },
  { path: '/historial', label: 'Facturas', Screen: Historial },
  { path: '/calendario', label: 'Calendario', Screen: Calendario },
];

function Shell() {
  const { logout, me } = useAuth();
  const [salesOpen, setSalesOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<SaleResponse | null>(null);
  // RequireSession ya garantiza un negocio; esto solo estrecha el tipo.
  const businessId = me?.business_id;
  if (!businessId) return null;

  function onSaleRegistered(sale: SaleResponse) {
    setSalesOpen(false);
    setConfirmation(sale);
  }

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="row-between">
          <span className="shell-brand">Kontable</span>
          <div className="shell-actions">
            <SalesMenuItem onOpen={() => setSalesOpen(true)} />
            <button className="btn-link" type="button" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
      </header>
      {confirmation && (
        <div className="sale-confirmation" role="status">
          <span>Venta registrada por {fmtMoneyExact(confirmation.total_amount)}.</span>
          <button className="btn-link" type="button" onClick={() => setConfirmation(null)}>
            Cerrar
          </button>
        </div>
      )}
      {salesOpen && (
        <SalesForm businessId={businessId} onClose={() => setSalesOpen(false)} onRegistered={onSaleRegistered} />
      )}
      <nav className="shell-nav" aria-label="Secciones">
        {SECTIONS.map((section) => (
          <NavLink key={section.path} to={section.path} className={({ isActive }) => (isActive ? 'active' : '')}>
            {section.label}
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        <Routes>
          {SECTIONS.map(({ path, Screen }) => (
            <Route key={path} path={path} element={<Screen businessId={businessId} />} />
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
