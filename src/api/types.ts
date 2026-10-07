/** Tipos de las respuestas de la API de datos (espejo de `api/schemas.py`, Story 4.2). */

export interface BusinessInfo {
  id: string;
  commercial_name: string;
  legal_name: string;
  nit: string;
  dv: string;
  economic_activity: string | null;
  taxpayer_type: string;
}

export interface MetricSummary {
  total: number;
  ivaAcumulado: number;
  numFacturas: number;
  /** Variación porcentual contra el mes anterior (8 = +8 %). */
  variacion: number;
  /** Mes del resumen, `YYYY-MM`. */
  periodo: string;
}

export interface MonthlyBar {
  mes: string;
  period_year_month: string;
  total: number;
}

export interface RecentInvoice {
  id: string;
  num: string;
  fecha: string;
  cliente: string;
  valor: number;
  iva: number;
  tipo: string;
}

export interface NextTaxAlert {
  dias: number | null;
  etiqueta: string;
  limite: string | null;
  estado: string;
  tax_type: string | null;
}

/** Espejo de `api/schemas.py`, Story 4.1b. */
export interface CalendarObligation {
  tax_type: string;
  etiqueta: string;
  fecha_limite: string;
  estado: string;
  dias: number | null;
}

export interface CalendarResponse {
  obligaciones: CalendarObligation[];
}

export interface SubscriptionInfo {
  estado: string;
  plan: string;
  has_warning_banner: boolean;
  days_left_in_grace: number | null;
  cutoff_date: string | null;
  grace_period_end: string | null;
}

export interface DashboardResponse {
  business: BusinessInfo;
  resumen: MetricSummary;
  historico: MonthlyBar[];
  facturasRecientes: RecentInvoice[];
  alertaProximoVencimiento: NextTaxAlert;
  suscripcion: SubscriptionInfo;
}

export interface PeriodInvoiceItem {
  fecha: string;
  cliente: string;
  valor: number;
  iva: number;
  tipo: string;
}

export interface IvaPeriodItem {
  period_key: string;
  etiqueta: string;
  generado: number;
  descontable: number;
  /** > 0 saldo a pagar, < 0 saldo a favor. */
  saldo: number;
  /** Proporción descontable / generado (0 a 1), ya calculada por la API. */
  pct: number;
  /** `en_curso` o `presentado`. */
  estado: string;
  limite: string | null;
  dias: number | null;
  facturas: PeriodInvoiceItem[];
}

export interface IvaDetailResponse {
  business_id: string;
  nit: string;
  nombre: string;
  periodos: IvaPeriodItem[];
}

/** Cuerpo de `POST /api/sales/{business_id}`. El total viaja como texto para no perder decimales. */
export interface SaleCreatePayload {
  total_amount: string;
  description?: string;
}

/** Venta registrada (Story 5.3). `total_amount` llega como cadena Decimal ("150000.00"); solo se convierte a número para mostrarlo. */
export interface SaleResponse {
  id: string;
  total_amount: string;
  description: string | null;
  recorded_via: string;
  created_at: string;
}

/** Espejo de `api/schemas.py`, Story 6.5. */
export interface SaleListItem {
  id: string;
  total_amount: string;
  description: string | null;
  recorded_via: string;
  sale_date: string;
  created_at: string;
}

export interface SaleListResponse {
  month: string;
  sales: SaleListItem[];
}

export interface SaleVoidResponse {
  id: string;
  voided_at: string;
}

export type GroupType = 'Emitido' | 'Recibido';

export interface InvoiceDetailItem {
  id: string;
  cufe: string;
  num: string;
  issue_date: string;
  fecha_corta: string;
  cliente: string;
  nit_contraparte: string;
  valor: number;
  iva: number;
  tipo_documento: string;
  group_type: string;
}

export interface InvoicesListResponse {
  total_count: number;
  invoices: InvoiceDetailItem[];
  limit: number;
  offset: number;
}

/** Espejo de `IncomeSummaryResponse` de `api/schemas.py` (Story 6.3). */
export interface IncomeSummaryItem {
  month: string;
  ingresos: string;
  egresos: string;
  utilidad: string;
}

export interface IncomeSummaryResponse {
  month: string;
  ingresos: string;
  egresos: string;
  utilidad: string;
  historial: IncomeSummaryItem[];
}

export type DocumentType =
  | 'RUT'
  | 'CAMARA_COMERCIO'
  | 'CEDULA_REPRESENTANTE'
  | 'CERTIFICACION_BANCARIA'
  | 'OTRO';

export interface BusinessDocument {
  id: string;
  doc_type: DocumentType;
  description: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface DocumentsResponse {
  documents: BusinessDocument[];
}

export interface DocumentLinkResponse {
  url: string;
  expires_in: number;
}

