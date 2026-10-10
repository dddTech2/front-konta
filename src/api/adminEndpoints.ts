import { apiFetch } from './client';
import type {
  AdminActivationLinkResponse,
  AdminClientCreateRequest,
  AdminClientCreateResponse,
  AdminClientsListResponse,
  AdminClientsQuery,
  AdminIncomeSourceRequest,
  AdminPaymentCreateRequest,
  AdminPaymentResponse,
  AdminSummaryResponse,
  AdminTaxProfileRequest,
  ClientDetailResponse,
  AdminDocumentItem,
  AdminExtractionCreateRequest,
  AdminExtractionCreateResponse,
  AdminJobsListResponse,
  AdminJobsQuery,
  AdminWorkerStatusResponse,
  DocumentLinkResponse,
  AdminPricingPlan,
  AdminPricingPlanCreateRequest,
  AdminPricingPlanUpdateRequest,
  AdminPricingQuote,
  AdminPricingRate,
  AdminPricingRateCreateRequest,
  AdminPricingRateHistoryItem,
  AdminPricingResponse,
  AdminPricingSettingsResponse,
  AdminPricingSettingsUpdateRequest,
  AdminSubscriptionUpdateRequest,
} from './adminTypes';

/**
 * Consulta el resumen general del panel de administración (Story 8.4 AC #1).
 */
export function getAdminSummary(): Promise<AdminSummaryResponse> {
  return apiFetch<AdminSummaryResponse>('/api/admin/summary');
}

/**
 * Consulta la lista paginada de clientes con filtros opcionales (Story 8.3 AC #1).
 */
export function getAdminClients(query: AdminClientsQuery = {}): Promise<AdminClientsListResponse> {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.income_source) params.set('income_source', query.income_source);
  if (query.status) params.set('status', query.status);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size));
  const qs = params.toString();
  return apiFetch<AdminClientsListResponse>(`/api/admin/clients${qs ? `?${qs}` : ''}`);
}

/**
 * Consulta la ficha completa de un cliente por business_id (Story 8.3 AC #2).
 */
export function getAdminClientDetail(businessId: string): Promise<ClientDetailResponse> {
  return apiFetch<ClientDetailResponse>(`/api/admin/clients/${encodeURIComponent(businessId)}`);
}

// ==============================================================================
// Story 8.6: Acciones de administración
// ==============================================================================

/**
 * Crea un cliente desde el panel de administración (Story 8.6 AC #1).
 */
export function createAdminClient(data: AdminClientCreateRequest): Promise<AdminClientCreateResponse> {
  return apiFetch<AdminClientCreateResponse>('/api/admin/clients', {
    method: 'POST',
    body: data,
  });
}

/**
 * Registra un pago comercial a un cliente (Story 8.6 AC #2).
 */
export function recordAdminPayment(
  businessId: string,
  data: AdminPaymentCreateRequest,
): Promise<AdminPaymentResponse> {
  return apiFetch<AdminPaymentResponse>(`/api/admin/clients/${encodeURIComponent(businessId)}/payments`, {
    method: 'POST',
    body: data,
  });
}

/**
 * Actualiza el origen de ingresos del cliente (Story 8.6 AC #3).
 */
export function updateAdminIncomeSource(
  businessId: string,
  data: AdminIncomeSourceRequest,
): Promise<ClientDetailResponse> {
  return apiFetch<ClientDetailResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/income-source`,
    {
      method: 'PATCH',
      body: data,
    },
  );
}

/**
 * Actualiza el perfil tributario del cliente (Story 8.6 AC #3).
 */
export function updateAdminTaxProfile(
  businessId: string,
  data: AdminTaxProfileRequest,
): Promise<ClientDetailResponse> {
  return apiFetch<ClientDetailResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/tax-profile`,
    {
      method: 'PATCH',
      body: data,
    },
  );
}

/**
 * Genera un nuevo enlace de activación de Telegram (Story 8.6 AC #4).
 */
export function generateAdminActivationLink(businessId: string): Promise<AdminActivationLinkResponse> {
  return apiFetch<AdminActivationLinkResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/activation-link`,
    {
      method: 'POST',
    },
  );
}

/**
 * Desvincula Telegram del cliente (Story 8.6 AC #4).
 */
export function releaseAdminTelegram(businessId: string): Promise<ClientDetailResponse> {
  return apiFetch<ClientDetailResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/release-telegram`,
    {
      method: 'POST',
    },
  );
}

// ==============================================================================
// Story 8.7: Endpoints de Operación y Documentos de Clientes
// ==============================================================================

/**
 * Consulta la lista paginada de trabajos de extracción DIAN con filtros opcionales (Story 8.7 AC #3).
 */
export function getAdminJobs(query: AdminJobsQuery = {}): Promise<AdminJobsListResponse> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.business_id) params.set('business_id', query.business_id);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.page_size !== undefined) params.set('page_size', String(query.page_size));
  const qs = params.toString();
  return apiFetch<AdminJobsListResponse>(`/api/admin/jobs${qs ? `?${qs}` : ''}`);
}

/**
 * Consulta el estado y latido de los workers de fondo (Story 8.7 AC #3).
 */
export function getAdminWorkerStatus(): Promise<AdminWorkerStatusResponse> {
  return apiFetch<AdminWorkerStatusResponse>('/api/admin/worker');
}

/**
 * Encola una descarga de la DIAN para un cliente (Story 8.7 AC #2).
 */
