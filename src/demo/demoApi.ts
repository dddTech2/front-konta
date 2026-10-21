import { ApiError, type RequestOptions } from '../api/client';
import type {
  InvoicesListResponse,
  SaleCreatePayload,
  SaleListItem,
  SaleListResponse,
  SaleResponse,
  SaleVoidResponse,
} from '../api/types';
import {
  buildDemoCalendar,
  buildDemoDashboard,
  buildDemoDocuments,
  buildDemoIncomeSummary,
  buildDemoInitialSales,
  buildDemoInvoices,
  buildDemoIva,
  DEMO_PROFILES,
  type DemoProfileId,
} from './demoData';
import { recentMonths } from '../format';

function getTodayBogota(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '10';
  const d = parts.find((p) => p.type === 'day')?.value ?? '20';
  return `${y}-${m}-${d}`;
}

// Almacén en memoria por perfil para ventas registradas/anuladas durante la sesión de demo
let salesStore: Record<DemoProfileId, SaleListItem[]> = {
  'con-iva-fe': [],
  'sin-iva-fe': [],
  'sin-iva-ventas': buildDemoInitialSales('sin-iva-ventas'),
  'sin-iva-mixto': buildDemoInitialSales('sin-iva-mixto'),
};

/** Restaura el almacén en memoria a los valores iniciales (útil para pruebas). */
export function resetDemoState(): void {
  salesStore = {
    'con-iva-fe': [],
    'sin-iva-fe': [],
    'sin-iva-ventas': buildDemoInitialSales('sin-iva-ventas'),
    'sin-iva-mixto': buildDemoInitialSales('sin-iva-mixto'),
  };
}

/** Extrae el DemoProfileId a partir de un business_id con prefijo 'demo-' */
function parseProfileId(businessId: string): DemoProfileId {
  const rawId = businessId.replace(/^demo-/, '') as DemoProfileId;
  if (rawId in DEMO_PROFILES) {
    return rawId;
  }
  return 'con-iva-fe';
}

/**
 * Resuelve peticiones de demostración simuladas en memoria sin llamar a fetch ni a la red (Story 10.7 AC #4, #5).
 * Se invoca desde apiFetch cuando la ruta coincide con /api/<recurso>/demo-…
 */
export async function resolveDemo<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, 'http://konta.local');
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // Segmentos: ['', 'api', resource, businessId, ...rest]
  const segments = pathname.split('/').filter(Boolean);
  const resource = segments[1];
  const businessId = segments[2];
  const rest = segments.slice(3);

  const profileId = parseProfileId(businessId);
  const currentMonth = recentMonths(1)[0];

  switch (resource) {
    case 'dashboard': {
      return buildDemoDashboard(profileId) as unknown as T;
    }

    case 'calendar': {
      return buildDemoCalendar(profileId) as unknown as T;
    }

    case 'iva': {
      return buildDemoIva(profileId) as unknown as T;
    }

    case 'invoices': {
      const allInvoices = buildDemoInvoices(profileId);
      const groupType = searchParams.get('group_type');
      const period = searchParams.get('period');
      const search = searchParams.get('search')?.trim().toLowerCase();
      const offset = Number(searchParams.get('offset') ?? 0);
      const limit = Number(searchParams.get('limit') ?? 50);

      let filtered = allInvoices;
      if (groupType) {
        filtered = filtered.filter((i) => i.group_type.toLowerCase() === groupType.toLowerCase());
      }
      if (period) {
        filtered = filtered.filter((i) => i.issue_date.startsWith(period));
      }
      if (search) {
        filtered = filtered.filter(
          (i) =>
            i.cliente.toLowerCase().includes(search) ||
            i.num.toLowerCase().includes(search) ||
            i.cufe.toLowerCase().includes(search) ||
            i.nit_contraparte.includes(search),
        );
      }

      const total_count = filtered.length;
      const page = filtered.slice(offset, offset + limit);

      const response: InvoicesListResponse = {
        total_count,
        invoices: page,
        limit,
        offset,
      };
      return response as unknown as T;
    }

    case 'income-summary': {
      const month = searchParams.get('month') || currentMonth;
      return buildDemoIncomeSummary(profileId, month) as unknown as T;
    }

    case 'sales': {
      const method = (options.method ?? 'GET').toUpperCase();

      // POST /api/sales/demo-.../:saleId/void
      if (method === 'POST' && rest[1] === 'void') {
        const saleId = rest[0];
        salesStore[profileId] = salesStore[profileId].filter((s) => s.id !== saleId);
        const voidResponse: SaleVoidResponse = {
          id: saleId,
          voided_at: new Date().toISOString(),
        };
        return voidResponse as unknown as T;
      }

      // POST /api/sales/demo-... (Registrar venta)
      if (method === 'POST') {
        const payload = (options.body ?? {}) as SaleCreatePayload;
        const totalNum = Number(payload.total_amount);
        const safeTotal = Number.isFinite(totalNum) ? totalNum.toFixed(2) : '0.00';
        const todayIso = getTodayBogota();

        const newSale: SaleListItem = {
          id: `sale-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          total_amount: safeTotal,
          description: payload.description?.trim() || null,
          recorded_via: 'WEB',
          sale_date: todayIso,
          created_at: new Date().toISOString(),
        };

        if (!salesStore[profileId]) {
          salesStore[profileId] = [];
        }
        salesStore[profileId].unshift(newSale);

        const saleResponse: SaleResponse = {
          id: newSale.id,
          total_amount: newSale.total_amount,
          description: newSale.description,
          recorded_via: newSale.recorded_via,
          created_at: newSale.created_at,
        };
        return saleResponse as unknown as T;
      }

      // GET /api/sales/demo-...
      const month = searchParams.get('month') || currentMonth;
      const salesForProfile = salesStore[profileId] ?? [];
      const salesForMonth = salesForProfile.filter((s) => s.sale_date.startsWith(month));

      const listResponse: SaleListResponse = {
        month,
        sales: salesForMonth,
      };
      return listResponse as unknown as T;
    }

    case 'documents': {
      // POST /api/documents/demo-.../:docId/link
      if (rest[1] === 'link') {
        throw new ApiError('http', 400, 'En la demostración los documentos no se abren');
      }

      // GET /api/documents/demo-...
      return buildDemoDocuments(profileId) as unknown as T;
    }

    default: {
      throw new ApiError('http', 404, `Recurso de demostración no encontrado: ${resource}`);
    }
  }
}
