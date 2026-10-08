import { apiFetch } from './client';
import type {
  AdminClientsListResponse,
  AdminClientsQuery,
  AdminSummaryResponse,
  ClientDetailResponse,
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
