/**
 * Tipos de la API de administración (espejo de esquemas Pydantic del backend).
 */

export interface AdminClientListItem {
  business_id: string;
  user_id: string;
  legal_name: string;
  commercial_name: string;
  nit: string;
  dv: string;
  income_source: string;
  taxpayer_type: string;
  contact_name: string;
  phone?: string | null;
  is_telegram_linked: boolean;
  plan?: string | null;
  subscription_status?: string | null;
  cutoff_date?: string | null;
  grace_period_end?: string | null;
  is_active: boolean;
  vat_responsible?: boolean;
  package?: AdminPackage | string | null;
}

export interface AdminClientsListResponse {
  items: AdminClientListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminClientBusiness {
  id: string;
  legal_name: string;
  commercial_name: string;
  nit: string;
  dv: string;
  taxpayer_type: string;
  legal_rep_doc?: string | null;
  economic_activity?: string | null;
  income_source: string;
  is_active: boolean;
  created_at?: string | null;
  vat_responsible?: boolean;
  package?: AdminPackage | string | null;
}

export interface AdminClientContact {
  id: string;
  full_name: string;
  phone?: string | null;
  email: string;
  is_telegram_linked: boolean;
  telegram_chat_id?: number | null;
  telegram_username?: string | null;
}

export interface AdminTaxProfile {
  iva_periodicity?: string | null;
  is_withholding_agent: boolean;
}

/** Cambio de precio de la suscripción (Story 9.2, `price_changes` de la ficha). Importes como cadena decimal. */
export interface AdminSubscriptionPriceChange {
  id: string;
  created_at: string | null;
  old_plan: string | null;
  new_plan: string | null;
  old_monthly_price: string | null;
  new_monthly_price: string | null;
  old_discount_rate: string | null;
  new_discount_rate: string | null;
  old_final_price: string | null;
  new_final_price: string | null;
  reason: string;
  admin: string | null;
}

export interface AdminSubscriptionDetail {
  id: string;
  plan: string;
  status: string;
  discount_rate?: string | null;
  base_price?: string | null;
  final_price?: string | null;
  start_date?: string | null;
  cutoff_date?: string | null;
  grace_period_end?: string | null;
  monthly_price?: string | null;
  price_origin?: 'TARIFA' | 'ESPECIAL' | string | null;
  price_note?: string | null;
  current_rate_monthly?: string | null;
  package?: AdminPackage | string | null;
  current_package?: AdminPackage | string | null;
  price_changes?: AdminSubscriptionPriceChange[];
}

export interface AdminPaymentSummary {
  id: string;
  payment_date?: string | null;
  amount: string;
  reference_code?: string | null;
  payment_method?: string | null;
  verified_by_admin_id?: string | null;
  created_at?: string | null;
  expected_amount?: string | null;
  difference?: string | null;
  nyo_amount?: string | null;
  visioncontable_amount?: string | null;
}

export interface AdminExtractionSummary {
  id: string;
  period: string;
  status: string;
  attempts: number;
  next_run_at?: string | null;
  finished_at?: string | null;
  error_code?: string | null;
}

export interface ClientDetailResponse {
  business: AdminClientBusiness;
  contact: AdminClientContact;
  tax_profile: AdminTaxProfile;
  subscription?: AdminSubscriptionDetail | null;
  recent_payments: AdminPaymentSummary[];
  recent_extractions: AdminExtractionSummary[];
  active_documents_count: number;
  has_pending_activation_link: boolean;

