import { useEffect, useRef, useState } from 'react';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../api/client';
import { getSales, voidSale } from '../api/endpoints';
import { ResourceView } from './ScreenState';
import { fmtDeadline, fmtMoneyExact, fmtPeriod } from '../format';
import { useResource } from '../hooks/useResource';

interface RecentSalesProps {
  businessId: string;
  month: string;
  refreshKey: number;
  onVoided: () => void;
}

/**
 * Lista de ventas del mes con opción de anulación para negocios de ventas manuales (Story 6.5).
 * 401/403 los resuelve el cliente HTTP central; los errores locales de validación o conflicto se muestran en la fila.
 */
export default function RecentSales({ businessId, month, refreshKey, onVoided }: RecentSalesProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    setConfirmingId(null);
    setRowError(null);
    setBusyId(null);
    submitting.current = false;
  }, [businessId, month]);

  const { state, retry } = useResource(
    () => getSales(businessId, month),
    [businessId, month, refreshKey, reloadKey],
  );

  async function handleVoid(saleId: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusyId(saleId);
    setRowError(null);

    try {
      await voidSale(businessId, saleId);
      submitting.current = false;
      setBusyId(null);
      setConfirmingId(null);
      setReloadKey((n) => n + 1);
      onVoided();
    } catch (err) {
      submitting.current = false;
      setBusyId(null);
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setRowError({ id: saleId, message: err.message });
          if (err.status === 404 || err.status === 409) {
            setReloadKey((n) => n + 1);
          }
        }
      } else {
        setRowError({ id: saleId, message: NETWORK_ERROR_MESSAGE });
      }
    }
  }

  return (
    <section aria-label="Ventas del mes">
      <h2 className="section-title">Ventas de {fmtPeriod(month)}</h2>
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tus ventas…">
        {(data) => {
          if (data.sales.length === 0) {
            return (
              <div className="card list-card">
                {rowError && (
                  <p className="form-error" role="alert">
                    {rowError.message}
                  </p>
                )}
                <p className="list-empty">No hay ventas registradas en este mes.</p>
              </div>
            );
          }

          return (
            <ul className="card list-card plain-list">
              {rowError && !data.sales.some((s) => s.id === rowError.id) && (
                <li className="list-row">
                  <p className="form-error" role="alert">
                    {rowError.message}
                  </p>
                </li>
              )}
              {data.sales.map((sale) => (
                <li key={sale.id} className="list-row">
                  {confirmingId === sale.id ? (
                    <div role="group" aria-label="Confirmar anulación" style={{ width: '100%' }}>
                      {rowError?.id === sale.id && (
                        <p className="form-error" role="alert">
                          {rowError.message}
                        </p>
                      )}
                      <p className="row-title">¿Anular esta venta? No podrás deshacerlo.</p>
                      <div className="stack" style={{ marginTop: '8px' }}>
                        <button
                          className="btn-primary"
                          type="button"
                          disabled={busyId === sale.id}
                          onClick={() => void handleVoid(sale.id)}
                        >
                          {busyId === sale.id ? 'Anulando…' : 'Sí, anular'}
                        </button>
                        <button
                          className="btn-outline"
                          type="button"
                          disabled={busyId === sale.id}
                          onClick={() => {
                            setConfirmingId(null);
                            setRowError(null);
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="row-title">{fmtMoneyExact(sale.total_amount)}</p>
                        <p className="row-sub">
                          {`${fmtDeadline(sale.sale_date)} · ${sale.description ?? 'Sin descripción'}`}
                        </p>
                      </div>
                      <button
                        className="btn-link"
                        type="button"
                        aria-label={`Anular venta de ${fmtMoneyExact(sale.total_amount)}`}
                        disabled={busyId !== null}
                        onClick={() => {
                          setConfirmingId(sale.id);
                          setRowError(null);
                        }}
                      >
                        Anular
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          );
        }}
      </ResourceView>
    </section>
  );
}
