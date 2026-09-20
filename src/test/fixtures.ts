import type {
  CalendarResponse,
  DashboardResponse,
  IncomeSummaryResponse,
  InvoiceDetailItem,
  InvoicesListResponse,
  IvaDetailResponse,
  IvaPeriodItem,
  SaleListResponse,
} from '../api/types';
import type { MockReply } from './utils';

export const BUSINESS_ID = 'biz-1';

export const DASHBOARD: DashboardResponse = {
  business: {
    id: BUSINESS_ID,
    commercial_name: 'Panadería La Espiga',
    legal_name: 'La Espiga SAS',
    nit: '900123456',
    dv: '7',
    economic_activity: 'Comercio',
    taxpayer_type: 'PERSONA_JURIDICA',
  },
  resumen: { total: 7300000, ivaAcumulado: 1387000, numFacturas: 21, variacion: 8, periodo: '2026-08' },
  historico: [
    { mes: 'Mar', period_year_month: '2026-03', total: 4000000 },
    { mes: 'Abr', period_year_month: '2026-04', total: 5000000 },
    { mes: 'May', period_year_month: '2026-05', total: 5500000 },
    { mes: 'Jun', period_year_month: '2026-06', total: 6000000 },
    { mes: 'Jul', period_year_month: '2026-07', total: 6800000 },
    { mes: 'Ago', period_year_month: '2026-08', total: 7300000 },
  ],
  facturasRecientes: [
    { id: 'i1', num: 'FE-501', fecha: '22 ago', cliente: 'Hotel Sol', valor: 1850000, iva: 351500, tipo: 'Emitido' },
    { id: 'i2', num: 'FE-500', fecha: '19 ago', cliente: 'Café Andes', valor: 980000, iva: 186200, tipo: 'Emitido' },
    { id: 'i3', num: 'FE-499', fecha: '15 ago', cliente: 'Restaurante Río', valor: 1200000, iva: 228000, tipo: 'Emitido' },
    { id: 'i4', num: 'FE-498', fecha: '11 ago', cliente: 'Tienda Norte', valor: 640000, iva: 121600, tipo: 'Emitido' },
    { id: 'i5', num: 'FE-497', fecha: '05 ago', cliente: 'Cliente quinto', valor: 100000, iva: 19000, tipo: 'Emitido' },
  ],
  alertaProximoVencimiento: {
    dias: 5,
    etiqueta: 'periodo 2026-08',
    limite: '10 sept 2026',
    estado: 'proximo',
    tax_type: 'IVA_BIMESTRAL',
  },
  suscripcion: {
    estado: 'ACTIVA',
    plan: 'TRIMESTRAL',
    has_warning_banner: false,
    days_left_in_grace: null,
    cutoff_date: null,
    grace_period_end: null,
  },
};

export function ivaPeriod(overrides: Partial<IvaPeriodItem> = {}): IvaPeriodItem {
  return {
    period_key: '2026-08',
    etiqueta: 'Jul – Ago 2026',
    generado: 2365500,
    descontable: 540000,
    saldo: 1825500,
    pct: 0.2283,
    estado: 'en_curso',
    limite: '10 sept 2026',
    dias: 5,
    facturas: [
      { fecha: '22 ago', cliente: 'Hotel Sol', valor: 1850000, iva: 351500, tipo: 'Emitido' },
      { fecha: '19 ago', cliente: 'Proveedor Harina', valor: 400000, iva: 76000, tipo: 'Recibido' },
    ],
    ...overrides,
  };
}

export const IVA: IvaDetailResponse = {
  business_id: BUSINESS_ID,
  nit: '900123456',
  nombre: 'Panadería La Espiga',
  periodos: [
    ivaPeriod(),
    ivaPeriod({
      period_key: '2026-06',
      etiqueta: 'May – Jun 2026',
      generado: 2100450,
      descontable: 610200,
      saldo: -50000,
      pct: 0.29,
      estado: 'presentado',
      limite: '10 jul 2026',
      dias: null,
      facturas: [{ fecha: '28 jun', cliente: 'Taller Norte', valor: 1600000, iva: 304000, tipo: 'Emitido' }],
    }),
  ],
};

