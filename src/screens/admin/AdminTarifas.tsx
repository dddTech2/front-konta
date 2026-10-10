import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  createAdminPricingPlan,
  deleteAdminPricingRate,
  getAdminPricing,
  getAdminPricingRateHistory,
  setAdminPricingRate,
  updateAdminPricingPlan,
  updateAdminPricingSettings,
} from '../../api/adminEndpoints';
import type {
  AdminPricingPlan,
  AdminPricingRate,
  AdminPricingRateHistoryItem,
  AdminPricingScheduledRate,
} from '../../api/adminTypes';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../api/client';
import Dialog from '../../components/Dialog';
import { ResourceView } from '../../components/ScreenState';
import { fmtMoney, fmtPercent, toBogotaIsoDate } from '../../format';
import { useResource } from '../../hooks/useResource';

/** Formatea YYYY-MM-DD a dd/mm/aaaa */
export function fmtDateDMY(iso?: string | null): string {
  if (!iso) return '—';
  const clean = toBogotaIsoDate(iso);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(clean);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Devuelve la fecha de hoy en hora Bogotá como YYYY-MM-DD */
export function getTodayBogota(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

const SEGMENTOS_FILAS: Array<{ key: 'DIAN' | 'MANUAL_SALES'; label: string }> = [
  { key: 'DIAN', label: 'Facturador DIAN' },
  { key: 'MANUAL_SALES', label: 'Ventas manuales' },
];

const SEGMENTOS_COLUMNAS: Array<{ key: 'PERSONA_NATURAL' | 'PERSONA_JURIDICA'; label: string }> = [
  { key: 'PERSONA_NATURAL', label: 'Persona natural' },
  { key: 'PERSONA_JURIDICA', label: 'Empresa' },
];

function segmentLabel(incomeSource: string, taxpayerType: string): string {
  const inc = incomeSource === 'MANUAL_SALES' ? 'Ventas manuales' : 'Facturador DIAN';
  const tax = taxpayerType === 'PERSONA_JURIDICA' ? 'Empresa' : 'Persona natural';
  return `${inc} — ${tax}`;
}


const fmtMonths = (m: number) => `${m} ${m === 1 ? 'mes' : 'meses'}`;
export default function AdminTarifas() {
  const { state, retry } = useResource(() => getAdminPricing(), []);

  // ---------- Modal: Cambiar tarifa (AC #1) ----------
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [targetIncomeSource, setTargetIncomeSource] = useState<'DIAN' | 'MANUAL_SALES'>('DIAN');
  const [targetTaxpayerType, setTargetTaxpayerType] = useState<'PERSONA_NATURAL' | 'PERSONA_JURIDICA'>('PERSONA_NATURAL');
  const [newMonthlyPrice, setNewMonthlyPrice] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(getTodayBogota());
  const [rateBusy, setRateBusy] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const rateSubmitting = useRef(false);

  // ---------- Modal: Historial de tarifas (AC #5) ----------
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historySegmentTitle, setHistorySegmentTitle] = useState('');
  const [historyItems, setHistoryItems] = useState<AdminPricingRateHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // ---------- Diálogo: Cancelar tarifa programada (AC #1) ----------
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rateToCancel, setRateToCancel] = useState<AdminPricingScheduledRate | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelSubmitting = useRef(false);

  // ---------- Edición de planes en fila (AC #2) ----------
  const [planDrafts, setPlanDrafts] = useState<
    Record<string, { name: string; discount_rate: string; is_active: boolean }>
  >({});
  const [planErrors, setPlanErrors] = useState<Record<string, string | null>>({});
  const [planBusy, setPlanBusy] = useState<Record<string, boolean>>({});

  // ---------- Modal: Nuevo plan (AC #2) ----------
  const [newPlanModalOpen, setNewPlanModalOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanCode, setNewPlanCode] = useState('');
  const [newPlanMonths, setNewPlanMonths] = useState('3');
  const [newPlanDiscount, setNewPlanDiscount] = useState('0');
  const [newPlanCodeEdited, setNewPlanCodeEdited] = useState(false);
  const [newPlanBusy, setNewPlanBusy] = useState(false);
  const [newPlanError, setNewPlanError] = useState<string | null>(null);
  const newPlanSubmitting = useRef(false);

  // ---------- Sección: Periodo de gracia (AC #2b) ----------
  const [graceDaysInput, setGraceDaysInput] = useState('3');
  const [graceBusy, setGraceBusy] = useState(false);
  const [graceError, setGraceError] = useState<string | null>(null);
  const [graceSuccess, setGraceSuccess] = useState(false);
  const graceSubmitting = useRef(false);

  // Sincroniza borradores de planes y días de gracia cuando se cargan los datos
  useEffect(() => {
    if (state.status === 'ready' && state.data) {
      const drafts: Record<string, { name: string; discount_rate: string; is_active: boolean }> = {};
      state.data.plans.forEach((p) => {
        drafts[p.code] = {
          name: p.name,
          discount_rate: p.discount_rate,
          is_active: p.is_active,
        };
      });
      setPlanDrafts(drafts);
      setGraceDaysInput(String(state.data.grace_days));
    }
  }, [state]);

  // Sugiere código de plan automáticamente al escribir el nombre
  function handleNewPlanNameChange(val: string) {
    setNewPlanName(val);
    if (!newPlanCodeEdited) {
      const suggested = val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 20);
      setNewPlanCode(suggested);
    }
  }

  // Abre el modal para cambiar tarifa de una celda
  function openChangeRate(incomeSource: 'DIAN' | 'MANUAL_SALES', taxpayerType: 'PERSONA_NATURAL' | 'PERSONA_JURIDICA', currentRate?: AdminPricingRate) {
    setTargetIncomeSource(incomeSource);
    setTargetTaxpayerType(taxpayerType);
    setNewMonthlyPrice(currentRate ? String(Math.round(Number(currentRate.monthly_price))) : '');
    setEffectiveDate(getTodayBogota());
    setRateError(null);
    setRateModalOpen(true);
  }

  // Guardar nueva tarifa (AC #1)
  async function handleSaveRate(e: FormEvent) {
    e.preventDefault();
    if (rateSubmitting.current) return;

    const cleanAmount = newMonthlyPrice.replace(/\D/g, '');
    if (!cleanAmount || Number(cleanAmount) <= 0) {
      setRateError('Escribe un valor mensual válido mayor a 0.');
      return;
    }
    if (Number(cleanAmount) > 10_000_000) {
      setRateError('El valor mensual no puede superar los $10.000.000.');
      return;
    }
    if (!effectiveDate) {
      setRateError('Selecciona la fecha de vigencia.');
      return;
    }

    rateSubmitting.current = true;
    setRateBusy(true);
    setRateError(null);

    try {
      await setAdminPricingRate({
        income_source: targetIncomeSource,
        taxpayer_type: targetTaxpayerType,
        monthly_price: Number(cleanAmount),
        effective_from: effectiveDate,
      });
      setRateModalOpen(false);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setRateError(err.message);
        }
      } else {
        setRateError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      rateSubmitting.current = false;
      setRateBusy(false);
    }
  }

  // Ver historial por segmento (AC #5)
  async function handleOpenHistory(incomeSource: string, taxpayerType: string) {
    const title = segmentLabel(incomeSource, taxpayerType);
    setHistorySegmentTitle(title);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryItems([]);

    try {
      const items = await getAdminPricingRateHistory(incomeSource, taxpayerType);
      setHistoryItems(items);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setHistoryError(err.message);
        }
      } else {
        setHistoryError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  // Cancelar tarifa programada (AC #1)
  function handleOpenCancelRate(rate: AdminPricingScheduledRate) {
    setRateToCancel(rate);
    setCancelError(null);
    setCancelModalOpen(true);
  }

  async function handleConfirmCancelRate() {
    if (!rateToCancel || cancelSubmitting.current) return;
    cancelSubmitting.current = true;
    setCancelBusy(true);
    setCancelError(null);

    try {
      await deleteAdminPricingRate(rateToCancel.id);
      setCancelModalOpen(false);
      setRateToCancel(null);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setCancelError(err.message);
        }
      } else {
        setCancelError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      cancelSubmitting.current = false;
      setCancelBusy(false);
    }
  }

  // Guardar cambios en un plan (AC #2)
  async function handleSavePlan(plan: AdminPricingPlan) {
    const draft = planDrafts[plan.code];
    if (!draft) return;

    const discountNum = Number(draft.discount_rate);
    if (Number.isNaN(discountNum) || discountNum < 0 || discountNum > 50) {
      setPlanErrors((prev) => ({ ...prev, [plan.code]: 'El descuento debe estar entre 0 % y 50 %.' }));
      return;
    }

    setPlanBusy((prev) => ({ ...prev, [plan.code]: true }));
    setPlanErrors((prev) => ({ ...prev, [plan.code]: null }));

    try {
      await updateAdminPricingPlan(plan.code, {
        name: draft.name.trim(),
        discount_rate: discountNum,
        is_active: draft.is_active,
      });
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          const displayErr = err.code && !err.message.includes(err.code) ? `${err.code}: ${err.message}` : err.message;
          setPlanErrors((prev) => ({ ...prev, [plan.code]: displayErr }));
        }
      } else {
        setPlanErrors((prev) => ({ ...prev, [plan.code]: NETWORK_ERROR_MESSAGE }));
      }
    } finally {
      setPlanBusy((prev) => ({ ...prev, [plan.code]: false }));
    }
  }

  // Guardar nuevo plan (AC #2)
  async function handleCreatePlanSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPlanSubmitting.current) return;

    if (!newPlanName.trim()) {
      setNewPlanError('El nombre del plan es obligatorio.');
      return;
    }
    const cleanCode = newPlanCode.trim().toUpperCase();
    if (!/^[A-Z][A-Z_]{1,19}$/.test(cleanCode)) {
      setNewPlanError('El código debe tener entre 2 y 20 caracteres en mayúsculas (letras A-Z y guión bajo).');
      return;
    }
    const monthsNum = Number(newPlanMonths);
    if (!monthsNum || monthsNum < 1 || monthsNum > 36) {
      setNewPlanError('La duración en meses debe estar entre 1 y 36.');
      return;
    }
    const discountNum = Number(newPlanDiscount);
    if (Number.isNaN(discountNum) || discountNum < 0 || discountNum > 50) {
      setNewPlanError('El descuento debe estar entre 0 % y 50 %.');
      return;
    }

    newPlanSubmitting.current = true;
    setNewPlanBusy(true);
    setNewPlanError(null);

    try {
      await createAdminPricingPlan({
        code: cleanCode,
        name: newPlanName.trim(),
        months: monthsNum,
        discount_rate: discountNum,
      });
      setNewPlanModalOpen(false);
      setNewPlanName('');
      setNewPlanCode('');
      setNewPlanCodeEdited(false);
      setNewPlanMonths('3');
      setNewPlanDiscount('0');
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          const displayErr = err.code && !err.message.includes(err.code) ? `${err.code}: ${err.message}` : err.message;
          setNewPlanError(displayErr);
        }
      } else {
        setNewPlanError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      newPlanSubmitting.current = false;
      setNewPlanBusy(false);
    }
  }

  // Guardar días de gracia (AC #2b)
  async function handleSaveGraceDays(e: FormEvent) {
    e.preventDefault();
    if (graceSubmitting.current) return;

    const days = Number(graceDaysInput);
    if (!days || days < 1 || days > 15) {
      setGraceError('Los días de gracia deben estar entre 1 y 15.');
      return;
    }

    graceSubmitting.current = true;
    setGraceBusy(true);
    setGraceError(null);
    setGraceSuccess(false);

    try {
      await updateAdminPricingSettings({ grace_days: days });
      setGraceSuccess(true);
      setTimeout(() => setGraceSuccess(false), 3000);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setGraceError(err.message);
        }
      } else {
        setGraceError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      graceSubmitting.current = false;
      setGraceBusy(false);
    }
  }

  return (
    <section aria-label="Tarifas" className="screen admin-screen admin-tarifas-screen">
      <div className="admin-screen-head">
        <h1 className="screen-title">Tarifas</h1>
      </div>

      {/* Aviso fijo arriba de la pantalla (AC #4) */}
      <div className="card admin-notice-banner" role="status">
        <span className="admin-notice-icon" aria-hidden="true">ℹ</span>
        <p className="admin-notice-text">
          Los cambios aplican a clientes nuevos. Cada cliente conserva su precio; para cambiarlo usa su ficha.
        </p>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando configuración de tarifas…">
        {(pricing) => {
          const { rates, scheduled, plans, quotes } = pricing;
          const planNameByCode = new Map(plans.map((p) => [p.code, p.name]));

          return (
            <div className="admin-tarifas-content">
              {/* ================================================================
                  1. VALOR MENSUAL POR TIPO DE CLIENTE (AC #1)
                  ================================================================ */}
              <div className="card admin-card admin-rates-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Valor mensual por tipo de cliente</h2>
                </div>

                <div className="admin-table-container admin-desktop-only">
                  <table className="admin-table admin-rates-table" aria-label="Valor mensual por tipo de cliente">
                    <thead>
                      <tr>
                        <th scope="col">Tipo de negocio</th>
                        {SEGMENTOS_COLUMNAS.map((col) => (
                          <th key={col.key} scope="col">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SEGMENTOS_FILAS.map((row) => (
                        <tr key={row.key} className="admin-table-row">
                          <th scope="row" className="admin-rate-row-header">
                            <strong>{row.label}</strong>
                          </th>
                          {SEGMENTOS_COLUMNAS.map((col) => {
                            const rate = rates.find(
                              (r) => r.income_source === row.key && r.taxpayer_type === col.key,
                            );
                            return (
                              <td key={col.key} className="admin-rate-cell">
                                <div className="admin-rate-cell-box">
                                  <strong className="admin-rate-price">
                                    {rate ? fmtMoney(Number(rate.monthly_price)) : '—'}
                                  </strong>
                                  <span className="admin-rate-date">
                                    desde {rate ? fmtDateDMY(rate.effective_from) : '—'}
                                  </span>
                                  <div className="admin-rate-actions">
                                    <button
                                      type="button"
                                      className="btn-link admin-btn-rate-change"
                                      onClick={() => openChangeRate(row.key, col.key, rate)}
                                    >
                                      Cambiar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-link admin-btn-rate-history"
                                      onClick={() => handleOpenHistory(row.key, col.key)}
                                    >
                                      Ver historial
                                    </button>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista móvil para la tabla 2×2 (< 768 px) */}
                <div className="admin-cards-list admin-mobile-only">
                  {SEGMENTOS_FILAS.map((row) =>
                    SEGMENTOS_COLUMNAS.map((col) => {
                      const rate = rates.find(
                        (r) => r.income_source === row.key && r.taxpayer_type === col.key,
                      );
                      return (
                        <div key={`${row.key}-${col.key}`} className="admin-rate-mobile-card">
                          <div className="admin-rate-mobile-head">
                            <span className="admin-pill-category">{col.label}</span>
                            <strong className="admin-rate-mobile-title">{row.label}</strong>
                          </div>
                          <div className="admin-rate-mobile-body">
                            <strong className="admin-rate-price">
                              {rate ? fmtMoney(Number(rate.monthly_price)) : '—'}
                            </strong>
                            <span className="admin-rate-date">
                              desde {rate ? fmtDateDMY(rate.effective_from) : '—'}
                            </span>
                          </div>
                          <div className="admin-rate-actions">
                            <button
                              type="button"
                              className="btn-outline admin-btn-sm"
                              onClick={() => openChangeRate(row.key, col.key, rate)}
                            >
                              Cambiar
                            </button>
                            <button
                              type="button"
                              className="btn-link admin-btn-sm"
                              onClick={() => handleOpenHistory(row.key, col.key)}
                            >
                              Ver historial
                            </button>
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>

                {/* Tarifas programadas (AC #1) */}
                <div className="admin-scheduled-section">
                  <h3 className="admin-section-subtitle">Tarifas programadas</h3>
                  {scheduled.length === 0 ? (
                    <p className="admin-empty-text">No hay tarifas programadas.</p>
                  ) : (
                    <div className="admin-table-container">
                      <table className="admin-table" aria-label="Tarifas programadas">
                        <thead>
                          <tr>
                            <th scope="col">Segmento</th>
                            <th scope="col">Nuevo valor mensual</th>
                            <th scope="col">Vigencia</th>
                            <th scope="col">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduled.map((item) => (
                            <tr key={item.id} className="admin-table-row">
                              <td>{segmentLabel(item.income_source, item.taxpayer_type)}</td>
                              <td>
                                <strong>{fmtMoney(Number(item.monthly_price))}</strong>
                              </td>
                              <td>desde {fmtDateDMY(item.effective_from)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-outline admin-btn-sm admin-btn-danger"
                                  onClick={() => handleOpenCancelRate(item)}
                                >
                                  Cancelar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ================================================================
                  2. PLANES Y DESCUENTOS (AC #2)
                  ================================================================ */}
              <div className="card admin-card admin-plans-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Planes y descuentos</h2>
                  <button
                    type="button"
                    className="btn-primary admin-btn-action"
                    onClick={() => {
                      setNewPlanName('');
                      setNewPlanCode('');
                      setNewPlanCodeEdited(false);
                      setNewPlanMonths('3');
                      setNewPlanDiscount('0');
                      setNewPlanError(null);
                      setNewPlanModalOpen(true);
                    }}
                  >
                    Nuevo plan
                  </button>
                </div>

                <div className="admin-plans-list">
                  {plans.map((plan) => {
                    const draft = planDrafts[plan.code] || {
                      name: plan.name,
                      discount_rate: plan.discount_rate,
                      is_active: plan.is_active,
                    };
                    const isBusy = Boolean(planBusy[plan.code]);
                    const rowError = planErrors[plan.code];

                    return (
                      <div key={plan.code} className="admin-plan-row-container">
                        <div className="admin-plan-row">
                          {/* Nombre editable */}
                          <div className="admin-plan-field admin-plan-name">
                            <label className="field-label" htmlFor={`plan-name-${plan.code}`}>
                              Nombre
                            </label>
                            <input
                              id={`plan-name-${plan.code}`}
                              type="text"
                              className="field-input"
                              value={draft.name}
                              onChange={(e) =>
                                setPlanDrafts((prev) => ({
                                  ...prev,
                                  [plan.code]: { ...draft, name: e.target.value },
                                }))
                              }
                              disabled={isBusy}
                            />
                          </div>

                          {/* Meses (solo lectura) */}
                          <div className="admin-plan-field admin-plan-months">
                            <span className="field-label">Duración</span>
                            <span className="admin-readonly-pill">{fmtMonths(plan.months)}</span>
                          </div>

                          {/* Descuento editable */}
                          <div className="admin-plan-field admin-plan-discount">
                            <label className="field-label" htmlFor={`plan-disc-${plan.code}`}>
                              Descuento (%)
                            </label>
                            <input
                              id={`plan-disc-${plan.code}`}
                              type="number"
                              min="0"
                              max="50"
                              step="any"
                              className="field-input"
                              value={draft.discount_rate}
                              onChange={(e) =>
                                setPlanDrafts((prev) => ({
                                  ...prev,
                                  [plan.code]: { ...draft, discount_rate: e.target.value },
                                }))
                              }
                              disabled={isBusy}
                            />
                          </div>

                          {/* Interruptor Activo */}
                          <div className="admin-plan-field admin-plan-active">
                            <label className="admin-checkbox-container" htmlFor={`plan-active-${plan.code}`}>
                              <input
                                id={`plan-active-${plan.code}`}
                                type="checkbox"
                                checked={draft.is_active}
                                onChange={(e) =>
                                  setPlanDrafts((prev) => ({
                                    ...prev,
                                    [plan.code]: { ...draft, is_active: e.target.checked },
                                  }))
                                }
                                disabled={isBusy}
                              />
                              <span>Activo</span>
                            </label>
                          </div>

                          {/* Botón Guardar */}
                          <div className="admin-plan-field admin-plan-save">
                            <button
                              type="button"
                              className="btn-outline admin-btn-sm"
                              onClick={() => handleSavePlan(plan)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Guardando…' : 'Guardar'}
                            </button>
                          </div>
                        </div>

                        {/* Error de la fila si aplica */}
                        {rowError && (
                          <p className="form-error admin-plan-row-error" role="alert">
                            {rowError}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ================================================================
                  2b. PERIODO DE GRACIA (AC #2b)
                  ================================================================ */}
              <div className="card admin-card admin-grace-card">
                <h2 className="admin-section-title">Periodo de gracia</h2>
                <form onSubmit={handleSaveGraceDays} className="admin-grace-form">
                  <div className="admin-grace-row">
                    <div className="field admin-grace-field">
                      <label className="field-label" htmlFor="grace-days-input">
                        Días de gracia antes de bloquear
                      </label>
                      <input
                        id="grace-days-input"
                        type="number"
                        min="1"
                        max="15"
                        className="field-input"
                        value={graceDaysInput}
                        onChange={(e) => setGraceDaysInput(e.target.value)}
                        disabled={graceBusy}
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={graceBusy}>
                      {graceBusy ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                  {graceError && (
                    <p className="form-error" role="alert">
                      {graceError}
                    </p>
                  )}
                  {graceSuccess && (
                    <p className="admin-success-hint" role="status">
                      ✓ Días de gracia actualizados correctamente.
                    </p>
                  )}
                  <p className="admin-muted-note">
                    Aplica a los próximos cortes; los clientes que ya están en gracia conservan su fecha.
                  </p>
                </form>
              </div>

              {/* ================================================================
                  3. LO QUE PAGA UN CLIENTE NUEVO (AC #3)
                  ================================================================ */}
              <div className="card admin-card admin-quotes-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Lo que paga un cliente nuevo</h2>
                </div>

                {/* Vista tabla para escritorio */}
                <div className="admin-table-container admin-desktop-only">
                  <table className="admin-table admin-quotes-table" aria-label="Lo que paga un cliente nuevo">
                    <thead>
                      <tr>
                        <th scope="col">Segmento</th>
                        <th scope="col">Plan</th>
                        <th scope="col">Duración</th>
                        <th scope="col">Valor mensual</th>
                        <th scope="col">Descuento</th>
                        <th scope="col">Valor del periodo</th>
                        <th scope="col">Ahorro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q, idx) => {
                        const planLabel = planNameByCode.get(q.plan) ?? q.plan;
                        return (
                          <tr key={`${q.income_source}-${q.taxpayer_type}-${planLabel}-${idx}`} className="admin-table-row">
                            <td>{segmentLabel(q.income_source, q.taxpayer_type)}</td>
                            <td>
                              <strong>{planLabel}</strong>
                            </td>
                            <td>{fmtMonths(q.months)}</td>
                            <td>{fmtMoney(Number(q.monthly_price))}</td>
                            <td>{fmtPercent(Number(q.discount_rate))} %</td>
                            <td>
                              <strong className="text-accent">{fmtMoney(Number(q.final_price))}</strong>
                            </td>
                            <td>
                              {Number(q.discount_amount) > 0 ? (
                                <span className="admin-pill-savings">
                                  Ahorro: {fmtMoney(Number(q.discount_amount))}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Vista lista para celular (AC #3: en el celular se muestra como lista por segmento) */}
                <div className="admin-quotes-mobile-list admin-mobile-only">
                  {SEGMENTOS_FILAS.map((row) =>
                    SEGMENTOS_COLUMNAS.map((col) => {
                      const segQuotes = quotes.filter(
                        (q) => q.income_source === row.key && q.taxpayer_type === col.key,
                      );
                      if (segQuotes.length === 0) return null;

                      return (
                        <div key={`m-quote-${row.key}-${col.key}`} className="admin-quote-seg-block">
                          <h3 className="admin-quote-seg-title">
                            {row.label} — {col.label}
                          </h3>
                          <div className="admin-quote-seg-items">
                            {segQuotes.map((q) => {
                              const planLabel = planNameByCode.get(q.plan) ?? q.plan;
                              return (
                                <div key={`item-${planLabel}`} className="admin-quote-seg-card">
                                  <div className="admin-quote-seg-head">
                                    <strong>{planLabel} ({fmtMonths(q.months)})</strong>
                                    <strong className="text-accent">{fmtMoney(Number(q.final_price))}</strong>
                                  </div>
                                  <div className="admin-quote-seg-details">
                                    <span>Mensual: {fmtMoney(Number(q.monthly_price))}</span>
                                    {Number(q.discount_amount) > 0 && (
                                      <span className="admin-pill-savings">
                                        Ahorro: {fmtMoney(Number(q.discount_amount))} ({fmtPercent(Number(q.discount_rate))} %)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>

              {/* ================================================================
                  MODALES ACCESIBLES
                  ================================================================ */}

              {/* Diálogo: Cambiar tarifa (AC #1) */}
              <Dialog
                isOpen={rateModalOpen}
                onClose={() => setRateModalOpen(false)}
                title={`Cambiar tarifa: ${segmentLabel(targetIncomeSource, targetTaxpayerType)}`}
                busy={rateBusy}
              >
                {rateError && (
                  <p className="form-error" role="alert">
                    {rateError}
                  </p>
                )}
                <form onSubmit={handleSaveRate}>
                  <div className="field">
                    <label className="field-label" htmlFor="input-new-monthly-price">
                      Nuevo valor mensual
                    </label>
                    <input
                      id="input-new-monthly-price"
                      type="text"
                      inputMode="numeric"
                      className="field-input"
                      placeholder="Ej. 65000"
                      value={newMonthlyPrice}
                      onChange={(e) => setNewMonthlyPrice(e.target.value.replace(/\D/g, ''))}
                      disabled={rateBusy}
                    />
                    <span className="field-hint">
                      Formato: {newMonthlyPrice ? fmtMoney(Number(newMonthlyPrice)) : '$0'}
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="input-effective-date">
                      Fecha de vigencia
                    </label>
                    <input
                      id="input-effective-date"
                      type="date"
                      className="field-input"
                      min={getTodayBogota()}
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      disabled={rateBusy}
                    />
                    <span className="field-hint">
                      Por defecto hoy. Para tarifas futuras, selecciona una fecha posterior.
                    </span>
                  </div>

                  <div className="stack admin-dialog-actions">
                    <button type="submit" className="btn-primary" disabled={rateBusy}>
                      {rateBusy ? 'Guardando…' : 'Guardar tarifa'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setRateModalOpen(false)}
                      disabled={rateBusy}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Dialog>

              {/* Diálogo: Ver historial (AC #5) */}
              <Dialog
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                title={`Historial de tarifas: ${historySegmentTitle}`}
                busy={false}
              >
                {historyLoading ? (
                  <p className="admin-loading-text">Cargando historial…</p>
                ) : historyError ? (
                  <p className="form-error" role="alert">
                    {historyError}
                  </p>
                ) : historyItems.length === 0 ? (
                  <p className="admin-empty-text">No hay registros en el historial de este segmento.</p>
                ) : (
                  <div className="admin-table-container">
                    <table className="admin-table" aria-label="Historial de tarifas del segmento">
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Valor mensual</th>
                          <th scope="col">Registrado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((item, idx) => (
                          <tr key={item.id || idx} className="admin-table-row">
                            <td>{fmtDateDMY(item.effective_from)}</td>
                            <td>
                              <strong>{fmtMoney(Number(item.monthly_price))}</strong>
                            </td>
                            <td>{item.created_by || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="admin-dialog-actions">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setHistoryModalOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog>

              {/* Diálogo: Cancelar tarifa programada (AC #1) */}
              <Dialog
                isOpen={cancelModalOpen}
                onClose={() => setCancelModalOpen(false)}
                title="Cancelar tarifa programada"
                busy={cancelBusy}
              >
                {cancelError && (
                  <p className="form-error" role="alert">
                    {cancelError}
                  </p>
                )}
                {rateToCancel && (
                  <div className="admin-confirm-box">
                    <p className="admin-confirm-text">
                      ¿Deseas cancelar la tarifa programada para{' '}
                      <strong>{segmentLabel(rateToCancel.income_source, rateToCancel.taxpayer_type)}</strong> de{' '}
                      <strong>{fmtMoney(Number(rateToCancel.monthly_price))}</strong> vigente desde el{' '}
                      <strong>{fmtDateDMY(rateToCancel.effective_from)}</strong>?
                    </p>
                    <div className="stack admin-dialog-actions">
                      <button
                        type="button"
                        className="btn-primary admin-btn-danger"
                        onClick={handleConfirmCancelRate}
                        disabled={cancelBusy}
                      >
                        {cancelBusy ? 'Cancelando…' : 'Sí, cancelar tarifa'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setCancelModalOpen(false)}
                        disabled={cancelBusy}
                      >
                        Volver
                      </button>
                    </div>
                  </div>
                )}
              </Dialog>

              {/* Diálogo: Nuevo plan (AC #2) */}
              <Dialog
                isOpen={newPlanModalOpen}
                onClose={() => setNewPlanModalOpen(false)}
                title="Nuevo plan"
                busy={newPlanBusy}
              >
                {newPlanError && (
                  <p className="form-error" role="alert">
                    {newPlanError}
                  </p>
                )}
                <form onSubmit={handleCreatePlanSubmit}>
                  <div className="field">
                    <label className="field-label" htmlFor="input-new-plan-name">
                      Nombre del plan
                    </label>
                    <input
                      id="input-new-plan-name"
                      type="text"
                      className="field-input"
                      placeholder="Ej. Plan Semestral Plus"
                      value={newPlanName}
                      onChange={(e) => handleNewPlanNameChange(e.target.value)}
                      disabled={newPlanBusy}
                    />
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="input-new-plan-code">
                      Código del plan
                    </label>
                    <input
                      id="input-new-plan-code"
                      type="text"
                      className="field-input"
                      placeholder="Ej. SEMESTRAL_PLUS"
                      value={newPlanCode}
                      onChange={(e) => {
                        setNewPlanCodeEdited(true);
                        setNewPlanCode(e.target.value.toUpperCase());
                      }}
                      disabled={newPlanBusy}
                    />
                    <span className="field-hint">
                      Mayúsculas y guion bajo, empieza por letra (2 a 20 caracteres).
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="input-new-plan-months">
                      Duración en meses
                    </label>
                    <input
                      id="input-new-plan-months"
                      type="number"
                      min="1"
                      max="36"
                      className="field-input"
                      value={newPlanMonths}
                      onChange={(e) => setNewPlanMonths(e.target.value)}
                      disabled={newPlanBusy}
                    />
                    <span className="field-hint admin-muted-warn">
                      La duración no se puede cambiar después; para otra duración crea otro plan.
                    </span>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="input-new-plan-discount">
                      Descuento (%)
                    </label>
                    <input
                      id="input-new-plan-discount"
                      type="number"
                      min="0"
                      max="50"
                      step="any"
                      className="field-input"
                      value={newPlanDiscount}
                      onChange={(e) => setNewPlanDiscount(e.target.value)}
                      disabled={newPlanBusy}
                    />
                    <span className="field-hint">Número entre 0 y 50.</span>
                  </div>

                  <div className="stack admin-dialog-actions">
                    <button type="submit" className="btn-primary" disabled={newPlanBusy}>
                      {newPlanBusy ? 'Creando…' : 'Guardar plan'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setNewPlanModalOpen(false)}
                      disabled={newPlanBusy}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Dialog>
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
