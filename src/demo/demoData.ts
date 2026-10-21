import type {
  AdminPackage,
  CalendarResponse,
  DashboardResponse,
  DocumentsResponse,
  IncomeSummaryResponse,
  InvoiceDetailItem,
  IvaDetailResponse,
  SaleListItem,
} from '../api/types';
import type { Me } from '../api/client';
import { recentMonths } from '../format';

export type DemoProfileId = 'con-iva-fe' | 'sin-iva-fe' | 'sin-iva-ventas' | 'sin-iva-mixto';

export interface DemoTelegramCommand {
  command: string;
  description: string;
}

export interface DemoProfileMeta {
  id: DemoProfileId;
  businessId: string;
  package: AdminPackage;
  incomeSource: 'DIAN' | 'MANUAL_SALES' | 'MIXED';
  name: string;
  legalName: string;
  nit: string;
  dv: string;
  economicActivity: string;
  taxpayerType: string;
  me: Me;
  lineText: string;
  includes: string[];
  telegramCommands: DemoTelegramCommand[];
}

export const DEMO_PROFILES: Record<DemoProfileId, DemoProfileMeta> = {
  'con-iva-fe': {
    id: 'con-iva-fe',
    businessId: 'demo-con-iva-fe',
    package: 'CON_IVA',
    incomeSource: 'DIAN',
    name: 'Distribuciones La Ceiba S.A.S.',
    legalName: 'Distribuciones La Ceiba S.A.S.',
    nit: '901234567',
    dv: '1',
    economicActivity: 'Comercio al por mayor de alimentos',
    taxpayerType: 'PERSONA_JURIDICA',
    me: {
      business_id: 'demo-con-iva-fe',
      is_provisioned: true,
      is_blocked: false,
      subscription_status: 'ACTIVA',
      has_warning_banner: false,
      redirect_url: null,
      package: 'CON_IVA',
      income_source: 'DIAN',
      vat_responsible: true,
      role: 'CLIENT',
    },
    lineText: 'Para negocios que declaran IVA: siempre facturan electrónicamente.',
    includes: [
      'Descarga automática de facturas electrónicas desde la DIAN',
      'IVA del bimestre, generado, descontable y saldo',
      'Calendario de vencimientos por NIT con alertas por Telegram',
      'Documentos del negocio (declaraciones, RUT, estados)',
      'Acceso al panel con enlace desde Telegram',
    ],
    telegramCommands: [
      { command: '/resumen', description: 'Facturación del mes, variación e IVA generado, descontable y saldo' },
      { command: '/facturas', description: 'Últimas facturas electrónicas emitidas' },
      { command: '/vencimientos', description: 'Próximas obligaciones tributarias según tu NIT' },
      { command: '/dashboard', description: 'Enlace directo para entrar al panel web' },
      { command: '/ayuda', description: 'Menú con los comandos disponibles' },
    ],
  },
  'sin-iva-fe': {
    id: 'sin-iva-fe',
    businessId: 'demo-sin-iva-fe',
    package: 'SIN_IVA',
    incomeSource: 'DIAN',
    name: 'Estudio Creativo Lumen',
    legalName: 'Estudio Creativo Lumen S.A.S.',
    nit: '900987654',
    dv: '3',
    economicActivity: 'Servicios de diseño, publicidad y medios digitales',
    taxpayerType: 'PERSONA_JURIDICA',
    me: {
      business_id: 'demo-sin-iva-fe',
      is_provisioned: true,
      is_blocked: false,
      subscription_status: 'ACTIVA',
      has_warning_banner: false,
      redirect_url: null,
      package: 'SIN_IVA',
      income_source: 'DIAN',
      vat_responsible: false,
      role: 'CLIENT',
    },
    lineText: 'Para negocios que no declaran IVA y solo tienen facturación electrónica.',
    includes: [
      'Descarga automática de facturas electrónicas desde la DIAN',
      'Calendario de vencimientos por NIT con alertas por Telegram',
      'Documentos del negocio (declaraciones, RUT, estados)',
      'Acceso al panel con enlace desde Telegram',
    ],
    telegramCommands: [
      { command: '/resumen', description: 'Facturación del mes y variación frente al mes anterior' },
      { command: '/facturas', description: 'Últimas facturas electrónicas emitidas' },
      { command: '/vencimientos', description: 'Próximas obligaciones tributarias según tu NIT' },
      { command: '/dashboard', description: 'Enlace directo para entrar al panel web' },
      { command: '/ayuda', description: 'Menú con los comandos disponibles' },
    ],
  },
  'sin-iva-ventas': {
    id: 'sin-iva-ventas',
    businessId: 'demo-sin-iva-ventas',
    package: 'SIN_IVA',
    incomeSource: 'MANUAL_SALES',
    name: 'Panadería Doña Rosa',
    legalName: 'Panadería y Pastelería Doña Rosa S.A.S.',
    nit: '800555123',
    dv: '8',
    economicActivity: 'Elaboración y venta de productos de panadería y cafetería',
    taxpayerType: 'PERSONA_JURIDICA',
    me: {
      business_id: 'demo-sin-iva-ventas',
      is_provisioned: true,
      is_blocked: false,
      subscription_status: 'ACTIVA',
      has_warning_banner: false,
      redirect_url: null,
      package: 'SIN_IVA',
      income_source: 'MANUAL_SALES',
      vat_responsible: false,
      role: 'CLIENT',
    },
    lineText: 'Para negocios que no declaran IVA y llevan sus cuentas con ventas del día a día.',
    includes: [
      'Registro de ventas por la web y por Telegram con ingresos, egresos y utilidad',
      'Documentos del negocio (declaraciones, RUT, estados)',
      'Acceso al panel con enlace desde Telegram',
    ],
    telegramCommands: [
      { command: '/resumen', description: 'Ingresos, egresos y utilidad del mes' },
      { command: '/venta', description: 'Registra una venta: valor y descripción opcional' },
      { command: '/mis_ventas', description: 'Últimas ventas registradas' },
      { command: '/anular_venta', description: 'Anula una venta registrada por error' },
      { command: '/dashboard', description: 'Enlace directo para entrar al panel web' },
      { command: '/ayuda', description: 'Menú con los comandos disponibles' },
    ],
  },
  'sin-iva-mixto': {
    id: 'sin-iva-mixto',
    businessId: 'demo-sin-iva-mixto',
    package: 'SIN_IVA',
    incomeSource: 'MIXED',
    name: 'Café y Granos El Mirador',
    legalName: 'Café y Granos El Mirador S.A.S.',
    nit: '901444888',
    dv: '5',
    economicActivity: 'Comercio al por mayor y detal de café especial y alimentos',
    taxpayerType: 'PERSONA_JURIDICA',
    me: {
      business_id: 'demo-sin-iva-mixto',
      is_provisioned: true,
      is_blocked: false,
      subscription_status: 'ACTIVA',
      has_warning_banner: false,
      redirect_url: null,
      package: 'SIN_IVA',
      income_source: 'MIXED',
      vat_responsible: false,
      role: 'CLIENT',
    },
    lineText: 'Para negocios que facturan electrónicamente y además registran ventas manuales.',
    includes: [
      'Descarga automática de facturas electrónicas desde la DIAN',
      'Registro de ventas por la web y por Telegram con ingresos, egresos y utilidad',
      'Facturado y ventas lado a lado',
      'Calendario de vencimientos por NIT con alertas por Telegram',
      'Documentos del negocio (declaraciones, RUT, estados)',
      'Acceso al panel con enlace desde Telegram',
    ],
    telegramCommands: [
      { command: '/resumen', description: 'Facturado y ventas del mes por separado, y egresos' },
      { command: '/facturas', description: 'Últimas facturas electrónicas emitidas' },
      { command: '/vencimientos', description: 'Próximas obligaciones tributarias según tu NIT' },
      { command: '/venta', description: 'Registra una venta: valor y descripción opcional' },
      { command: '/mis_ventas', description: 'Últimas ventas registradas' },
      { command: '/anular_venta', description: 'Anula una venta registrada por error' },
      { command: '/dashboard', description: 'Enlace directo para entrar al panel web' },
      { command: '/ayuda', description: 'Menú con los comandos disponibles' },
    ],
  },
};

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getShortMonth(ym: string): string {
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const idx = Number(parts[1]) - 1;
  return SHORT_MONTHS[idx] ?? ym;
}

