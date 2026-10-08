import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { BRAND_NAME } from '../../brand';
import AdminClientes from './AdminClientes';
import AdminFicha from './AdminFicha';
import AdminOperacion from './AdminOperacion';
import AdminResumen from './AdminResumen';

export { AdminClientes, AdminFicha, AdminOperacion, AdminResumen };

export default function AdminShell() {
  const { logout } = useAuth();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-brand-group">
            <span className="admin-brand">{BRAND_NAME}</span>
            <span className="admin-badge">Administración</span>
          </div>
          <div className="admin-actions">
            <button className="btn-link admin-logout" type="button" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="admin-body">
        <nav className="admin-nav" aria-label="Secciones de administración">
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Resumen
          </NavLink>
          <NavLink to="/admin/clientes" className={({ isActive }) => (isActive ? 'active' : '')}>
            Clientes
          </NavLink>
          <NavLink to="/admin/operacion" className={({ isActive }) => (isActive ? 'active' : '')}>
            Operación
          </NavLink>
        </nav>

        <main className="admin-main">
          <Routes>
            <Route index element={<AdminResumen />} />
            <Route path="clientes" element={<AdminClientes />} />
            <Route path="clientes/:businessId" element={<AdminFicha />} />
            <Route path="operacion" element={<AdminOperacion />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