export function triggerAdminExtraction(
  businessId: string,
  data: AdminExtractionCreateRequest,
): Promise<AdminExtractionCreateResponse> {
  return apiFetch<AdminExtractionCreateResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/extractions`,
    {
      method: 'POST',
      body: data,
    },
  );
}

/**
 * Consulta la lista de documentos activos de un cliente (Story 8.7 AC #1).
 * Nota: devuelve un arreglo directo de AdminDocumentItem (no un objeto con 'documents').
 */
export function getAdminDocuments(businessId: string): Promise<AdminDocumentItem[]> {
  return apiFetch<AdminDocumentItem[]>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/documents`,
  );
}

/**
 * Sube un nuevo documento para el cliente con multipart/form-data (Story 8.7 AC #1).
 */
export function uploadAdminDocument(
  businessId: string,
  formData: FormData,
): Promise<AdminDocumentItem> {
  return apiFetch<AdminDocumentItem>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/documents`,
    {
      method: 'POST',
      body: formData,
    },
  );
}

/**
 * Retira un documento activo del cliente (Story 8.7 AC #1).
 */
export function deleteAdminDocument(
  businessId: string,
  documentId: string,
): Promise<void> {
  return apiFetch<void>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/documents/${encodeURIComponent(documentId)}`,
    {
      method: 'DELETE',
    },
  );
}

/**
 * Genera un enlace temporal firmado para abrir o descargar un documento (Story 8.7 AC #1).
 */
export function getAdminDocumentLink(
  businessId: string,
  documentId: string,
): Promise<DocumentLinkResponse> {
  return apiFetch<DocumentLinkResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/documents/${encodeURIComponent(documentId)}/link`,
    {
      method: 'POST',
    },
  );
}

// ==============================================================================
// Story 9.3 / 9.2: Endpoints de Tarifas, Planes, Ajustes y Cotizaciones
// ==============================================================================

/**
 * Consulta la configuración de tarifas, planes, cotizaciones y días de gracia (Story 9.2 AC #1).
 */
export function getAdminPricing(): Promise<AdminPricingResponse> {
  return apiFetch<AdminPricingResponse>('/api/admin/pricing');
}

/**
 * Actualiza un plan de suscripción (Story 9.2 AC #2).
 */
export function updateAdminPricingPlan(
  code: string,
  data: AdminPricingPlanUpdateRequest,
): Promise<AdminPricingPlan> {
  return apiFetch<AdminPricingPlan>(`/api/admin/pricing/plans/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: data,
  });
}

/**
 * Crea un nuevo plan de suscripción (Story 9.2 AC #2b).
 */
export function createAdminPricingPlan(
  data: AdminPricingPlanCreateRequest,
): Promise<AdminPricingPlan> {
  return apiFetch<AdminPricingPlan>('/api/admin/pricing/plans', {
    method: 'POST',
    body: data,
  });
}

/**
 * Consulta la configuración de días de gracia (Story 9.2 AC #2c).
 */
export function getAdminPricingSettings(): Promise<AdminPricingSettingsResponse> {
  return apiFetch<AdminPricingSettingsResponse>('/api/admin/pricing/settings');
}

/**
 * Actualiza los días de gracia (Story 9.2 AC #2c).
 */
export function updateAdminPricingSettings(
  data: AdminPricingSettingsUpdateRequest,
): Promise<AdminPricingSettingsResponse> {
  return apiFetch<AdminPricingSettingsResponse>('/api/admin/pricing/settings', {
    method: 'PUT',
    body: data,
  });
}

/**
 * Crea o actualiza una tarifa mensual (Story 9.2 AC #3).
 */
export function setAdminPricingRate(
  data: AdminPricingRateCreateRequest,
): Promise<AdminPricingRate> {
  return apiFetch<AdminPricingRate>('/api/admin/pricing/rates', {
    method: 'POST',
    body: data,
  });
}

/**
 * Cancela una tarifa programada antes de entrar en vigencia (Story 9.2 AC #4).
 */
export function deleteAdminPricingRate(id: string): Promise<void> {
  return apiFetch<void>(`/api/admin/pricing/rates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * Consulta el historial de tarifas de un segmento (Story 9.2 AC #5).
 */
export function getAdminPricingRateHistory(
  incomeSource: string,
  taxpayerType: string,
): Promise<AdminPricingRateHistoryItem[]> {
  const params = new URLSearchParams({
    income_source: incomeSource,
    taxpayer_type: taxpayerType,
  });
  return apiFetch<AdminPricingRateHistoryItem[]>(
    `/api/admin/pricing/rates/history?${params.toString()}`,
  );
}

/**
 * Consulta la cotización para un segmento y plan (Story 9.2 AC #6).
 */
export function getAdminPricingQuote(params: {
  income_source: string;
  taxpayer_type?: string;
  person_type?: string;
  plan: string;
}): Promise<AdminPricingQuote> {
  const qs = new URLSearchParams();
  qs.set('income_source', params.income_source);
  if (params.taxpayer_type) qs.set('taxpayer_type', params.taxpayer_type);
  if (params.person_type) qs.set('person_type', params.person_type);
  qs.set('plan', params.plan);
  return apiFetch<AdminPricingQuote>(`/api/admin/pricing/quote?${qs.toString()}`);
}

/**
 * Actualiza la suscripción (precio o plan) de un cliente (Story 9.2 AC #8).
 */
export function updateAdminSubscription(
  businessId: string,
  data: AdminSubscriptionUpdateRequest,
): Promise<ClientDetailResponse> {
  return apiFetch<ClientDetailResponse>(
    `/api/admin/clients/${encodeURIComponent(businessId)}/subscription`,
    {
      method: 'PATCH',
      body: data,
    },
  );
}


