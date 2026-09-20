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
  limite: string;
  estado: string;
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
  limite: string;
  dias: number | null;
  facturas: PeriodInvoiceItem[];
}

export interface IvaDetailResponse {
  business_id: string;
  nit: string;
  nombre: string;
  periodos: IvaPeriodItem[];
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
