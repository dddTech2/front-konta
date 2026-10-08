import type {
  AdminClientsListResponse,
  AdminDocumentItem,
  AdminJobsListResponse,
  AdminWorkerStatusResponse,
  AdminSummaryResponse,
  CalendarResponse,
  ClientDetailResponse,
  DashboardResponse,
  DocumentsResponse,
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

export const DOCUMENTS: DocumentsResponse = {
  documents: [
    {
      id: 'doc-1',
      doc_type: 'RUT',
      description: null,
      original_filename: 'RUT_2026.pdf',
      content_type: 'application/pdf',
      size_bytes: 235520, // 230 KB
      created_at: '2026-10-06T21:57:00',
    },
    {
      id: 'doc-2',
      doc_type: 'CAMARA_COMERCIO',
      description: null,
      original_filename: 'camara_comercio.pdf',
      content_type: 'application/pdf',
      size_bytes: 1258291, // 1,2 MB
      created_at: '2026-10-05T14:30:00',
    },
    {
      id: 'doc-3',
      doc_type: 'OTRO',
      description: 'Contrato de arrendamiento',
      original_filename: 'contrato.pdf',
      content_type: 'application/pdf',
      size_bytes: 999, // 999 B
      created_at: '2026-10-01T10:00:00',
    },
  ],
};

export const ADMIN_SUMMARY: AdminSummaryResponse = {
  clients_by_status: {
    ACTIVO: 15,
    EN_MORA: 3,
    BLOQUEADO: 2,
    CANCELADO: 1,
    SIN_SUSCRIPCION: 4,
  },
  clients_by_income_source: {
    DIAN: 20,
    MANUAL_SALES: 5,
  },
  upcoming_cutoffs: [
    {
      business_id: 'biz-1',
      commercial_name: 'Panadería La Espiga',
      nit: '900123456',
      cutoff_date: '2026-10-12',
    },
    {
      business_id: 'biz-2',
      commercial_name: 'Cafetería Central',
      nit: '901234567',
      cutoff_date: '2026-10-14',
    },
  ],
  in_grace: [
    {
      business_id: 'biz-3',
      commercial_name: 'Ferretería El Tornillo',
      nit: '900987654',
      cutoff_date: '2026-10-05',
      grace_period_end: '2026-10-10',
    },
  ],
  payments_this_month: {
    count: 12,
    total: 3600000,
  },
  failed_jobs_24h: 1,
  unlinked_telegram: 3,
  worker: {
    silence_threshold_minutes: 15,
    workers: [
      {
        name: 'worker-primary',
        last_seen_at: '2026-10-07T18:15:00',
        minutes_since: 4,
        is_silent: false,
      },
    ],
  },
};

export const ADMIN_CLIENTS: AdminClientsListResponse = {
  items: [
    {
      business_id: 'biz-1',
      user_id: 'usr-1',
      legal_name: 'La Espiga SAS',
      commercial_name: 'Panadería La Espiga',
      nit: '900123456',
      dv: '7',
      income_source: 'DIAN',
      taxpayer_type: 'PERSONA_JURIDICA',
      contact_name: 'Carlos Pérez',
      phone: '3001112233',
      is_telegram_linked: true,
      plan: 'TRIMESTRAL',
      subscription_status: 'ACTIVO',
      cutoff_date: '2026-10-12',
      grace_period_end: null,
      is_active: true,
    },
    {
      business_id: 'biz-2',
      user_id: 'usr-2',
      legal_name: 'Cafetería Central SAS',
      commercial_name: 'Cafetería Central',
      nit: '901234567',
      dv: '1',
      income_source: 'DIAN',
      taxpayer_type: 'PERSONA_JURIDICA',
      contact_name: 'María Gómez',
      phone: '3109876543',
      is_telegram_linked: false,
      plan: 'MENSUAL',
      subscription_status: 'EN_MORA',
      cutoff_date: '2026-10-05',
      grace_period_end: '2026-10-10',
      is_active: true,
    },
    {
      business_id: 'biz-3',
      user_id: 'usr-3',
      legal_name: 'El Tornillo SAS',
      commercial_name: 'Ferretería El Tornillo',
      nit: '900987654',
      dv: '3',
      income_source: 'MANUAL_SALES',
      taxpayer_type: 'PERSONA_JURIDICA',
      contact_name: 'Jorge Ramos',
      phone: '3205554433',
      is_telegram_linked: true,
      plan: 'SEMESTRAL',
      subscription_status: 'BLOQUEADO',
      cutoff_date: '2026-09-30',
      grace_period_end: '2026-10-05',
      is_active: false,
    },
  ],
  total: 3,
  page: 1,
  page_size: 20,
};

export const ADMIN_CLIENT_DETAIL: ClientDetailResponse = {
  business: {
    id: 'biz-1',
    legal_name: 'La Espiga SAS',
    commercial_name: 'Panadería La Espiga',
    nit: '900123456',
    dv: '7',
    taxpayer_type: 'PERSONA_JURIDICA',
    legal_rep_doc: '80123456',
    economic_activity: 'Elaboración de productos de panadería',
    income_source: 'DIAN',
    is_active: true,
    created_at: '2026-01-15T10:00:00',
  },
  contact: {
    id: 'usr-1',
    full_name: 'Carlos Pérez',
    phone: '3001112233',
    email: 'carlos@laespiga.com',
    is_telegram_linked: true,
    telegram_chat_id: 12345678,
    telegram_username: 'carlosperez',
  },
  tax_profile: {
    iva_periodicity: 'BIMESTRAL',
    is_withholding_agent: true,
  },
  subscription: {
    id: 'sub-1',
    plan: 'TRIMESTRAL',
    status: 'ACTIVO',
    discount_rate: '10',
    base_price: '300000',
    final_price: '270000',
    start_date: '2026-07-12',
    cutoff_date: '2026-10-12',
    grace_period_end: '2026-10-17',
  },
  recent_payments: [
    {
      id: 'pay-1',
      payment_date: '2026-07-10',
      amount: '270000.00',
      reference_code: 'REF-778899',
      payment_method: 'TRANSFERENCIA',
      verified_by_admin_id: 'adm-1',
      created_at: '2026-07-10T14:30:00',
    },
  ],
  recent_extractions: [
    {
      id: 'ext-1',
      period: '2026-08',
      status: 'SUCCESS',
      attempts: 1,
      next_run_at: null,
      finished_at: '2026-09-01T04:15:00',
      error_code: null,
    },
  ],
  active_documents_count: 3,
  has_pending_activation_link: false,
};


export const ADMIN_DOCUMENTS: AdminDocumentItem[] = [
  {
    id: 'doc-1',
    number: 1,
    doc_type: 'RUT',
    description: null,
    original_filename: 'RUT_2026.pdf',
    content_type: 'application/pdf',
    size_bytes: 235520, // 230 KB
    created_at: '2026-10-06T21:57:00',
  },
  {
    id: 'doc-2',
    number: 2,
    doc_type: 'CAMARA_COMERCIO',
    description: null,
    original_filename: 'camara_comercio.pdf',
    content_type: 'application/pdf',
    size_bytes: 1258291, // 1,2 MB
    created_at: '2026-10-05T14:30:00',
  },
  {
    id: 'doc-3',
    number: 3,
    doc_type: 'OTRO',
    description: 'Contrato de arrendamiento',
    original_filename: 'contrato.pdf',
    content_type: 'application/pdf',
    size_bytes: 999, // 999 B
    created_at: '2026-10-01T10:00:00',
  },
];

export const ADMIN_WORKER_STATUS: AdminWorkerStatusResponse = {
  silence_threshold_minutes: 15,
  workers: [
    {
      name: 'worker-dian-1',
      last_seen_at: '2026-10-07T18:15:00',
      minutes_since: 3,
      is_silent: false,
    },
  ],
};

export const ADMIN_JOBS: AdminJobsListResponse = {
  items: [
    {
      job_id: 'job-1',
      business_id: 'biz-1',
      commercial_name: 'Panadería La Espiga',
      nit: '900123456',
      target_period: '2026-08',
      status: 'SUCCESS',
      attempt_count: 1,
      max_attempts: 3,
      next_run_at: null,
      started_at: '2026-09-01T04:00:00',
      finished_at: '2026-09-01T04:15:00',
      error_code: null,
      error_message: null,
    },
    {
      job_id: 'job-2',
      business_id: 'biz-2',
      commercial_name: 'Cafetería Central',
      nit: '901234567',
      target_period: '2026-09',
      status: 'FAILED',
      attempt_count: 3,
      max_attempts: 3,
      next_run_at: null,
      started_at: '2026-10-01T04:00:00',
      finished_at: '2026-10-01T04:05:00',
      error_code: 'DIAN_PORTAL_UNAVAILABLE',
      error_message: 'Portal de la DIAN no disponible',
    },
    {
      job_id: 'job-3',
      business_id: 'biz-1',
      commercial_name: 'Panadería La Espiga',
      nit: '900123456',
      target_period: '2026-10',
      status: 'PROCESSING',
      attempt_count: 1,
      max_attempts: 3,
      next_run_at: null,
      started_at: '2026-10-07T19:00:00',
      finished_at: null,
      error_code: null,
      error_message: null,
    },
  ],
  total: 3,
  page: 1,
  page_size: 20,
};

/** Respuestas por defecto de las pantallas de datos, para las pruebas que solo miran el shell. */
export const DATA_ROUTES: Record<string, MockReply> = {
  [`GET /api/dashboard/${BUSINESS_ID}`]: { body: DASHBOARD },
  [`GET /api/iva/${BUSINESS_ID}`]: { body: IVA },
  [`GET /api/calendar/${BUSINESS_ID}`]: { body: CALENDAR },
  [`GET /api/invoices/${BUSINESS_ID}`]: { body: INVOICES },
  [`GET /api/income-summary/${BUSINESS_ID}`]: { body: INCOME_SUMMARY },
  [`GET /api/sales/${BUSINESS_ID}`]: { body: SALES_LIST },
  [`GET /api/documents/${BUSINESS_ID}`]: { body: DOCUMENTS },
  'GET /api/admin/summary': { body: ADMIN_SUMMARY },
  'GET /api/admin/clients': { body: ADMIN_CLIENTS },
  'GET /api/admin/worker': { body: ADMIN_WORKER_STATUS },
  'GET /api/admin/jobs': { body: ADMIN_JOBS },
};
