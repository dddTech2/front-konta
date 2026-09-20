import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../api/client';
import { registerSale } from '../api/endpoints';
import type { SaleResponse } from '../api/types';

interface SalesFormProps {
  /** `business_id` de `GET /api/auth/me`: es el único origen del negocio. */
  businessId: string;
  onClose: () => void;
  /** Se llama con la venta creada (201); quien monta el formulario lo cierra y muestra la confirmación. */
  onRegistered: (sale: SaleResponse) => void;
}

const DESCRIPTION_MAX_LENGTH = 500;
const EMPTY_TOTAL_MESSAGE = 'Escribe el total de la venta.';

/**
 * Formulario de venta: total obligatorio y descripción opcional. La validación real es del servidor
 * (`core/sales_service.py`); un 422 se muestra en línea con el formulario abierto. 401 y 403 los resuelve
 * el manejador central del cliente HTTP (login / Servicio Suspendido), aquí no se muestran como error.
 */
export default function SalesForm({ businessId, onClose, onRegistered }: SalesFormProps) {
  const [total, setTotal] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El estado `busy` se actualiza en el siguiente render; el ref cierra la ventana de un segundo clic inmediato.
  const submitting = useRef(false);
  const totalInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    totalInput.current?.focus();
  }, []);

  // Tras un envío fallido los campos vuelven a estar habilitados en este render; solo entonces pueden
  // recibir foco (deshabilitados lo pierden y Escape dejaría de llegar al diálogo).
  useEffect(() => {
    if (error && !busy) totalInput.current?.focus();
  }, [error, busy]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    const trimmedTotal = total.trim();
    if (!trimmedTotal) {
      setError(EMPTY_TOTAL_MESSAGE);
      totalInput.current?.focus();
      return;
    }

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const trimmedDescription = description.trim();
      const sale = await registerSale(businessId, {
        total_amount: trimmedTotal,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      });
      onRegistered(sale);
    } catch (err) {
      if (err instanceof ApiError) {
        // 401 -> el handler ya cerró la sesión; 403 -> el handler ya mostró Servicio Suspendido.
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') setError(err.message);
      } else {
        setError(NETWORK_ERROR_MESSAGE);
      }
      submitting.current = false;
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !busy) onClose();
  }

  return (
    <div className="modal-backdrop">
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-form-title"
        onKeyDown={onKeyDown}
      >
        <h2 className="h-title modal-title" id="sales-form-title">
          Registrar venta
        </h2>
        <form onSubmit={onSubmit} noValidate>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="field">
            <label className="field-label" htmlFor="sales-total">
              Total de la venta
            </label>
            <input
              id="sales-total"
              ref={totalInput}
              className="field-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="150000"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              disabled={busy}
              aria-describedby="sales-total-hint"
            />
            <span className="field-hint" id="sales-total-hint">
              Solo números, con punto decimal opcional (máximo 2 decimales), sin símbolos ni separadores de miles.
            </span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="sales-description">
              Descripción (opcional)
            </label>
            <input
              id="sales-description"
              className="field-input"
              type="text"
              autoComplete="off"
              maxLength={DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="stack">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar venta'}
            </button>
            <button className="btn-outline" type="button" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