export function buildDemoDashboard(profileId: DemoProfileId): DashboardResponse {
  const profile = DEMO_PROFILES[profileId];
  const monthsDesc = recentMonths(6);
  const currentMonth = monthsDesc[0];
  const monthsAsc = [...monthsDesc].reverse();

  const isConIva = profileId === 'con-iva-fe';

  // Barras mensuales distintas de cero en orden cronológico
  const totalsByProfile: Record<DemoProfileId, number[]> = {
    'con-iva-fe': [14200000, 15800000, 16900000, 18500000, 17800000, 20400000],
    'sin-iva-fe': [8900000, 9400000, 11200000, 10800000, 12500000, 13800000],
    'sin-iva-ventas': [6200000, 6800000, 7500000, 8100000, 8900000, 9800000],
    'sin-iva-mixto': [11000000, 12500000, 13800000, 14500000, 15600000, 17200000],
  };

  const totals = totalsByProfile[profileId];
  const historico = monthsAsc.map((m, idx) => ({
    mes: getShortMonth(m),
    period_year_month: m,
    total: totals[idx] ?? 12000000,
  }));

  const currentTotal = totals[totals.length - 1];
  const prevTotal = totals[totals.length - 2];
  const variacion = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 8;

  // Facturas recientes
  const facturasRecientes = [
    {
      id: `fe-${profileId}-1`,
      num: 'FE-104',
      fecha: `18 ${getShortMonth(currentMonth).toLowerCase()}`,
      cliente: 'Inversiones Caribe S.A.S.',
      valor: isConIva ? 4850000 : 3800000,
      iva: isConIva ? 921500 : 0,
      tipo: 'Emitido',
    },
    {
      id: `fe-${profileId}-2`,
      num: 'FE-103',
      fecha: `15 ${getShortMonth(currentMonth).toLowerCase()}`,
      cliente: 'Logística y Envíos Andinos Ltda.',
      valor: isConIva ? 2900000 : 2500000,
      iva: isConIva ? 551000 : 0,
      tipo: 'Emitido',
    },
    {
      id: `fe-${profileId}-3`,
      num: 'PR-890',
      fecha: `12 ${getShortMonth(currentMonth).toLowerCase()}`,
      cliente: 'Papelería y Suministros del Valle',
      valor: 850000,
      iva: isConIva ? 161500 : 0,
      tipo: 'Recibido',
    },
    {
      id: `fe-${profileId}-4`,
      num: 'FE-102',
      fecha: `08 ${getShortMonth(currentMonth).toLowerCase()}`,
      cliente: 'Comercializadora San Mateo S.A.',
      valor: isConIva ? 6200000 : 4900000,
      iva: isConIva ? 1178000 : 0,
      tipo: 'Emitido',
    },
    {
      id: `fe-${profileId}-5`,
      num: 'FE-101',
      fecha: `03 ${getShortMonth(currentMonth).toLowerCase()}`,
      cliente: 'Consultoría Soluciones Digitales',
      valor: isConIva ? 3500000 : 2600000,
      iva: isConIva ? 665000 : 0,
      tipo: 'Emitido',
    },
  ];

  const alertDays = isConIva ? 6 : 8;
  const alertaProximoVencimiento = {
    dias: alertDays,
    etiqueta: isConIva ? `Bimestre ${currentMonth}` : `Periodo ${currentMonth}`,
    limite: `24 ${getShortMonth(currentMonth).toLowerCase()} ${currentMonth.slice(0, 4)}`,
    estado: 'proximo',
    tax_type: isConIva ? 'IVA_BIMESTRAL' : 'RETEFUENTE',
  };

  return {
    business: {
      id: profile.businessId,
      commercial_name: profile.name,
      legal_name: profile.legalName,
      nit: profile.nit,
      dv: profile.dv,
      economic_activity: profile.economicActivity,
      taxpayer_type: profile.taxpayerType,
    },
    resumen: {
      total: currentTotal,
      ivaAcumulado: isConIva ? Math.round(currentTotal * 0.19) : 0,
      numFacturas: 24,
      variacion,
      periodo: currentMonth,
    },
    historico,
    facturasRecientes,
    alertaProximoVencimiento,
    suscripcion: {
      estado: 'ACTIVA',
      plan: 'TRIMESTRAL',
      has_warning_banner: false,
      days_left_in_grace: null,
      cutoff_date: null,
      grace_period_end: null,
    },
    shows_iva: isConIva,
  };
}

