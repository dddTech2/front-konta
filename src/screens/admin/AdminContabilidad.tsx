import { useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getAccounting,
  getAdminPricing,
  getRevenueSplit,
  updateRevenueSplit,
} from '../../api/adminEndpoints';
import type {
  AdminAccountingResponse,
  AdminPackage,
  AdminPricingResponse,
  AdminRevenueSplitItem,
} from '../../api/adminTypes';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../api/client';
import Dialog from '../../components/Dialog';
import { ResourceView } from '../../components/ScreenState';
import { fmtDeadline, fmtMoney, fmtMoneyCompact } from '../../format';
import { useResource } from '../../hooks/useResource';
import { packageLabel, PARTNER_NYO, PARTNER_VISION_CONTABLE } from './labels';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PACKAGES: AdminPackage[] = ['CON_IVA', 'SIN_IVA'];

/** "50.00" -> "50 %", "33.33" -> "33,33 %" (formato de porcentajes del panel). */
function fmtPct(value: string | number): string {
  const num = Number(value);
  return `${(Number.isFinite(num) ? num : 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`;
}

/** Obtiene el año y mes actual en hora de Bogotá (America/Bogota) */
function getBogotaCurrentPeriod(): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === 'year')?.value) || new Date().getFullYear();
    const month = Number(parts.find((p) => p.type === 'month')?.value) || new Date().getMonth() + 1;
    return { year, month };
  } catch {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}

interface ContabilidadData {
  accounting: AdminAccountingResponse;
  split: AdminRevenueSplitItem[];
  pricing: AdminPricingResponse;
}