export function invoice(n: number, overrides: Partial<InvoiceDetailItem> = {}): InvoiceDetailItem {
  return {
    id: `inv-${n}`,
    cufe: `cufe-${n}`,
    num: `FE-${1000 + n}`,
    issue_date: '2026-08-22T00:00:00',
    fecha_corta: '22 ago',
    cliente: `Cliente ${n}`,
    nit_contraparte: '900000001',
    valor: 100000 * n,
    iva: 19000 * n,
    tipo_documento: 'Factura electrónica',
    group_type: 'Emitido',
    ...overrides,
  };
}

export function invoicesPage(items: InvoiceDetailItem[], total = items.length, offset = 0): InvoicesListResponse {
  return { total_count: total, invoices: items, limit: 50, offset };
}

export const INVOICES: InvoicesListResponse = invoicesPage([invoice(1), invoice(2, { group_type: 'Recibido' })]);

export const INCOME_SUMMARY: IncomeSummaryResponse = {
  month: '2026-08',
  ingresos: '1500000.00',
  egresos: '400000.00',
  utilidad: '1100000.00',
  historial: [
    { month: '2026-03', ingresos: '1000000.00', egresos: '300000.00', utilidad: '700000.00' },
    { month: '2026-04', ingresos: '1100000.00', egresos: '320000.00', utilidad: '780000.00' },
    { month: '2026-05', ingresos: '1200000.00', egresos: '350000.00', utilidad: '850000.00' },
    { month: '2026-06', ingresos: '1300000.00', egresos: '380000.00', utilidad: '920000.00' },
    { month: '2026-07', ingresos: '1400000.00', egresos: '390000.00', utilidad: '1010000.00' },
    { month: '2026-08', ingresos: '1500000.00', egresos: '400000.00', utilidad: '1100000.00' },
  ],
};

export const CALENDAR: CalendarResponse = {
  obligaciones: [
    {
      tax_type: 'RETEFUENTE',
      etiqueta: 'Periodo 2026-08',
      fecha_limite: '2026-09-08',
      estado: 'completado',
      dias: null,
    },
    {
      tax_type: 'IVA_BIMESTRAL',
      etiqueta: 'Jul – Ago 2026',
      fecha_limite: '2026-09-14',
      estado: 'proximo',
      dias: 5,
    },
    {
      tax_type: 'RENTA_PERSONAS_JURIDICAS',
      etiqueta: 'Renta año gravable 2025 · Cuota 2',
      fecha_limite: '2026-10-20',
      estado: 'aldia',
      dias: 40,
    },
    {
      tax_type: 'IVA_BIMESTRAL',
      etiqueta: 'Sep – Oct 2026',
      fecha_limite: '2026-11-17',
      estado: 'aldia',
      dias: 100,
    },
  ],
};

export const SALES_LIST: SaleListResponse = {
  month: '2026-09',
  sales: [
    {
      id: 's-1',
      total_amount: '150000.00',
      description: '3 tortas',
      recorded_via: 'WEB',
      sale_date: '2026-09-18',
      created_at: '2026-09-18T15:00:00',
    },
    {
      id: 's-2',
      total_amount: '40000.50',
      description: null,
      recorded_via: 'WEB',
      sale_date: '2026-09-12',
      created_at: '2026-09-12T10:00:00',
    },
  ],
};

/** Respuestas por defecto de las pantallas de datos, para las pruebas que solo miran el shell. */
export const DATA_ROUTES: Record<string, MockReply> = {
  [`GET /api/dashboard/${BUSINESS_ID}`]: { body: DASHBOARD },
  [`GET /api/iva/${BUSINESS_ID}`]: { body: IVA },
  [`GET /api/calendar/${BUSINESS_ID}`]: { body: CALENDAR },
  [`GET /api/invoices/${BUSINESS_ID}`]: { body: INVOICES },
  [`GET /api/income-summary/${BUSINESS_ID}`]: { body: INCOME_SUMMARY },
  [`GET /api/sales/${BUSINESS_ID}`]: { body: SALES_LIST },
};