  // Campos top-level de conveniencia
  business_id?: string | null;
  legal_name?: string | null;
  commercial_name?: string | null;
  nit?: string | null;
  dv?: string | null;
  income_source?: string | null;
  taxpayer_type?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  is_telegram_linked?: boolean | null;
  telegram_chat_id?: number | null;
  iva_periodicity?: string | null;
  is_withholding_agent?: boolean | null;
  price_changes?: AdminSubscriptionPriceChange[];
  vat_responsible?: boolean | null;
  package?: AdminPackage | string | null;
}

export interface AdminSummaryWorker {
  name: string;
  last_seen_at?: string | null;
  minutes_since?: number | null;
  is_silent: boolean;
}

export interface AdminSummaryWorkerInfo {
  silence_threshold_minutes: number;
  workers: AdminSummaryWorker[];
}

export interface AdminSummaryUpcomingCutoff {
  business_id: string;
  commercial_name: string;
  nit: string;
  cutoff_date: string;
}

export interface AdminSummaryInGrace {
  business_id: string;
  commercial_name: string;
  nit: string;
  cutoff_date: string;
  grace_period_end: string;
}

export interface AdminSummaryResponse {
  clients_by_status: {
    ACTIVO?: number;
    EN_MORA?: number;
    BLOQUEADO?: number;
    CANCELADO?: number;
    SIN_SUSCRIPCION?: number;
    [key: string]: number | undefined;
  };
  clients_by_income_source: {
    DIAN?: number;
    MANUAL_SALES?: number;
    MIXED?: number;
    [key: string]: number | undefined;
  };
  clients_by_package?: {
    CON_IVA?: number;
    SIN_IVA?: number;
    [key: string]: number | undefined;
  };
  upcoming_cutoffs: AdminSummaryUpcomingCutoff[];
  in_grace: AdminSummaryInGrace[];
  payments_this_month: {
    count: number;
    total: number;
  };
  failed_jobs_24h: number;
  unlinked_telegram: number;
  worker?: AdminSummaryWorkerInfo | null;
}

export interface AdminClientsQuery {
  q?: string;
  income_source?: string;
  package?: AdminPackage | string;
  status?: string;
  page?: number;
  page_size?: number;
}

// ==============================================================================
// Story 8.6: Tipos de acciones (Alta de cliente, pagos y configuración)
// ==============================================================================

export type AdminPackage = 'CON_IVA' | 'SIN_IVA';
export type AdminPersonType = 'PERSONA' | 'EMPRESA';
export type AdminPlan = string;
export type AdminIncomeSource = 'DIAN' | 'MANUAL_SALES' | 'MIXED';

export interface AdminClientCreateRequest {
  person_type: 'PERSONA' | 'EMPRESA';
  contact_name: string;
  phone: string;
  document_number?: string | null;
  company_name?: string | null;
  nit?: string | null;
  legal_rep_doc?: string | null;
  plan: string;
  vat_responsible?: boolean;
  income_source?: AdminIncomeSource | string | null;
}

export interface AdminClientCreateResponse {
  business_id: string;
  user_id: string;
  activation_link: string;
  package?: AdminPackage | string | null;
  final_price?: string | null;
  monthly_price?: string | null;
  discount_rate?: string | null;
  cutoff_date?: string | null;
}

export interface AdminPaymentCreateRequest {
  amount: number | string;
  reference: string;
  allow_mismatch?: boolean;
}

export interface AdminPaymentItem {
  id: string;
  amount: string;
  payment_date: string;
  reference_code?: string | null;
  verified_by_admin_id?: string | null;
  created_at?: string | null;
  expected_amount?: string | null;
  difference?: string | null;
}

export interface AdminPaymentResponse {
  payment: AdminPaymentItem;
  new_cutoff_date: string;
  status: string;
  client_notified: boolean;
  payment_id?: string | null;
  amount?: string | null;
  reference?: string | null;
  expected_amount?: string | null;
  difference?: string | null;
}

export interface AdminIncomeSourceRequest {
  income_source: 'DIAN' | 'MANUAL_SALES' | string;
}

export interface AdminClientProfileUpdateRequest {
  vat_responsible?: boolean;
  income_source?: AdminIncomeSource | string;
}

export interface AdminTaxProfileRequest {
  iva_periodicity?: 'BIMESTRAL' | 'CUATRIMESTRAL' | null;
  is_withholding_agent: boolean;
}

export interface AdminActivationLinkResponse {
  activation_link: string;
}

// ==============================================================================
// Story 8.7: Tipos de Documentos y Operación DIAN
// ==============================================================================

export interface AdminJobItem {
  job_id: string;
  business_id: string;
  commercial_name: string;
  nit: string;
  target_period: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_run_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface AdminJobsListResponse {
  items: AdminJobItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminJobsQuery {
  status?: string;
  business_id?: string;
  page?: number;
  page_size?: number;
}

export interface AdminWorkerItem {
  name: string;
  last_seen_at?: string | null;
  minutes_since?: number | null;
  is_silent: boolean;
}

export interface AdminWorkerStatusResponse {
  silence_threshold_minutes: number;
  workers: AdminWorkerItem[];
}

export interface AdminExtractionCreateRequest {
  period?: string;
  months?: number;
}

export interface AdminExtractionCreateResponse {
  job_id: string;
  business_id: string;
  target_period: string;
  status: string;
  attempt_count?: number;
  max_attempts?: number;
  next_run_at?: string | null;
  created_at?: string | null;
  id?: string | null;
  period?: string | null;
}

export interface AdminDocumentItem {
  id: string;
  number: number;
  doc_type: string;
  description?: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  document_id?: string | null;
}

export interface DocumentLinkResponse {
  url: string;
  expires_in: number;
}

// ==============================================================================
// Story 9.3 / 9.2: Tipos de Tarifas, Planes y Cotizaciones
// ==============================================================================

export interface AdminPricingPlan {
  code: string;
  name: string;
  months: number;
  discount_rate: string;
  is_active: boolean;
  sort_order: number;
}

export interface AdminPricingRate {
  id?: string;
  package: AdminPackage | string;
  monthly_price: string;
  effective_from: string;
  created_by_admin_id?: string | null;
}

export interface AdminPricingScheduledRate {
  id: string;
  package: AdminPackage | string;
  monthly_price: string;
  effective_from: string;
}

export interface AdminPricingQuote {
  package: AdminPackage | string;
  plan: string;
  months: number;
  monthly_price: string;
  gross_total: string;
  discount_rate: string;
  discount_amount: string;
  final_price: string;
  start_date?: string | null;
  cutoff_date?: string | null;
}

export interface AdminPricingResponse {
  grace_days: number;
  plans: AdminPricingPlan[];
  rates: AdminPricingRate[];
  scheduled: AdminPricingScheduledRate[];
  quotes: AdminPricingQuote[];
}

export interface AdminPricingPlanUpdateRequest {
  name?: string;
  discount_rate?: number | string;
  is_active?: boolean;
}

export interface AdminPricingPlanCreateRequest {
  code: string;
  name: string;
  months: number;
  discount_rate: number | string;
}

export interface AdminPricingSettingsResponse {
  grace_days: number;
  updated_at?: string | null;
}

export interface AdminPricingSettingsUpdateRequest {
  grace_days: number;
}

export interface AdminPricingRateCreateRequest {
  package: AdminPackage | string;
  monthly_price: number | string;
  effective_from?: string;
}

export interface AdminPricingRateHistoryItem {
  id?: string;
  package?: AdminPackage | string;
  monthly_price: string;
  effective_from: string;
  created_by?: string | null;
  created_at?: string | null;
}

export interface AdminSubscriptionUpdateRequest {
  plan?: string;
  monthly_price?: number | string;
  discount_rate?: number | string;
  use_current_rate?: boolean;
  reason: string;
}

// ==============================================================================
// Story 10.6: Tipos de Contabilidad y Reparto (AC #7 a #10)
// ==============================================================================

export interface AdminAccountingPackageCollected {
  total: string;
  count: number;
}

export interface AdminAccountingCollected {
  total: string;
  count: number;
  by_package: {
    CON_IVA: AdminAccountingPackageCollected;
    SIN_IVA: AdminAccountingPackageCollected;
    [key: string]: AdminAccountingPackageCollected | undefined;
  };
}

export interface AdminAccountingPartnerSplit {
  total: string;
  by_package: {
    CON_IVA: string;
    SIN_IVA: string;
    [key: string]: string | undefined;
  };
}

export interface AdminAccountingSplit {
  nyo: AdminAccountingPartnerSplit;
  visioncontable: AdminAccountingPartnerSplit;
}

export interface AdminAccountingClients {
  active_total: number;
  by_package: {
    CON_IVA: number;
    SIN_IVA: number;
    [key: string]: number | undefined;
  };
  by_income_source: {
    DIAN: number;
    MANUAL_SALES: number;
    MIXED: number;
    [key: string]: number | undefined;
  };
  new_in_period: number;
}

export interface AdminAccountingMrr {
  total: string;
  by_package: {
    CON_IVA: string;
    SIN_IVA: string;
    [key: string]: string | undefined;
  };
}

export interface AdminAccountingMrrSplit {
  nyo: AdminAccountingPartnerSplit;
  visioncontable: AdminAccountingPartnerSplit;
}

export interface AdminAccountingMonthlyItem {
  month: string;
  CON_IVA: string;
  SIN_IVA: string;
  total: string;
}

export interface AdminAccountingPaymentItem {
  payment_date: string;
  business_id: string;
  commercial_name: string;
  package: AdminPackage | string;
  amount: string;
  nyo_amount: string;
  visioncontable_amount: string;
}

export interface AdminAccountingResponse {
  collected: AdminAccountingCollected;
  split: AdminAccountingSplit;
  clients: AdminAccountingClients;
  mrr: AdminAccountingMrr;
  mrr_split: AdminAccountingMrrSplit;
  monthly: AdminAccountingMonthlyItem[];
  payments: AdminAccountingPaymentItem[];
}

export interface AdminRevenueSplitItem {
  package: AdminPackage | string;
  nyo_pct: string;
  visioncontable_pct: string;
  updated_at?: string | null;
}

export interface AdminRevenueSplitUpdateRequest {
  nyo_pct: string;
}