export default function AdminContabilidad() {
  const initialPeriod = getBogotaCurrentPeriod();
  const [selectedYear, setSelectedYear] = useState<number>(initialPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(initialPeriod.month);

  // ---------- Carga de datos ----------
  const { state, retry } = useResource<ContabilidadData>(
    () =>
      Promise.all([
        getAccounting(selectedYear, selectedMonth),
        getRevenueSplit(),
        getAdminPricing(),
      ]).then(([accounting, split, pricing]) => ({ accounting, split, pricing })),
    [selectedYear, selectedMonth],
  );

  // ---------- Modal: Editar porcentajes de reparto (AC #9) ----------
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitDrafts, setSplitDrafts] = useState<Record<string, string>>({
    CON_IVA: '50.00',
    SIN_IVA: '50.00',
  });
  const [splitFieldErrors, setSplitFieldErrors] = useState<Record<string, string | null>>({});
  const [splitBusy, setSplitBusy] = useState(false);
  const splitSubmitting = useRef(false);

  const yearSelectId = useId();
  const monthSelectId = useId();

  // Años disponibles para selección (año actual +- 2 años)
  const availableYears = [
    initialPeriod.year - 2,
    initialPeriod.year - 1,
    initialPeriod.year,
    initialPeriod.year + 1,
  ];

  function handleOpenSplitModal(currentSplits: AdminRevenueSplitItem[]) {
    const initial: Record<string, string> = {};
    for (const item of currentSplits) {
      initial[item.package] = item.nyo_pct;
    }
    setSplitDrafts((prev) => ({ ...prev, ...initial }));
    setSplitFieldErrors({});
    setSplitModalOpen(true);
  }

  async function handleSaveSplit(e: FormEvent) {
    e.preventDefault();
    if (splitSubmitting.current) return;

    // Validación cliente básica antes de enviar
    const errors: Record<string, string | null> = {};
    for (const pkg of PACKAGES) {
      const valStr = splitDrafts[pkg]?.trim() ?? '';
      const num = Number(valStr);
      if (valStr === '' || Number.isNaN(num)) {
        errors[pkg] = 'Ingresa un porcentaje válido.';
      } else if (num < 0 || num > 100) {
        errors[pkg] = 'El porcentaje debe estar entre 0 y 100.';
      } else if (!/^\d+(\.\d{1,2})?$/.test(valStr)) {
        errors[pkg] = 'Usa máximo 2 decimales.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setSplitFieldErrors(errors);
      return;
    }

    splitSubmitting.current = true;
    setSplitBusy(true);
    setSplitFieldErrors({});

    try {
      // Envía PUT por paquete
      const results = await Promise.allSettled(
        PACKAGES.map(async (pkg) => {
          const nyoPct = splitDrafts[pkg]?.trim() || '50.00';
          return updateRevenueSplit(pkg, nyoPct);
        }),
      );

      const nextErrors: Record<string, string | null> = {};
      let hasError = false;

      results.forEach((res, index) => {
        const pkg = PACKAGES[index];
        if (res.status === 'rejected') {
          hasError = true;
          const err = res.reason;
          if (err instanceof ApiError) {
            nextErrors[pkg] = err.message || 'Error al actualizar porcentaje.';
          } else {
            nextErrors[pkg] = NETWORK_ERROR_MESSAGE;
          }
        }
      });

      if (hasError) {
        setSplitFieldErrors(nextErrors);
      } else {
        setSplitModalOpen(false);
        retry();
      }
    } finally {
      splitSubmitting.current = false;
      setSplitBusy(false);
    }
  }

  return (
    <section aria-label="Contabilidad" className="screen admin-screen admin-contabilidad-screen">
      {/* Encabezado y selector de periodo (AC #7) */}
      <div className="admin-page-head">
        <h1 className="admin-page-title">Contabilidad</h1>

        <div className="admin-accounting-controls" role="region" aria-label="Selector de periodo">
          <div className="admin-select-group">
            <label htmlFor={yearSelectId} className="admin-select-label">
              Año:
            </label>
            <select
              id={yearSelectId}
              className="admin-select-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-select-group">
            <label htmlFor={monthSelectId} className="admin-select-label">
              Mes:
            </label>
            <select
              id={monthSelectId}
              className="admin-select-input"
              value={selectedMonth ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMonth(val === '' ? null : Number(val));
              }}
            >
              <option value="">Todo el año</option>
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando datos de contabilidad…">
        {({ accounting, split, pricing }) => {
          const { collected, clients, mrr, mrr_split, monthly, payments } = accounting;

          // Mapa de porcentaje por paquete desde `split`
          const splitByPkg = new Map(split.map((s) => [s.package, s]));

          return (
            <div className="admin-contabilidad-content">
              {/* ================================================================
                  1. TARJETAS KPI (AC #7)
                  ================================================================ */}
              <div className="admin-grid admin-grid-4 admin-kpi-grid">
                {/* Total cobrado */}
                <div className="card admin-metric-card">
                  <span className="admin-metric-label">Total cobrado</span>
                  <strong className="admin-metric-num">
                    {fmtMoney(Number(collected.total))}
                  </strong>
                  <span className="admin-metric-sub">
                    {collected.count} {collected.count === 1 ? 'pago' : 'pagos'}
                  </span>
                  <div className="admin-metric-breakdown">
                    <span>
                      Con IVA: {fmtMoney(Number(collected.by_package.CON_IVA?.total || 0))} ({collected.by_package.CON_IVA?.count || 0})
                    </span>
                    <span>
                      Sin IVA: {fmtMoney(Number(collected.by_package.SIN_IVA?.total || 0))} ({collected.by_package.SIN_IVA?.count || 0})
                    </span>
                  </div>
                </div>

                {/* Clientes activos */}
                <div className="card admin-metric-card">
                  <span className="admin-metric-label">Clientes activos</span>
                  <strong className="admin-metric-num">{clients.active_total}</strong>
                  <span className="admin-metric-sub">
                    Con IVA: {clients.by_package.CON_IVA ?? 0} · Sin IVA: {clients.by_package.SIN_IVA ?? 0}
                  </span>
                </div>

                {/* Clientes nuevos */}
                <div className="card admin-metric-card">
                  <span className="admin-metric-label">Clientes nuevos</span>
                  <strong className="admin-metric-num">{clients.new_in_period}</strong>
                  <span className="admin-metric-sub">En el periodo</span>
                </div>

                {/* Ingreso mensual recurrente (MRR) */}
                <div className="card admin-metric-card">
                  <span className="admin-metric-label">Ingreso mensual recurrente</span>
                  <strong className="admin-metric-num">{fmtMoney(Number(mrr.total))}</strong>
                  <span className="admin-metric-sub">
                    Con IVA: {fmtMoney(Number(mrr.by_package.CON_IVA || 0))} · Sin IVA:{' '}
                    {fmtMoney(Number(mrr.by_package.SIN_IVA || 0))}
                  </span>
                </div>
              </div>

              {/* ================================================================
                  2. GRÁFICA DE BARRAS DE LOS 12 MESES (AC #8)
                  ================================================================ */}
              <div className="card admin-card admin-chart-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Evolución de ingresos (últimos 12 meses)</h2>
                  <div className="admin-chart-legend" aria-hidden="true">
                    <span className="admin-legend-item">
                      <span className="admin-legend-box admin-legend-con-iva" />
                      Con IVA
                    </span>
                    <span className="admin-legend-item">
                      <span className="admin-legend-box admin-legend-sin-iva" />
                      Sin IVA
                    </span>
                  </div>
                </div>

                <div className="admin-chart-container" role="region" aria-label="Gráfica de barras apiladas de ingresos">
                  {monthly.length === 0 ? (
                    <p className="admin-empty-text">No hay datos históricos disponibles.</p>
                  ) : (
                    <div className="admin-svg-wrapper">
                      <svg
                        className="admin-chart-svg"
                        viewBox="0 0 840 250"
                        role="img"
                        aria-label="Gráfica de barras con ingresos mensuales agrupados por paquete Con IVA y Sin IVA"
                      >
                        {(() => {
                          const maxVal = Math.max(
                            ...monthly.map((m) => Number(m.total) || 0),
                            1,
                          );
                          const baseY = 195;
                          const chartHeight = 150;
                          const slotWidth = 800 / Math.max(monthly.length, 1);
                          const barWidth = Math.min(Math.max(slotWidth * 0.55, 20), 44);

                          return monthly.map((item, idx) => {
                            const conIva = Number(item.CON_IVA) || 0;
                            const sinIva = Number(item.SIN_IVA) || 0;
                            const total = Number(item.total) || conIva + sinIva;

                            const totalBarHeight =
                              maxVal > 0 ? Math.round((total / maxVal) * chartHeight) : 0;
                            const conIvaHeight =
                              total > 0 ? Math.round((conIva / total) * totalBarHeight) : 0;
                            const sinIvaHeight = totalBarHeight - conIvaHeight;

                            const xCenter = 25 + idx * slotWidth + slotWidth / 2;
                            const barX = xCenter - barWidth / 2;

                            // Formato de mes (ej. "2026-10" -> "Oct '26")
                            const [yearStr, monthStr] = item.month.split('-');
                            const monthIdx = Number(monthStr) - 1;
                            const shortMonth = SHORT_MONTHS[monthIdx] ?? monthStr;
                            const shortYear = yearStr ? yearStr.slice(2) : '';

                            return (
                              <g key={item.month} className="admin-chart-bar-group">
                                {/* Barra Sin IVA (base) */}
                                {sinIvaHeight > 0 && (
                                  <rect
                                    x={barX}
                                    y={baseY - sinIvaHeight}
                                    width={barWidth}
                                    height={sinIvaHeight}
                                    fill="#4c7768"
                                    rx="2"
                                  >
                                    <title>{`Sin IVA: ${fmtMoney(sinIva)}`}</title>
                                  </rect>
                                )}

                                {/* Barra Con IVA (apilada arriba) */}
                                {conIvaHeight > 0 && (
                                  <rect
                                    x={barX}
                                    y={baseY - sinIvaHeight - conIvaHeight}
                                    width={barWidth}
                                    height={conIvaHeight}
                                    fill="#1e3431"
                                    rx={sinIvaHeight === 0 ? 2 : 0}
                                  >
                                    <title>{`Con IVA: ${fmtMoney(conIva)}`}</title>
                                  </rect>
                                )}

                                {/* Etiqueta de valor compacta sobre la barra */}
                                {total > 0 && (
                                  <text
                                    x={xCenter}
                                    y={baseY - totalBarHeight - 6}
                                    textAnchor="middle"
                                    className="admin-chart-val-label"
                                  >
                                    {fmtMoneyCompact(total)}
                                  </text>
                                )}

                                {/* Etiqueta de mes debajo de la barra */}
                                <text
                                  x={xCenter}
                                  y={baseY + 16}
                                  textAnchor="middle"
                                  className="admin-chart-axis-label"
                                >
                                  {shortMonth}
                                </text>
                                <text
                                  x={xCenter}
                                  y={baseY + 30}
                                  textAnchor="middle"
                                  className="admin-chart-year-label"
                                >
                                  &apos;{shortYear}
                                </text>
                              </g>
                            );
                          });
                        })()}

                        {/* Línea base */}
                        <line x1="20" y1="195" x2="820" y2="195" stroke="#e0ded8" strokeWidth="1" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* ================================================================
                  3. SECCIÓN REPARTO (AC #9)
                  ================================================================ */}
              <div className="card admin-card admin-split-card">
                <div className="admin-card-head">
                  <div>
                    <h2 className="admin-section-title">Reparto</h2>
                    <p className="admin-muted-text">
                      División de ingresos entre Visión Contable (Konta) y NYO según los porcentajes vigentes.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline admin-btn-action"
                    onClick={() => handleOpenSplitModal(split)}
                  >
                    Editar porcentajes
                  </button>
                </div>

                {/* Tabla Paquete x (Visión Contable, NYO) con porcentaje y monto del periodo y fila Total */}
                <div className="admin-table-container">
                  <table className="admin-table admin-split-table">
                    <thead>
                      <tr>
                        <th>Paquete</th>
                        <th>{PARTNER_VISION_CONTABLE}</th>
                        <th>{PARTNER_NYO}</th>
                        <th className="admin-text-right">Total cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PACKAGES.map((pkg) => {
                        const splitItem = splitByPkg.get(pkg);
                        const visionPct = splitItem?.visioncontable_pct ?? '50.00';
                        const nyoPct = splitItem?.nyo_pct ?? '50.00';
                        const visionAmount =
                          accounting.split.visioncontable.by_package[pkg] ?? '0.00';
                        const nyoAmount = accounting.split.nyo.by_package[pkg] ?? '0.00';
                        const pkgTotal = accounting.collected.by_package[pkg]?.total ?? '0.00';

                        return (
                          <tr key={pkg}>
                            <td>
                              <span className="admin-pill-badge admin-pill-package">
                                {packageLabel(pkg)}
                              </span>
                            </td>
                            <td>
                              <div className="admin-split-cell">
                                <span className="admin-pct-pill">{fmtPct(visionPct)}</span>
                                <strong>{fmtMoney(Number(visionAmount))}</strong>
                              </div>
                            </td>
                            <td>
                              <div className="admin-split-cell">
                                <span className="admin-pct-pill">{fmtPct(nyoPct)}</span>
                                <strong>{fmtMoney(Number(nyoAmount))}</strong>
                              </div>
                            </td>
                            <td className="admin-text-right">
                              <strong>{fmtMoney(Number(pkgTotal))}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="admin-table-total-row">
                        <td>
                          <strong>Total</strong>
                        </td>
                        <td>
                          <div className="admin-split-cell">
                            <strong>{fmtMoney(Number(accounting.split.visioncontable.total))}</strong>
                          </div>
                        </td>
                        <td>
                          <div className="admin-split-cell">
                            <strong>{fmtMoney(Number(accounting.split.nyo.total))}</strong>
                          </div>
                        </td>
                        <td className="admin-text-right">
                          <strong>{fmtMoney(Number(collected.total))}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Proyección mensual (mrr_split) */}
                <div className="admin-mrr-split-box">
                  <h3 className="admin-section-subtitle">Proyección mensual recurrente</h3>
                  <div className="admin-mrr-split-grid">
                    <div className="admin-mrr-partner-card">
                      <span className="admin-mrr-partner-title">{PARTNER_VISION_CONTABLE}</span>
                      <strong className="admin-mrr-partner-total">
                        {fmtMoney(Number(mrr_split.visioncontable.total))}
                      </strong>
                      <span className="admin-mrr-partner-sub">
                        Con IVA: {fmtMoney(Number(mrr_split.visioncontable.by_package.CON_IVA || 0))} · Sin IVA:{' '}
                        {fmtMoney(Number(mrr_split.visioncontable.by_package.SIN_IVA || 0))}
                      </span>
                    </div>

                    <div className="admin-mrr-partner-card">
                      <span className="admin-mrr-partner-title">{PARTNER_NYO}</span>
                      <strong className="admin-mrr-partner-total">
                        {fmtMoney(Number(mrr_split.nyo.total))}
                      </strong>
                      <span className="admin-mrr-partner-sub">
                        Con IVA: {fmtMoney(Number(mrr_split.nyo.by_package.CON_IVA || 0))} · Sin IVA:{' '}
                        {fmtMoney(Number(mrr_split.nyo.by_package.SIN_IVA || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ================================================================
                  4. DETALLE DE PAGOS DEL PERIODO (AC #10)
                  ================================================================ */}
              <div className="card admin-card admin-payments-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Detalle de pagos del periodo</h2>
                  <span className="admin-count-badge">
                    {payments.length} {payments.length === 1 ? 'pago' : 'pagos'}
                  </span>
                </div>

                {payments.length === 0 ? (
                  <p className="admin-empty-text">No hay pagos registrados en este periodo.</p>
                ) : (
                  <>
                    {/* Tabla para pantallas de escritorio */}
                    <div className="admin-desktop-only admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Paquete</th>
                            <th className="admin-text-right">Valor</th>
                            <th className="admin-text-right">{PARTNER_VISION_CONTABLE}</th>
                            <th className="admin-text-right">{PARTNER_NYO}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((p, idx) => (
                            <tr key={`${p.business_id}-${p.payment_date}-${idx}`}>
                              <td>{fmtDeadline(p.payment_date)}</td>
                              <td>
                                <Link
                                  to={`/admin/clientes/${encodeURIComponent(p.business_id)}`}
                                  className="admin-payment-client-link"
                                >
                                  {p.commercial_name}
                                </Link>
                              </td>
                              <td>
                                <span className="admin-pill-badge admin-pill-package">
                                  {packageLabel(p.package)}
                                </span>
                              </td>
                              <td className="admin-text-right">
                                <strong>{fmtMoney(Number(p.amount))}</strong>
                              </td>
                              <td className="admin-text-right">
                                {fmtMoney(Number(p.visioncontable_amount))}
                              </td>
                              <td className="admin-text-right">
                                {fmtMoney(Number(p.nyo_amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tarjetas para celular */}
                    <div className="admin-mobile-only admin-payment-cards-list">
                      {payments.map((p, idx) => (
                        <div
                          key={`${p.business_id}-${p.payment_date}-${idx}`}
                          className="admin-payment-mobile-card"
                        >
                          <div className="admin-payment-card-top">
                            <Link
                              to={`/admin/clientes/${encodeURIComponent(p.business_id)}`}
                              className="admin-payment-client-link"
                            >
                              {p.commercial_name}
                            </Link>
                            <span className="admin-pill-badge admin-pill-package">
                              {packageLabel(p.package)}
                            </span>
                          </div>

                          <div className="admin-payment-card-meta">
                            <span className="admin-payment-date">
                              {fmtDeadline(p.payment_date)}
                            </span>
                            <strong className="admin-payment-total">
                              {fmtMoney(Number(p.amount))}
                            </strong>
                          </div>

                          <div className="admin-payment-card-split">
                            <div className="admin-split-chip">
                              <span className="admin-split-chip-label">Visión Contable:</span>
                              <strong>{fmtMoney(Number(p.visioncontable_amount))}</strong>
                            </div>
                            <div className="admin-split-chip">
                              <span className="admin-split-chip-label">NYO:</span>
                              <strong>{fmtMoney(Number(p.nyo_amount))}</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* ================================================================
                  MODAL: EDITAR PORCENTAJES DE REPARTO (AC #9)
                  ================================================================ */}
              {splitModalOpen && (
                <Dialog
                  isOpen={splitModalOpen}
                  onClose={() => !splitBusy && setSplitModalOpen(false)}
                  title="Editar porcentajes de reparto"
                  busy={splitBusy}
                >
                  <form onSubmit={(e) => void handleSaveSplit(e)} className="admin-dialog-form">
                    <div className="admin-notice-box">
                      <p className="admin-notice-text">
                        Aplica a los pagos que se confirmen desde ahora.
                      </p>
                    </div>

                    <div className="admin-split-form-fields">
                      {PACKAGES.map((pkg) => {
                        const nyoInputVal = splitDrafts[pkg] ?? '';
                        const nyoNum = parseFloat(nyoInputVal);
                        const hasValidNum = !Number.isNaN(nyoNum) && nyoNum >= 0 && nyoNum <= 100;
                        const visionPctCalc = hasValidNum ? Math.round((100 - nyoNum) * 100) / 100 : null;

                        // Tarifa mensual vigente para el ejemplo
                        const currentRateItem = pricing.rates.find((r) => r.package === pkg);
                        const ratePrice = Number(currentRateItem?.monthly_price) || 0;

                        // Cálculo del ejemplo con la misma regla del servidor:
                        // NYO = redondeo a pesos enteros del valor × % / 100
                        // Visión Contable = valor − NYO
                        let exampleText = '';
                        if (ratePrice > 0 && hasValidNum) {
                          const nyoPart = Math.round((ratePrice * nyoNum) / 100);
                          const visionPart = ratePrice - nyoPart;
                          exampleText = `De ${fmtMoney(ratePrice)}: Visión Contable ${fmtMoney(visionPart)} · NYO ${fmtMoney(nyoPart)}`;
                        }

                        const errorMsg = splitFieldErrors[pkg];

                        return (
                          <div key={pkg} className="admin-split-package-group">
                            <h4 className="admin-split-group-title">{packageLabel(pkg)}</h4>

                            <div className="admin-split-input-row">
                              <div className="admin-split-input-field">
                                <label
                                  htmlFor={`split-nyo-${pkg}`}
                                  className="field-label"
                                >
                                  % NYO
                                </label>
                                <div className="admin-input-suffix-wrapper">
                                  <input
                                    id={`split-nyo-${pkg}`}
                                    type="number"
                                    step="any"
                                    min="0"
                                    max="100"
                                    className="field-input"
                                    aria-invalid={errorMsg ? true : undefined}
                                    value={nyoInputVal}
                                    onChange={(e) => {
                                      const nextVal = e.target.value;
                                      setSplitDrafts((prev) => ({
                                        ...prev,
                                        [pkg]: nextVal,
                                      }));
                                    }}
                                    disabled={splitBusy}
                                    required
                                  />
                                  <span className="admin-input-suffix">%</span>
                                </div>
                              </div>

                              <div className="admin-split-mirror-field">
                                <span className="field-label">% Visión Contable</span>
                                <div className="admin-readonly-pill">
                                  {visionPctCalc !== null
                                    ? `% Visión Contable = 100 − NYO (${visionPctCalc.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %)`
                                    : '% Visión Contable = 100 − NYO'}
                                </div>
                              </div>
                            </div>

                            {/* Ejemplo con la regla del servidor */}
                            {exampleText && (
                              <p className="admin-split-example-text">{exampleText}</p>
                            )}

                            {/* Error del servidor junto al campo */}
                            {errorMsg && (
                              <p className="form-error" role="alert">
                                {errorMsg}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="admin-dialog-actions">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setSplitModalOpen(false)}
                        disabled={splitBusy}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={splitBusy}
                      >
                        {splitBusy ? 'Guardando…' : 'Guardar porcentajes'}
                      </button>
                    </div>
                  </form>
                </Dialog>
              )}
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