export function buildDemoCalendar(profileId: DemoProfileId): CalendarResponse {
  const isConIva = profileId === 'con-iva-fe';
  const currentMonth = recentMonths(1)[0];
  const year = currentMonth.slice(0, 4);
  const monthNum = Number(currentMonth.slice(5, 7));

  const obligacionIva = isConIva
    ? [
        {
          tax_type: 'IVA_BIMESTRAL',
          etiqueta: `IVA Bimestre ${currentMonth}`,
          fecha_limite: `${year}-${String(monthNum).padStart(2, '0')}-24`,
          estado: 'proximo',
          dias: 6,
        },
      ]
    : [];

  return {
    obligaciones: [
      ...obligacionIva,
      {
        tax_type: 'RETEFUENTE',
        etiqueta: `Retención en la fuente · ${currentMonth}`,
        fecha_limite: `${year}-${String(monthNum).padStart(2, '0')}-28`,
        estado: 'aldia',
        dias: 10,
      },
      {
        tax_type: 'RENTA_PERSONAS_JURIDICAS',
        etiqueta: `Renta año gravable ${Number(year) - 1} · Cuota 2`,
        fecha_limite: `${year}-11-18`,
        estado: 'aldia',
        dias: 42,
      },
    ],
  };
}

export function buildDemoIva(profileId: DemoProfileId): IvaDetailResponse {
  const profile = DEMO_PROFILES[profileId];
  const monthsDesc = recentMonths(4);
  const currentMonth = monthsDesc[0];
  const prevMonth = monthsDesc[2] ?? monthsDesc[1];

  return {
    business_id: profile.businessId,
    nit: profile.nit,
    nombre: profile.name,
    periodos: [
      {
        period_key: currentMonth,
        etiqueta: `Jul – Ago ${currentMonth.slice(0, 4)}`,
        generado: 4560000,
        descontable: 1824000,
        saldo: 2736000,
        pct: 0.4,
        estado: 'en_curso',
        limite: `24 ${getShortMonth(currentMonth).toLowerCase()} ${currentMonth.slice(0, 4)}`,
        dias: 6,
        facturas: [
          {
            fecha: `18 ${getShortMonth(currentMonth).toLowerCase()}`,
            cliente: 'Inversiones Caribe S.A.S.',
            valor: 4850000,
            iva: 921500,
            tipo: 'Emitido',
          },
          {
            fecha: `15 ${getShortMonth(currentMonth).toLowerCase()}`,
            cliente: 'Logística y Envíos Andinos Ltda.',
            valor: 2900000,
            iva: 551000,
            tipo: 'Emitido',
          },
          {
            fecha: `12 ${getShortMonth(currentMonth).toLowerCase()}`,
            cliente: 'Papelería y Suministros del Valle',
            valor: 850000,
            iva: 161500,
            tipo: 'Recibido',
          },
          {
            fecha: `08 ${getShortMonth(currentMonth).toLowerCase()}`,
            cliente: 'Comercializadora San Mateo S.A.',
            valor: 6200000,
            iva: 1178000,
            tipo: 'Emitido',
          },
        ],
      },
      {
        period_key: prevMonth,
        etiqueta: `May – Jun ${prevMonth.slice(0, 4)}`,
        generado: 4120000,
        descontable: 2100000,
        saldo: 2020000,
        pct: 0.51,
        estado: 'presentado',
        limite: null,
        dias: null,
        facturas: [
          {
            fecha: `28 ${getShortMonth(prevMonth).toLowerCase()}`,
            cliente: 'Distribuidora del Oriente',
            valor: 5400000,
            iva: 1026000,
            tipo: 'Emitido',
          },
        ],
      },
    ],
  };
}

