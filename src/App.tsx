import { useState, type ComponentType, type ReactNode } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { isAdmin, isManualSales } from './api/client';
import type { SaleResponse } from './api/types';
import { useAuth } from './auth/AuthContext';
import { BRAND_NAME } from './brand';
import SalesForm from './components/SalesForm';
import SalesMenuItem from './components/SalesMenuItem';
import { fmtMoneyExact } from './format';
import AdminShell from './screens/admin/AdminShell';
import Calendario from './screens/Calendario';
import Dashboard from './screens/Dashboard';
import Documentos from './screens/Documentos';
import Entrar from './screens/Entrar';
import Historial from './screens/Historial';
import IvaDetail from './screens/IvaDetail';
import Login from './screens/Login';
import Resumen from './screens/Resumen';
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
  const { status, me } = useAuth();
  if (status !== 'anonymous') {
    if (isAdmin(me)) return <Navigate to="/admin" replace />;
    return <Navigate to={isManualSales(me) ? '/resumen' : '/inicio'} replace />;
  }
  return <Login />;
}

/** Guarda de rutas: decide qué pantalla corresponde a la sesión antes de mostrar el shell. */
function RequireSession({ children }: { children: ReactNode }) {
  const { status, me, isSuspended, refreshMe } = useAuth();
  const location = useLocation();

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

  const admin = isAdmin(me);
  const isAdminPath = location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  if (admin) {
    if (!isAdminPath) {
      return <Navigate to="/admin" replace />;
    }
    return <>{children}</>;
  }

  // Cliente (o sin rol explícito: por defecto CLIENT)
  if (isAdminPath) {
    return <Navigate to={isManualSales(me) ? '/resumen' : '/inicio'} replace />;
  }

  if (me.business_id === null) return <SinNegocio />;
  return <>{children}</>;
}

interface Section {
  path: string;
  label: string;
}

interface DianSection extends Section {
  Screen: ComponentType<{ businessId: string }>;
}

const DIAN_SECTIONS: DianSection[] = [
  { path: '/inicio', label: 'Inicio', Screen: Dashboard },
  { path: '/iva', label: 'IVA', Screen: IvaDetail },
  { path: '/historial', label: 'Facturas', Screen: Historial },
  { path: '/calendario', label: 'Calendario', Screen: Calendario },
  { path: '/documentos', label: 'Documentos', Screen: Documentos },
];

const MANUAL_SECTIONS: Section[] = [
  { path: '/resumen', label: 'Resumen' },
  { path: '/historial', label: 'Facturas' },
  { path: '/documentos', label: 'Documentos' },
];

function Shell() {
  const { logout, me } = useAuth();
  const [salesOpen, setSalesOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<SaleResponse | null>(null);
  const [salesVersion, setSalesVersion] = useState(0);
  // RequireSession ya garantiza un negocio; esto solo estrecha el tipo.
  const businessId = me?.business_id;
  if (!businessId) return null;

  function onSaleRegistered(sale: SaleResponse) {
    setSalesOpen(false);
    setConfirmation(sale);
    setSalesVersion((n) => n + 1);
  }

  const manual = isManualSales(me);
  const sections = manual ? MANUAL_SECTIONS : DIAN_SECTIONS;

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="row-between">
          <span className="shell-brand">{BRAND_NAME}</span>
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
        {sections.map((section) => (
          <NavLink key={section.path} to={section.path} className={({ isActive }) => (isActive ? 'active' : '')}>
            {section.label}
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        <Routes>
          {manual ? (
            <>
              <Route path="/resumen" element={<Resumen businessId={businessId} refreshKey={salesVersion} />} />
              <Route path="/historial" element={<Historial businessId={businessId} />} />
              <Route path="/documentos" element={<Documentos businessId={businessId} />} />
            </>
          ) : (
            DIAN_SECTIONS.map(({ path, Screen }) => (
              <Route key={path} path={path} element={<Screen businessId={businessId} />} />
            ))
          )}
          <Route path="*" element={<Navigate to={manual ? '/resumen' : '/inicio'} replace />} />
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
        <Route path="/entrar/:token" element={<Entrar />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/admin/*"
          element={
            <RequireSession>
              <AdminShell />
            </RequireSession>
          }
        />
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
