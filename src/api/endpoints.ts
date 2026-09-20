import { apiFetch } from './client';
import type {
  CalendarResponse,
  DashboardResponse,
  GroupType,
  IncomeSummaryResponse,
  InvoicesListResponse,
  IvaDetailResponse,
  SaleCreatePayload,
  SaleResponse,
} from './types';

/** Endpoints de datos del negocio activo. El manejo de 401/403/red vive solo en `apiFetch` (ADR-005). */
const businessPath = (resource: string, businessId: string) => `/api/${resource}/${encodeURIComponent(businessId)}`;

export const getDashboard = (businessId: string): Promise<DashboardResponse> =>
  apiFetch<DashboardResponse>(businessPath('dashboard', businessId));

export const getIva = (businessId: string): Promise<IvaDetailResponse> =>
  apiFetch<IvaDetailResponse>(businessPath('iva', businessId));

export const getCalendar = (businessId: string): Promise<CalendarResponse> =>
  apiFetch<CalendarResponse>(businessPath('calendar', businessId));

export const INVOICES_PAGE_SIZE = 50;

export interface InvoiceQuery {
  group?: GroupType;
  /** Mes `YYYY-MM`. */
  period?: string;
  search?: string;
  offset?: number;
}

/** Filtros y búsqueda se resuelven en el servidor: el cliente solo arma los parámetros. */
export function getInvoices(businessId: string, query: InvoiceQuery = {}): Promise<InvoicesListResponse> {
  const params = new URLSearchParams();
  if (query.group) params.set('group_type', query.group);
  if (query.period) params.set('period', query.period);
  const search = query.search?.trim();
  if (search) params.set('search', search);
  params.set('limit', String(INVOICES_PAGE_SIZE));
  params.set('offset', String(query.offset ?? 0));
  return apiFetch<InvoicesListResponse>(`${businessPath('invoices', businessId)}?${params.toString()}`);
}

/** Registra una venta del negocio activo (canal WEB). La validación del total es del servidor (422). */
export const registerSale = (businessId: string, payload: SaleCreatePayload): Promise<SaleResponse> =>
  apiFetch<SaleResponse>(businessPath('sales', businessId), { method: 'POST', body: payload });

/** Ingresos, egresos y utilidad del mes `YYYY-MM` de un negocio de ventas manuales (404 para DIAN). */
export const getIncomeSummary = (businessId: string, month: string): Promise<IncomeSummaryResponse> =>
  apiFetch<IncomeSummaryResponse>(`${businessPath('income-summary', businessId)}?month=${encodeURIComponent(month)}`);