export function buildDemoInvoices(profileId: DemoProfileId): InvoiceDetailItem[] {
  const isConIva = profileId === 'con-iva-fe';
  const monthsDesc = recentMonths(4);
  const m0 = monthsDesc[0];
  const m1 = monthsDesc[1];
  const m2 = monthsDesc[2];

  return [
    {
      id: `inv-${profileId}-1`,
      cufe: 'cufe-demo-9001-a',
      num: 'FE-105',
      issue_date: `${m0}-18T10:30:00`,
      fecha_corta: `18 ${getShortMonth(m0).toLowerCase()}`,
      cliente: 'Inversiones Caribe S.A.S.',
      nit_contraparte: '900888111',
      valor: isConIva ? 4850000 : 3800000,
      iva: isConIva ? 921500 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Emitido',
    },
    {
      id: `inv-${profileId}-2`,
      cufe: 'cufe-demo-9001-b',
      num: 'FE-104',
      issue_date: `${m0}-15T14:20:00`,
      fecha_corta: `15 ${getShortMonth(m0).toLowerCase()}`,
      cliente: 'Logística y Envíos Andinos Ltda.',
      nit_contraparte: '900777222',
      valor: isConIva ? 2900000 : 2500000,
      iva: isConIva ? 551000 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Emitido',
    },
    {
      id: `inv-${profileId}-3`,
      cufe: 'cufe-demo-9001-c',
      num: 'FAC-4421',
      issue_date: `${m0}-12T09:00:00`,
      fecha_corta: `12 ${getShortMonth(m0).toLowerCase()}`,
      cliente: 'Papelería y Suministros del Valle',
      nit_contraparte: '890123987',
      valor: 850000,
      iva: isConIva ? 161500 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Recibido',
    },
    {
      id: `inv-${profileId}-4`,
      cufe: 'cufe-demo-9001-d',
      num: 'FE-103',
      issue_date: `${m0}-08T16:45:00`,
      fecha_corta: `08 ${getShortMonth(m0).toLowerCase()}`,
      cliente: 'Comercializadora San Mateo S.A.',
      nit_contraparte: '901333444',
      valor: isConIva ? 6200000 : 4900000,
      iva: isConIva ? 1178000 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Emitido',
    },
    {
      id: `inv-${profileId}-5`,
      cufe: 'cufe-demo-9001-e',
      num: 'FAC-8812',
      issue_date: `${m0}-05T11:10:00`,
      fecha_corta: `05 ${getShortMonth(m0).toLowerCase()}`,
      cliente: 'Arrendamientos y Bodegas Urbanas',
      nit_contraparte: '860001234',
      valor: 2100000,
      iva: isConIva ? 399000 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Recibido',
    },
    {
      id: `inv-${profileId}-6`,
      cufe: 'cufe-demo-9001-f',
      num: 'FE-102',
      issue_date: `${m1}-26T15:00:00`,
      fecha_corta: `26 ${getShortMonth(m1).toLowerCase()}`,
      cliente: 'Consultoría Soluciones Digitales',
      nit_contraparte: '900222555',
      valor: isConIva ? 3500000 : 2600000,
      iva: isConIva ? 665000 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Emitido',
    },
    {
      id: `inv-${profileId}-7`,
      cufe: 'cufe-demo-9001-g',
      num: 'FE-101',
      issue_date: `${m1}-14T11:30:00`,
      fecha_corta: `14 ${getShortMonth(m1).toLowerCase()}`,
      cliente: 'Distribuidora del Oriente',
      nit_contraparte: '900444999',
      valor: isConIva ? 5400000 : 4200000,
      iva: isConIva ? 1026000 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Emitido',
    },
    {
      id: `inv-${profileId}-8`,
      cufe: 'cufe-demo-9001-h',
      num: 'FAC-3100',
      issue_date: `${m1}-07T08:15:00`,
      fecha_corta: `07 ${getShortMonth(m1).toLowerCase()}`,
      cliente: 'Energía y Servicios del Centro',
      nit_contraparte: '860555666',
      valor: 1350000,
      iva: isConIva ? 256500 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Recibido',
    },
    {
      id: `inv-${profileId}-9`,
      cufe: 'cufe-demo-9001-i',
      num: 'FE-100',
      issue_date: `${m2}-22T17:00:00`,
      fecha_corta: `22 ${getShortMonth(m2).toLowerCase()}`,
      cliente: 'Hoteles y Turismo de Colombia',
      nit_contraparte: '900999000',
      valor: isConIva ? 4100000 : 3300000,
      iva: isConIva ? 779000 : 0,
      tipo_documento: 'Factura electrónica',
      group_type: 'Emitido',
    },
  ];
}

