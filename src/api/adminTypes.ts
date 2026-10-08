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
}

export interface AdminPaymentSummary {
  id: string;
  payment_date?: string | null;
  amount: string;
  reference_code?: string | null;
  payment_method?: string | null;
  verified_by_admin_id?: string | null;
  created_at?: string | null;
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
  status?: string;
  page?: number;
  page_size?: number;
}
