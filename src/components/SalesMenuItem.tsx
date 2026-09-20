import { isManualSales } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Visibilidad del ítem "Registrar Venta": sale solo de `GET /api/auth/me` (vía AuthContext).
 * Visible solo para negocios MANUAL_SALES: persona provisionada (`is_provisioned` con `business_id`) y negocio no BLOQUEADO.
 * Si no se cumple, el ítem no existe en el DOM (no se deshabilita).
 */
export function useCanRegisterSale(): boolean {
  const { me, isSuspended } = useAuth();
  return (
    me !== null &&
    me.is_provisioned &&
    me.business_id !== null &&
    !me.is_blocked &&
    !isSuspended &&
    isManualSales(me)
  );
}

export default function SalesMenuItem({ onOpen }: { onOpen: () => void }) {
  const visible = useCanRegisterSale();
  if (!visible) return null;
  return (
    <button className="menu-sales" type="button" onClick={onOpen}>
      Registrar Venta
    </button>
  );
}