export function buildDemoIncomeSummary(profileId: DemoProfileId, requestedMonth: string): IncomeSummaryResponse {
  const monthsDesc = recentMonths(6);
  const monthsAsc = [...monthsDesc].reverse();
  const isMixed = profileId === 'sin-iva-mixto';

  const month = requestedMonth || monthsDesc[0];

  if (isMixed) {
    // Perfil mixto: emitido y ventas por separado, ingresos y utilidad en null (Story 10.5, Q-10b)
    const emitidoValues = [11000000, 12500000, 13800000, 14500000, 15600000, 17200000];
    const ventasValues = [5800000, 6200000, 6900000, 7400000, 7900000, 8600000];
    const egresosValues = [4200000, 4500000, 4800000, 5100000, 5200000, 5500000];

    const historial = monthsAsc.map((m, idx) => ({
      month: m,
      ingresos: null,
      egresos: `${egresosValues[idx]}.00`,
      utilidad: null,
      emitido: `${emitidoValues[idx]}.00`,
      ventas: `${ventasValues[idx]}.00`,
    }));

    const currentIdx = monthsAsc.indexOf(month);
    const safeIdx = currentIdx >= 0 ? currentIdx : monthsAsc.length - 1;
    const emitido = emitidoValues[safeIdx];
    const ventas = ventasValues[safeIdx];
    const egresos = egresosValues[safeIdx];

    return {
      month,
      ingresos: null,
      egresos: `${egresos}.00`,
      utilidad: null,
      historial,
      emitido: `${emitido}.00`,
      ventas: `${ventas}.00`,
      diferencia: `${Math.abs(emitido - ventas)}.00`,
      emitido_count: 18,
      ventas_count: 32,
      clientes_count: 14,
    };
  }

  // Ventas manuales
  const ingresosValues = [6200000, 6800000, 7500000, 8100000, 8900000, 9800000];
  const egresosValues = [2400000, 2600000, 2900000, 3100000, 3300000, 3600000];

  const historial = monthsAsc.map((m, idx) => {
    const ing = ingresosValues[idx];
    const egr = egresosValues[idx];
    return {
      month: m,
      ingresos: `${ing}.00`,
      egresos: `${egr}.00`,
      utilidad: `${ing - egr}.00`,
    };
  });

  const currentIdx = monthsAsc.indexOf(month);
  const safeIdx = currentIdx >= 0 ? currentIdx : monthsAsc.length - 1;
  const ing = ingresosValues[safeIdx];
  const egr = egresosValues[safeIdx];

  return {
    month,
    ingresos: `${ing}.00`,
    egresos: `${egr}.00`,
    utilidad: `${ing - egr}.00`,
    historial,
  };
}

export function buildDemoInitialSales(profileId: DemoProfileId): SaleListItem[] {
  const currentMonth = recentMonths(1)[0];
  const year = currentMonth.slice(0, 4);
  const monthNum = currentMonth.slice(5, 7);

  if (profileId === 'sin-iva-ventas') {
    return [
      {
        id: 'sale-demo-1',
        total_amount: '185000.00',
        description: '3 tortas artesanales y panes especiales',
        recorded_via: 'WEB',
        sale_date: `${year}-${monthNum}-18`,
        created_at: `${year}-${monthNum}-18T15:30:00`,
      },
      {
        id: 'sale-demo-2',
        total_amount: '94500.00',
        description: 'Pedido desayunos y repostería',
        recorded_via: 'TELEGRAM',
        sale_date: `${year}-${monthNum}-16`,
        created_at: `${year}-${monthNum}-16T09:15:00`,
      },
      {
        id: 'sale-demo-3',
        total_amount: '62000.00',
        description: 'Venta de mostrador',
        recorded_via: 'WEB',
        sale_date: `${year}-${monthNum}-12`,
        created_at: `${year}-${monthNum}-12T17:45:00`,
      },
    ];
  }

  if (profileId === 'sin-iva-mixto') {
    return [
      {
        id: 'sale-demo-m1',
        total_amount: '280000.00',
        description: '4 libras café Geisha y filtrados',
        recorded_via: 'WEB',
        sale_date: `${year}-${monthNum}-17`,
        created_at: `${year}-${monthNum}-17T14:00:00`,
      },
      {
        id: 'sale-demo-m2',
        total_amount: '135000.00',
        description: 'Bebidas y pastelería tarde',
        recorded_via: 'TELEGRAM',
        sale_date: `${year}-${monthNum}-15`,
        created_at: `${year}-${monthNum}-15T16:30:00`,
      },
    ];
  }

  return [];
}

export function buildDemoDocuments(profileId: DemoProfileId): DocumentsResponse {
  const profile = DEMO_PROFILES[profileId];
  return {
    documents: [
      {
        id: `doc-${profileId}-1`,
        doc_type: 'RUT',
        description: null,
        original_filename: `RUT_${profile.nit}_2026.pdf`,
        content_type: 'application/pdf',
        size_bytes: 245760, // 240 KB
        created_at: '2026-09-15T10:00:00',
      },
      {
        id: `doc-${profileId}-2`,
        doc_type: 'CAMARA_COMERCIO',
        description: null,
        original_filename: 'Certificado_Existencia_y_Representacion.pdf',
        content_type: 'application/pdf',
        size_bytes: 1153433, // 1.1 MB
        created_at: '2026-08-20T14:30:00',
      },
      {
        id: `doc-${profileId}-3`,
        doc_type: 'CEDULA_REPRESENTANTE',
        description: 'Cédula de ciudadanía representante legal',
        original_filename: 'Cedula_Representante_Legal.pdf',
        content_type: 'application/pdf',
        size_bytes: 524288, // 512 KB
        created_at: '2026-08-01T09:15:00',
      },
      {
        id: `doc-${profileId}-4`,
        doc_type: 'CERTIFICACION_BANCARIA',
        description: 'Certificación cuenta corriente Bancolombia',
        original_filename: 'Certificacion_Bancaria_Bancolombia.pdf',
        content_type: 'application/pdf',
        size_bytes: 184320, // 180 KB
        created_at: '2026-07-10T16:00:00',
      },
    ],
  };
}
