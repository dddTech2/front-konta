import { useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  deleteAdminDocument,
  generateAdminActivationLink,
  getAdminClientDetail,
  getAdminDocumentLink,
  getAdminDocuments,
  getAdminPricing,
  recordAdminPayment,
  releaseAdminTelegram,
  triggerAdminExtraction,
  updateAdminSubscription,
  updateAdminTaxProfile,
  updateClientProfile,
  uploadAdminDocument,
} from '../../api/adminEndpoints';
import type {
  AdminDocumentItem,
  AdminExtractionCreateResponse,
  AdminIncomeSource,
  AdminPackage,
  AdminPricingPlan,
  ClientDetailResponse,
} from '../../api/adminTypes';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../api/client';
import Dialog from '../../components/Dialog';
import { IconDocument, IconPaperclip } from '../../components/icons';
import { ResourceView } from '../../components/ScreenState';
import { clientWhatsappUrl } from '../../config';
import {
  DOCUMENT_TYPE_OPTIONS,
  docTitle,
  isAllowedDocumentType,
  MAX_DOCUMENT_SIZE_BYTES,
  openDocumentLink,
} from '../../documents';
import {
  fmtBogotaDate,
  fmtDeadline,
  fmtFileSize,
  fmtMoney,
  fmtNit,
  fmtPercent,
  fmtPeriod,
  jobStatus,
  recentMonths,
} from '../../format';
import { useResource } from '../../hooks/useResource';
import { incomeSourceLabel, isPlaceholderEmail, packageLabel, paymentMethodLabel, planLabel } from './labels';

function statusBadge(status?: string | null) {
  const s = (status || '').toUpperCase();
  let label = status || 'Sin estado';
  let colorClass = 'admin-badge-default';

  if (s === 'ACTIVO') {
    label = 'Activo';
    colorClass = 'admin-badge-activo';
  } else if (s === 'EN_MORA') {
    label = 'En mora';
    colorClass = 'admin-badge-mora';
  } else if (s === 'BLOQUEADO') {
    label = 'Bloqueado';
    colorClass = 'admin-badge-bloqueado';
  } else if (s === 'CANCELADO') {
    label = 'Cancelado';
    colorClass = 'admin-badge-cancelado';
  } else if (s === 'SIN_SUSCRIPCION') {
    label = 'Sin suscripción';
    colorClass = 'admin-badge-sin-sub';
  }

  return <span className={`admin-badge-status ${colorClass}`}>{label}</span>;
}

function tipoLabel(tipo?: string | null) {
  if (!tipo) return '—';
  return incomeSourceLabel(tipo);
}

function personaLabel(taxpayerType?: string | null) {
  if (taxpayerType === 'PERSONA_JURIDICA') return 'Persona Jurídica';
  if (taxpayerType === 'PERSONA_NATURAL') return 'Persona Natural';
  return taxpayerType || '—';
}

function friendlyExtractionError(errorCode?: string | null): { text: string; code?: string } {
  if (!errorCode) return { text: 'Sin errores' };
  switch (errorCode) {
    case 'DIAN_SLOW_RESPONSE':
      return { text: 'Respuesta lenta de la DIAN', code: errorCode };
    case 'DIAN_PORTAL_UNAVAILABLE':
      return { text: 'Portal de la DIAN no disponible', code: errorCode };
    case 'CERTIFICATE_EXPIRED':
      return { text: 'Certificado digital vencido', code: errorCode };
    case 'CREDENTIALS_INVALID':
      return { text: 'Credenciales de acceso inválidas', code: errorCode };
    default:
      return { text: 'Error en la descarga', code: errorCode };
  }
}

function computeSubPeriodPreview(
  currentSub: any,
  plansList: AdminPricingPlan[],
  mode: 'special' | 'plan' | 'current',
  specialMonthlyStr: string,
  specialDiscountStr: string,
  selectedPlanCode: string,
): { beforeFinal: number; afterFinal: number } {
  const beforeFinal = currentSub?.final_price ? Math.round(Number(currentSub.final_price)) : 0;
  if (!currentSub) return { beforeFinal: 0, afterFinal: 0 };

  const currentPlanObj = plansList.find((p) => p.code === currentSub.plan);
  const currentMonths = currentPlanObj
    ? currentPlanObj.months
    : currentSub.plan === 'SEMESTRAL'
      ? 6
      : currentSub.plan === 'ANUAL'
        ? 12
        : 3;

  let afterFinal = beforeFinal;

  if (mode === 'special') {
    const cleanM = specialMonthlyStr.replace(/\D/g, '');
    const monthly = cleanM ? Number(cleanM) : Number(currentSub.monthly_price || currentSub.current_rate_monthly || 0);
    const disc = specialDiscountStr !== '' ? Number(specialDiscountStr) : Number(currentSub.discount_rate || 0);
    const gross = monthly * currentMonths;
    const discountAmt = Math.round(gross * (disc / 100));
    afterFinal = gross - discountAmt;
  } else if (mode === 'plan') {
    const chosenPlan = plansList.find((p) => p.code === selectedPlanCode);
    const months = chosenPlan ? chosenPlan.months : currentMonths;
    const disc = chosenPlan ? Number(chosenPlan.discount_rate) : 0;
    const monthly = Number(currentSub.monthly_price || currentSub.current_rate_monthly || 0);
    const gross = monthly * months;
    const discountAmt = Math.round(gross * (disc / 100));
    afterFinal = gross - discountAmt;
  } else if (mode === 'current') {
    const monthly = Number(currentSub.current_rate_monthly || currentSub.monthly_price || 0);
    const chosenPlan = plansList.find((p) => p.code === currentSub.plan);
    const disc = chosenPlan ? Number(chosenPlan.discount_rate) : Number(currentSub.discount_rate || 0);
    const gross = monthly * currentMonths;
    const discountAmt = Math.round(gross * (disc / 100));
    afterFinal = gross - discountAmt;
  }

  return { beforeFinal, afterFinal };
}

export default function AdminFicha() {
  const { businessId = '' } = useParams<{ businessId: string }>();
  const location = useLocation();

  // Preserva los filtros y búsqueda de la pantalla de clientes si se navega desde allí
  const backSearch = (location.state as { from?: string } | null)?.from || '';
  const backUrl = `/admin/clientes${backSearch}`;

  const { state, retry } = useResource(
    () => getAdminClientDetail(businessId),
    [businessId],
  );

  // ---------- Estado: Registrar pago (AC #2) ----------
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'input' | 'confirm'>('input');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMismatch, setPaymentMismatch] = useState<{
    expected_amount: string;
    amount: string;
    difference: string;
  } | null>(null);
  const paymentSubmitting = useRef(false);

  // ---------- Estado: Cambiar precio o plan (Story 9.3 AC #7) ----------
  const [subChangeOpen, setSubChangeOpen] = useState(false);
  const [subChangeMode, setSubChangeMode] = useState<'special' | 'plan' | 'current'>('special');
  const [subSpecialMonthly, setSubSpecialMonthly] = useState('');
  const [subSpecialDiscount, setSubSpecialDiscount] = useState('');
  const [subSelectedPlan, setSubSelectedPlan] = useState('');
  const [subChangeReason, setSubChangeReason] = useState('');
  const [subChangeBusy, setSubChangeBusy] = useState(false);
  const [subChangeError, setSubChangeError] = useState<string | null>(null);
  const [pricingPlans, setPricingPlans] = useState<AdminPricingPlan[]>([]);
  const subChangeSubmitting = useRef(false);

  // ---------- Estado: Cambiar paquete o perfil (Story 10.6 AC #3) ----------
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileVatResponsible, setProfileVatResponsible] = useState(false);
  const [profileIncomeSource, setProfileIncomeSource] = useState<AdminIncomeSource>('DIAN');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileSubmitting = useRef(false);

  // ---------- Estado: Perfil tributario (AC #3) ----------
  const [taxProfileOpen, setTaxProfileOpen] = useState(false);
  const [ivaPeriodicity, setIvaPeriodicity] = useState<string>('');
  const [isWithholding, setIsWithholding] = useState(false);
  const [taxProfileBusy, setTaxProfileBusy] = useState(false);
  const [taxProfileError, setTaxProfileError] = useState<string | null>(null);
  const taxProfileSubmitting = useRef(false);

  // ---------- Estado: Telegram (AC #4) ----------
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [activationLink, setActivationLink] = useState('');
  const [activationBusy, setActivationBusy] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const activationSubmitting = useRef(false);

  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [unlinkBusy, setUnlinkBusy] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const unlinkSubmitting = useRef(false);

  // ---------- Estado: Descargar de la DIAN (Story 8.7 AC #2) ----------
  const [extractionOpen, setExtractionOpen] = useState(false);
  const [extractionMode, setExtractionMode] = useState<'single' | 'range'>('single');
  const [extractionMonth, setExtractionMonth] = useState(recentMonths(1)[0] || '');
  const [extractionMonthsCount, setExtractionMonthsCount] = useState('3');
  const [extractionStep, setExtractionStep] = useState<'input' | 'confirm' | 'result'>('input');
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<AdminExtractionCreateResponse | null>(null);
  const extractionSubmitting = useRef(false);

  // ---------- Estado: Documentos (Story 8.7 AC #1) ----------
  const { state: docsState, retry: retryDocs } = useResource(
    () => getAdminDocuments(businessId),
    [businessId],
  );

  // Subida de documentos
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('RUT');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadSubmitting = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retirar documento
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<AdminDocumentItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteSubmitting = useRef(false);

  // Abrir documento
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [docActionError, setDocActionError] = useState<string | null>(null);

  // Handler: Confirmar / Registrar pago
  function handlePaymentContinue(e: FormEvent) {
    e.preventDefault();
    setPaymentError(null);
    const cleanAmount = paymentAmount.replace(/\D/g, '');
    if (!cleanAmount || Number(cleanAmount) <= 0) {
      setPaymentError('Escribe un monto de pago válido (solo dígitos).');
      return;
    }
    if (!paymentRef.trim()) {
      setPaymentError('Escribe el código o referencia del pago.');
      return;
    }
    setPaymentStep('confirm');
  }

  async function handlePaymentConfirm(allowMismatch = false) {
    if (paymentSubmitting.current) return;
    paymentSubmitting.current = true;
    setPaymentBusy(true);
    setPaymentError(null);

    try {
      await recordAdminPayment(businessId, {
        amount: Number(paymentAmount.replace(/\D/g, '')),
        reference: paymentRef.trim(),
        allow_mismatch: allowMismatch,
      });
      setPaymentOpen(false);
      setPaymentMismatch(null);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          if (err.status === 409 && (err.code === 'AMOUNT_MISMATCH' || err.expected_amount)) {
            setPaymentMismatch({
              expected_amount: err.expected_amount || '',
              amount: err.amount || '',
              difference: err.difference || '',
            });
            setPaymentError(null);
          } else {
            setPaymentError(err.message);
          }
        }
      } else {
        setPaymentError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      paymentSubmitting.current = false;
      setPaymentBusy(false);
    }
  }

  // Handler: Abrir cambio de suscripción (Story 9.3 AC #7, Story 10.6 AC #4)
  function handleOpenSubChange(
    currentSub?: {
      monthly_price?: string | null;
      base_price?: string | null;
      discount_rate?: string | null;
      plan?: string | null;
    },
    initialMode: 'special' | 'plan' | 'current' = 'special',
  ) {
    setSubChangeMode(initialMode);
    setSubSpecialMonthly(
      currentSub?.monthly_price
        ? String(Math.round(Number(currentSub.monthly_price)))
        : currentSub?.base_price
          ? String(Math.round(Number(currentSub.base_price)))
          : '',
    );
    setSubSpecialDiscount(currentSub?.discount_rate ? String(Number(currentSub.discount_rate)) : '');
    setSubSelectedPlan(currentSub?.plan || 'TRIMESTRAL');
    setSubChangeReason('');
    setSubChangeError(null);
    setSubChangeOpen(true);

    if (pricingPlans.length === 0) {
      getAdminPricing()
        .then((res) => {
          const actives = res.plans.filter((p) => p.is_active);
          setPricingPlans(actives);
        })
        .catch(() => {});
    }
  }

  // Handler: Guardar cambio de suscripción (Story 9.3 AC #7)
  async function handleSubChangeSubmit(e: FormEvent) {
    e.preventDefault();
    if (subChangeSubmitting.current) return;

    if (!subChangeReason.trim()) {
      setSubChangeError('El motivo del cambio es obligatorio.');
      return;
    }

    const payload: {
      plan?: string;
      monthly_price?: number;
      discount_rate?: number;
      use_current_rate?: boolean;
      reason: string;
    } = {
      reason: subChangeReason.trim(),
    };

    if (subChangeMode === 'special') {
      const cleanMonthly = subSpecialMonthly.replace(/\D/g, '');
      const cleanDisc = subSpecialDiscount.trim();

      if (!cleanMonthly && cleanDisc === '') {
        setSubChangeError('Ingresa un nuevo valor mensual o un porcentaje de descuento para el precio especial.');
        return;
      }

      if (cleanMonthly) {
        const m = Number(cleanMonthly);
        if (m <= 0 || m > 10_000_000) {
          setSubChangeError('El valor mensual debe ser mayor a 0 y menor o igual a $10.000.000.');
          return;
        }
        payload.monthly_price = m;
      }

      if (cleanDisc !== '') {
        const d = Number(cleanDisc);
        if (Number.isNaN(d) || d < 0 || d > 50) {
          setSubChangeError('El descuento debe estar entre 0 % y 50 %.');
          return;
        }
        payload.discount_rate = d;
      }
    } else if (subChangeMode === 'plan') {
      if (!subSelectedPlan) {
        setSubChangeError('Selecciona un plan activo.');
        return;
      }
      payload.plan = subSelectedPlan;
    } else if (subChangeMode === 'current') {
      payload.use_current_rate = true;
    }

    subChangeSubmitting.current = true;
    setSubChangeBusy(true);
    setSubChangeError(null);

    try {
      await updateAdminSubscription(businessId, payload);
      setSubChangeOpen(false);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setSubChangeError(err.message);
        }
      } else {
        setSubChangeError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      subChangeSubmitting.current = false;
      setSubChangeBusy(false);
    }
  }

  // Handlers: Cambiar paquete o perfil (Story 10.6 AC #3)
  function handleOpenProfileModal(business: ClientDetailResponse['business'], ficha: ClientDetailResponse) {
    const vat =
      business.vat_responsible !== undefined
        ? Boolean(business.vat_responsible)
        : ficha.vat_responsible !== undefined
          ? Boolean(ficha.vat_responsible)
          : (business.package || ficha.package) === 'CON_IVA';
    const src = (business.income_source || ficha.income_source || 'DIAN') as AdminIncomeSource;

    setProfileVatResponsible(vat);
    setProfileIncomeSource(vat ? 'DIAN' : src);
    setProfileError(null);
    setProfileModalOpen(true);
  }

  function handleProfileVatChange(responsible: boolean) {
    setProfileVatResponsible(responsible);
    if (responsible) {
      setProfileIncomeSource('DIAN');
    }
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (profileSubmitting.current) return;
    profileSubmitting.current = true;
    setProfileBusy(true);
    setProfileError(null);

    try {
      await updateClientProfile(businessId, {
        vat_responsible: profileVatResponsible,
        income_source: profileVatResponsible ? 'DIAN' : profileIncomeSource,
      });
      setProfileModalOpen(false);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          if (err.code === 'VAT_REQUIRES_EINVOICING' || err.message === 'VAT_REQUIRES_EINVOICING') {
            setProfileError(
              err.message && err.message !== 'VAT_REQUIRES_EINVOICING'
                ? err.message
                : 'Un declarante de IVA siempre factura electrónicamente.',
            );
          } else {
            setProfileError(err.message || 'Error al actualizar el perfil.');
          }
        }
      } else {
        setProfileError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      profileSubmitting.current = false;
      setProfileBusy(false);
    }
  }

  // Handler: Guardar perfil tributario
  async function handleTaxProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (taxProfileSubmitting.current) return;
    taxProfileSubmitting.current = true;
    setTaxProfileBusy(true);
    setTaxProfileError(null);

    try {
      await updateAdminTaxProfile(businessId, {
        iva_periodicity: ivaPeriodicity ? (ivaPeriodicity as 'BIMESTRAL' | 'CUATRIMESTRAL') : null,
        is_withholding_agent: isWithholding,
      });
      setTaxProfileOpen(false);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setTaxProfileError(err.message);
        }
      } else {
        setTaxProfileError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      taxProfileSubmitting.current = false;
      setTaxProfileBusy(false);
    }
  }

  // Handler: Generar enlace de activación de Telegram
  async function handleGenerateActivationLink() {
    if (activationSubmitting.current) return;
    activationSubmitting.current = true;
    setActivationBusy(true);
    setActivationError(null);

    try {
      const res = await generateAdminActivationLink(businessId);
      setActivationLink(res.activation_link);
      setActivationModalOpen(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setActivationError(err.message);
        }
      } else {
        setActivationError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      activationSubmitting.current = false;
      setActivationBusy(false);
    }
  }

  // Handler: Desvincular Telegram
  async function handleUnlinkTelegram() {
    if (unlinkSubmitting.current) return;
    unlinkSubmitting.current = true;
    setUnlinkBusy(true);
    setUnlinkError(null);

    try {
      await releaseAdminTelegram(businessId);
      setUnlinkConfirmOpen(false);
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setUnlinkError(err.message);
        }
      } else {
        setUnlinkError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      unlinkSubmitting.current = false;
      setUnlinkBusy(false);
    }
  }

  // Helper para copiar al portapapeles
  async function handleCopyActivationLink() {
    if (!activationLink) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(activationLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
        return;
      }
    } catch {
      // Fallback
    }

    try {
      const input = document.createElement('textarea');
      input.value = activationLink;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(false);
    }
  }

  // ---------- Handlers: Descargar de la DIAN (Story 8.7 AC #2) ----------
  function handleOpenExtraction() {
    setExtractionMode('single');
    setExtractionMonth(recentMonths(1)[0] || '');
    setExtractionMonthsCount('3');
    setExtractionStep('input');
    setExtractionError(null);
    setExtractionResult(null);
    setExtractionOpen(true);
  }

  function handleExtractionContinue(e: FormEvent) {
    e.preventDefault();
    setExtractionError(null);
    if (extractionMode === 'range') {
      const num = Number(extractionMonthsCount);
      if (!/^\d{1,2}$/.test(extractionMonthsCount.trim()) || num < 1 || num > 12) {
        setExtractionError('El número de meses debe estar entre 1 y 12.');
        return;
      }
    } else if (!extractionMonth) {
      setExtractionError('Selecciona un mes para la descarga.');
      return;
    }
    setExtractionStep('confirm');
  }

  async function handleExtractionConfirm() {
    if (extractionSubmitting.current) return;
    extractionSubmitting.current = true;
    setExtractionBusy(true);
    setExtractionError(null);

    const payload =
      extractionMode === 'single'
        ? { period: extractionMonth }
        : { months: Number(extractionMonthsCount) };

    try {
      const res = await triggerAdminExtraction(businessId, payload);
      setExtractionResult(res);
      setExtractionStep('result');
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setExtractionError(err.message);
        }
      } else {
        setExtractionError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      extractionSubmitting.current = false;
      setExtractionBusy(false);
    }
  }

  // ---------- Handlers: Subida de documentos (Story 8.7 AC #1) ----------
  function handleSelectedFile(file: File) {
    setUploadError(null);
    if (!isAllowedDocumentType(file)) {
      setUploadError('Tipo de archivo no permitido. Solo se aceptan archivos PDF, JPEG o PNG.');
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setUploadError('El archivo supera el tamaño máximo permitido de 10 MB.');
      return;
    }
    setUploadFile(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleSelectedFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSelectedFile(file);
  }

  function handleClearSelectedFile() {
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUploadSubmit() {
    setUploadError(null);
    if (!uploadFile) {
      setUploadError('Selecciona un archivo para subir.');
      return;
    }
    if (!isAllowedDocumentType(uploadFile)) {
      setUploadError('Tipo de archivo no permitido. Solo se aceptan archivos PDF, JPEG o PNG.');
      return;
    }
    if (uploadFile.size > MAX_DOCUMENT_SIZE_BYTES) {
      setUploadError('El archivo supera el tamaño máximo permitido de 10 MB.');
      return;
    }
    if (uploadDocType === 'OTRO' && !uploadDescription.trim()) {
      setUploadError('La descripción es obligatoria cuando el tipo de documento es "Otro".');
      return;
    }

    if (uploadSubmitting.current) return;
    uploadSubmitting.current = true;
    setUploadBusy(true);

    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('doc_type', uploadDocType);
    if (uploadDescription.trim()) {
      fd.append('description', uploadDescription.trim());
    }

    try {
      await uploadAdminDocument(businessId, fd);
      setUploadFile(null);
      setUploadDescription('');
      setUploadDocType('RUT');
      if (fileInputRef.current) fileInputRef.current.value = '';
      retryDocs();
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          if (err.status === 413) {
            setUploadError('El archivo es demasiado grande (máximo 10 MB).');
          } else if (err.status === 415) {
            setUploadError('Tipo de archivo no permitido por el servidor.');
          } else if (err.status === 422) {
            setUploadError(err.message || 'Los datos del documento no son válidos.');
          } else {
            setUploadError(err.message);
          }
        }
      } else {
        setUploadError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      uploadSubmitting.current = false;
      setUploadBusy(false);
    }
  }

  // ---------- Handlers: Abrir y Retirar Documentos (Story 8.7 AC #1) ----------
  async function handleOpenDoc(doc: AdminDocumentItem) {
    if (openingDocId !== null) return;
    setOpeningDocId(doc.id);
    setDocActionError(null);

    try {
      await openDocumentLink(() => getAdminDocumentLink(businessId, doc.id));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          if (err.status === 404) {
            setDocActionError('Este documento ya no está disponible.');
            retryDocs();
            retry();
          } else {
            setDocActionError(err.message);
          }
        }
      } else {
        setDocActionError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      setOpeningDocId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!docToDelete) return;
    if (deleteSubmitting.current) return;
    deleteSubmitting.current = true;
    setDeleteBusy(true);
    setDeleteError(null);

    try {
      await deleteAdminDocument(businessId, docToDelete.id);
      setDeleteOpen(false);
      setDocToDelete(null);
      retryDocs();
      retry();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          if (err.status === 409) {
            setDeleteError('El documento ya ha sido retirado previamente.');
          } else {
            setDeleteError(err.message);
          }
        }
      } else {
        setDeleteError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      deleteSubmitting.current = false;
      setDeleteBusy(false);
    }
  }

  return (
    <section aria-label="Ficha del cliente" className="screen admin-screen admin-ficha-screen">
      <div className="admin-ficha-nav">
        <Link to={backUrl} className="admin-back-btn">
          ← Volver a clientes
        </Link>
      </div>

      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando ficha del cliente…">
        {(ficha) => {
          const { business, contact, tax_profile, subscription, recent_payments, recent_extractions } = ficha;
          const phoneDigits = contact.phone ? contact.phone.replace(/\D/g, '') : '';
          const waPhone = phoneDigits.startsWith('57') ? phoneDigits : `57${phoneDigits}`;

          const isManual = business.income_source === 'MANUAL_SALES';

          const clientPackage: AdminPackage | string | null =
            business.package ||
            ficha.package ||
            (business.vat_responsible !== undefined
              ? business.vat_responsible
                ? 'CON_IVA'
                : 'SIN_IVA'
              : null);

          const clientProfile = business.income_source || ficha.income_source;

          return (
            <div className="admin-ficha-content">
              {/* Encabezado: Negocio, NIT-DV, Chips de Paquete y Perfil, Estado y Cambiar paquete o perfil (AC #3) */}
              <div className="card admin-ficha-header">
                <div className="admin-ficha-header-top">
                  <div>
                    <div className="admin-ficha-chips-row">
                      <span className="admin-pill-category">{personaLabel(business.taxpayer_type)}</span>
                      {clientPackage && (
                        <span className="admin-pill-badge admin-pill-package">
                          {packageLabel(clientPackage)}
                        </span>
                      )}
                      {clientProfile && (
                        <span className="admin-pill-badge admin-pill-profile">
                          {incomeSourceLabel(clientProfile)}
                        </span>
                      )}
                    </div>
                    <h1 className="h-title admin-ficha-title">{business.commercial_name}</h1>
                    {business.legal_name && (
                      <p className="admin-ficha-subtitle">Razón social: {business.legal_name}</p>
                    )}
                  </div>
                  <div className="admin-ficha-header-actions">
                    {statusBadge(subscription?.status || (business.is_active ? 'ACTIVO' : 'SIN_SUSCRIPCION'))}
                    <button
                      type="button"
                      className="btn-outline admin-btn-sm admin-btn-change-profile"
                      onClick={() => handleOpenProfileModal(business, ficha)}
                    >
                      Cambiar paquete o perfil
                    </button>
                  </div>
                </div>

                <div className="admin-ficha-header-meta">
                  <div className="admin-meta-col">
                    <span className="admin-meta-label">NIT</span>
                    <strong className="admin-meta-value admin-nowrap">{fmtNit(business.nit, business.dv)}</strong>
                  </div>
                  <div className="admin-meta-col">
                    <span className="admin-meta-label">Paquete</span>
                    <strong className="admin-meta-value">{packageLabel(clientPackage)}</strong>
                  </div>
                  <div className="admin-meta-col">
                    <span className="admin-meta-label">Origen de ingresos</span>
                    <div className="admin-meta-with-action">
                      <strong className="admin-meta-value">{tipoLabel(business.income_source)}</strong>
                      <button
                        type="button"
                        className="btn-link admin-btn-sm admin-btn-inline-action"
                        onClick={() => handleOpenProfileModal(business, ficha)}
                      >
                        Cambiar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid 2 columnas: Contacto y Perfil Tributario (solo si es DIAN) */}
              <div className={`admin-grid ${isManual ? '' : 'admin-grid-2'}`}>
                {/* Contacto */}
                <div className="card admin-card">
                  <h2 className="admin-section-title">Contacto</h2>
                  {activationError && (
                    <p className="form-error" role="alert">
                      {activationError}
                    </p>
                  )}
                  <div className="admin-kv-list">
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Nombre</span>
                      <strong className="admin-kv-val">{contact.full_name}</strong>
                    </div>
                    {!isPlaceholderEmail(contact.email) && (
                      <div className="admin-kv-item">
                        <span className="admin-kv-key">Correo</span>
                        <span className="admin-kv-val">{contact.email}</span>
                      </div>
                    )}
                    <div className="admin-kv-item">
                      <span className="admin-kv-key">Celular</span>
                      <div className="admin-kv-val admin-phone-actions">
                        {contact.phone ? (
                          <>
                            <span>{contact.phone}</span>
                            <div className="admin-contact-links">
                              <a
                                href={`tel:${phoneDigits}`}
                                className="admin-link-btn"
                                aria-label={`Llamar a ${contact.full_name}`}
                              >
                                Llamar
                              </a>
                              <a
                                href={`https://wa.me/${waPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-link-btn admin-link-wa"
                                aria-label={`Escribir por WhatsApp a ${contact.full_name}`}
                              >
                                WhatsApp
                              </a>
                            </div>
                          </>
                        ) : (
                          <span className="admin-muted-text">No registrado</span>
                        )}
                      </div>
                    </div>
                    <div className="admin-kv-item admin-tg-item">
                      <span className="admin-kv-key">Telegram</span>
                      <div className="admin-kv-val admin-tg-val-box">
                        <div className="admin-tg-status-row">
                          <span
                            className={`admin-pill-telegram ${contact.is_telegram_linked ? 'linked' : 'unlinked'}`}
                          >
                            {contact.is_telegram_linked ? 'Vinculado' : 'Sin vincular'}
                          </span>
                          {contact.telegram_username && (
                            <span className="admin-tg-username"> (@{contact.telegram_username})</span>
                          )}
                        </div>
                        {/* Acciones de Telegram (AC #4) */}
                        <div className="admin-tg-actions">
                          {contact.is_telegram_linked ? (
                            <button
                              type="button"
                              className="btn-outline admin-btn-sm admin-btn-danger"
                              onClick={() => {
                                setUnlinkError(null);
                                setUnlinkConfirmOpen(true);
                              }}
                              disabled={unlinkBusy}
                            >
                              Desvincular Telegram
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-outline admin-btn-sm"
                              onClick={handleGenerateActivationLink}
                              disabled={activationBusy}
                            >
                              {activationBusy ? 'Generando…' : 'Generar enlace de activación'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Perfil tributario: oculto para ventas manuales (AC #3) */}
                {!isManual && (
                  <div className="card admin-card">
                    <div className="admin-card-head">
                      <h2 className="admin-section-title">Perfil tributario</h2>
                      <button
                        type="button"
                        className="btn-link admin-btn-sm admin-btn-inline-action"
                        onClick={() => {
                          setIvaPeriodicity(tax_profile.iva_periodicity || '');
                          setIsWithholding(Boolean(tax_profile.is_withholding_agent));
                          setTaxProfileError(null);
                          setTaxProfileOpen(true);
                        }}
                      >
                        Editar perfil
                      </button>
                    </div>
                    <div className="admin-kv-list">
                      <div className="admin-kv-item">
                        <span className="admin-kv-key">Periodicidad IVA</span>
                        <strong className="admin-kv-val">
                          {tax_profile.iva_periodicity || 'No definida'}
                        </strong>
                      </div>
                      <div className="admin-kv-item">
                        <span className="admin-kv-key">Agente de retención</span>
                        <span className="admin-kv-val">
                          {tax_profile.is_withholding_agent ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <div className="admin-kv-item">
                        <span className="admin-kv-key">Actividad económica</span>
                        <span className="admin-kv-val">
                          {business.economic_activity || 'No registrada'}
                        </span>
                      </div>
                      {business.legal_rep_doc && (
                        <div className="admin-kv-item">
                          <span className="admin-kv-key">Doc. Rep. Legal</span>
                          <span className="admin-kv-val">{business.legal_rep_doc}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Suscripción (Story 9.3 AC #6, #7) */}
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Suscripción</h2>
                  <div className="admin-card-head-actions">
                    {subscription && statusBadge(subscription.status)}
                    {subscription && (
                      <button
                        type="button"
                        className="btn-outline admin-btn-sm"
                        onClick={() => handleOpenSubChange(subscription)}
                      >
                        Cambiar precio o plan
                      </button>
                    )}
                  </div>
                </div>

                {/* AC #4: Alerta ámbar si subscription.package existe y es distinto de subscription.current_package */}
                {subscription &&
                  subscription.package &&
                  subscription.current_package &&
                  subscription.package !== subscription.current_package && (
                    <div className="admin-amber-alert" role="alert">
                      <span>
                        Cotizado como {packageLabel(subscription.package)}; hoy es {packageLabel(subscription.current_package)}
                        {subscription.current_rate_monthly
                          ? ` (tarifa ${fmtMoney(Number(subscription.current_rate_monthly))})`
                          : ''}
                      </span>
                      <button
                        type="button"
                        className="btn-link admin-btn-sm admin-btn-amber-action"
                        onClick={() => handleOpenSubChange(subscription, 'current')}
                      >
                        Volver a la tarifa vigente
                      </button>
                    </div>
                  )}

                {subscription ? (
                  <div className="admin-sub-grid">
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Plan</span>
                      <strong className="admin-sub-value">{planLabel(subscription.plan, pricingPlans)}</strong>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Valor mensual</span>
                      <strong className="admin-sub-value">
                        {subscription.monthly_price
                          ? fmtMoney(Number(subscription.monthly_price))
                          : subscription.base_price
                            ? fmtMoney(Number(subscription.base_price))
                            : '—'}
                      </strong>
                      {subscription.monthly_price &&
                        subscription.current_rate_monthly &&
                        Number(subscription.monthly_price) !== Number(subscription.current_rate_monthly) && (
                          <span className="admin-sub-hint-rate">
                            Tarifa vigente hoy: {fmtMoney(Number(subscription.current_rate_monthly))}
                          </span>
                        )}
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Origen</span>
                      <span className="admin-sub-value">
                        {subscription.price_origin === 'PRECIO_ESPECIAL' || subscription.price_origin === 'ESPECIAL'
                          ? 'Precio especial'
                          : 'Tarifa'}
                      </span>
                      {subscription.price_note && (
                        <span className="admin-sub-price-note">{subscription.price_note}</span>
                      )}
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Precio base</span>
                      <span className="admin-sub-value">
                        {subscription.base_price ? fmtMoney(Number(subscription.base_price)) : '—'}
                      </span>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Descuento</span>
                      <span className="admin-sub-value">
                        {subscription.discount_rate ? `${fmtPercent(Number(subscription.discount_rate))} %` : '—'}
                      </span>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Precio final</span>
                      <strong className="admin-sub-value text-accent">
                        {subscription.final_price ? fmtMoney(Number(subscription.final_price)) : '—'}
                      </strong>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Fecha de inicio</span>
                      <span className="admin-sub-value">
                        {subscription.start_date ? fmtDeadline(subscription.start_date) : '—'}
                      </span>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Próximo corte</span>
                      <strong className="admin-sub-value">
                        {subscription.cutoff_date ? fmtDeadline(subscription.cutoff_date) : '—'}
                      </strong>
                    </div>
                    <div className="admin-sub-item">
                      <span className="admin-meta-label">Fin periodo de gracia</span>
                      <span className="admin-sub-value">
                        {subscription.grace_period_end ? fmtDeadline(subscription.grace_period_end) : '—'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="admin-empty-text">El cliente no tiene una suscripción activa configurada.</p>
                )}
              </div>

              {/* Pagos recientes con acción "Registrar pago" (Story 9.3 AC #11) */}
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Pagos recientes</h2>
                  <button
                    type="button"
                    className="btn-primary admin-btn-sm"
                    onClick={() => {
                      setPaymentAmount(
                        subscription?.final_price
                          ? String(Math.round(Number(subscription.final_price)))
                          : '',
                      );
                      setPaymentRef('');
                      setPaymentStep('input');
                      setPaymentError(null);
                      setPaymentMismatch(null);
                      setPaymentOpen(true);
                    }}
                  >
                    Registrar pago
                  </button>
                </div>
                {recent_payments.length === 0 ? (
                  <p className="admin-empty-text">No hay pagos registrados.</p>
                ) : (
                  <>
                    {(() => {
                      const hasPartnerSplit = recent_payments.some(
                        (p) =>
                          (p.visioncontable_amount != null && p.visioncontable_amount !== '') ||
                          (p.nyo_amount != null && p.nyo_amount !== ''),
                      );

                      return (
                        <>
                          <div className="admin-table-container admin-desktop-only">
                            <table className="admin-table" aria-label="Historial de pagos">
                              <thead>
                                <tr>
                                  <th scope="col">Fecha</th>
                                  <th scope="col">Monto</th>
                                  {hasPartnerSplit && (
                                    <>
                                      <th scope="col">Visión Contable</th>
                                      <th scope="col">NYO</th>
                                    </>
                                  )}
                                  <th scope="col">Referencia</th>
                                  <th scope="col">Método</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recent_payments.map((p) => (
                                  <tr key={p.id} className="admin-table-row">
                                    <td>
                                      <span className="admin-nowrap">
                                        {p.payment_date
                                          ? fmtDeadline(p.payment_date)
                                          : p.created_at
                                            ? fmtBogotaDate(p.created_at)
                                            : '—'}
                                      </span>
                                    </td>
                                    <td>
                                      <strong className="admin-nowrap">{fmtMoney(Number(p.amount))}</strong>
                                    </td>
                                    {hasPartnerSplit && (
                                      <>
                                        <td>
                                          <span className="admin-nowrap">
                                            {p.visioncontable_amount != null && p.visioncontable_amount !== ''
                                              ? fmtMoney(Number(p.visioncontable_amount))
                                              : '—'}
                                          </span>
                                        </td>
                                        <td>
                                          <span className="admin-nowrap">
                                            {p.nyo_amount != null && p.nyo_amount !== ''
                                              ? fmtMoney(Number(p.nyo_amount))
                                              : '—'}
                                          </span>
                                        </td>
                                      </>
                                    )}
                                    <td>
                                      <code>{p.reference_code || '—'}</code>
                                    </td>
                                    <td>{paymentMethodLabel(p.payment_method)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="admin-mobile-only" style={{ gap: '10px' }}>
                            {recent_payments.map((p) => {
                              const dateText = p.payment_date
                                ? fmtDeadline(p.payment_date)
                                : p.created_at
                                  ? fmtBogotaDate(p.created_at)
                                  : '—';
                              return (
                                <div key={p.id} className="admin-ficha-card">
                                  <div className="admin-ficha-card-top">
                                    <span className="admin-ficha-card-main admin-nowrap">
                                      {fmtMoney(Number(p.amount))}
                                    </span>
                                    <span className="admin-ficha-card-sub admin-nowrap">{dateText}</span>
                                  </div>
                                  <div className="admin-ficha-card-meta">
                                    {hasPartnerSplit && (
                                      <>
                                        {p.visioncontable_amount != null && p.visioncontable_amount !== '' && (
                                          <div className="admin-ficha-card-row">
                                            <span className="admin-ficha-card-label">Visión Contable</span>
                                            <span className="admin-ficha-card-val admin-nowrap">
                                              {fmtMoney(Number(p.visioncontable_amount))}
                                            </span>
                                          </div>
                                        )}
                                        {p.nyo_amount != null && p.nyo_amount !== '' && (
                                          <div className="admin-ficha-card-row">
                                            <span className="admin-ficha-card-label">NYO</span>
                                            <span className="admin-ficha-card-val admin-nowrap">
                                              {fmtMoney(Number(p.nyo_amount))}
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    <div className="admin-ficha-card-row">
                                      <span className="admin-ficha-card-label">Referencia</span>
                                      <span className="admin-ficha-card-val">
                                        <code>{p.reference_code || '—'}</code>
                                      </span>
                                    </div>
                                    <div className="admin-ficha-card-row">
                                      <span className="admin-ficha-card-label">Método</span>
                                      <span className="admin-ficha-card-val">
                                        {paymentMethodLabel(p.payment_method)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Cambios de precio (Story 9.3 AC #8) */}
              {(() => {
                const changes = subscription?.price_changes || ficha.price_changes || [];
                if (!changes || changes.length === 0) return null;
                return (
                  <div className="card admin-card">
                    <div className="admin-card-head">
                      <h2 className="admin-section-title">Cambios de precio</h2>
                    </div>
                    <div className="admin-table-container admin-desktop-only">
                      <table className="admin-table" aria-label="Historial de cambios de precio">
                        <thead>
                          <tr>
                            <th scope="col">Fecha</th>
                            <th scope="col">Valor del periodo</th>
                            <th scope="col">Motivo</th>
                            <th scope="col">Registrado por</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map((ch, idx) => {
                            const dateStr = ch.created_at || '';
                            const beforeVal = ch.old_final_price ?? undefined;
                            const afterVal = ch.new_final_price ?? undefined;
                            const adminName = ch.admin || '—';

                            return (
                              <tr key={ch.id || idx} className="admin-table-row">
                                <td>
                                  <span className="admin-nowrap">{dateStr ? fmtBogotaDate(dateStr) : '—'}</span>
                                </td>
                                <td>
                                  {beforeVal !== undefined && afterVal !== undefined ? (
                                    <strong className="admin-nowrap">
                                      {fmtMoney(Number(beforeVal))} → {fmtMoney(Number(afterVal))}
                                    </strong>
                                  ) : afterVal !== undefined ? (
                                    <strong className="admin-nowrap">{fmtMoney(Number(afterVal))}</strong>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td>{ch.reason}</td>
                                <td>{adminName}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-mobile-only" style={{ gap: '10px' }}>
                      {changes.map((ch, idx) => {
                        const dateStr = ch.created_at ? fmtBogotaDate(ch.created_at) : '—';
                        const beforeVal = ch.old_final_price ?? undefined;
                        const afterVal = ch.new_final_price ?? undefined;
                        const adminName = ch.admin || '—';

                        return (
                          <div key={ch.id || idx} className="admin-ficha-card">
                            <div className="admin-ficha-card-top">
                              <span className="admin-ficha-card-main">
                                {beforeVal !== undefined && afterVal !== undefined ? (
                                  <span className="admin-nowrap">
                                    {fmtMoney(Number(beforeVal))} → {fmtMoney(Number(afterVal))}
                                  </span>
                                ) : afterVal !== undefined ? (
                                  <span className="admin-nowrap">{fmtMoney(Number(afterVal))}</span>
                                ) : (
                                  '—'
                                )}
                              </span>
                              <span className="admin-ficha-card-sub admin-nowrap">{dateStr}</span>
                            </div>
                            <div className="admin-ficha-card-meta">
                              <div className="admin-ficha-card-row">
                                <span className="admin-ficha-card-label">Motivo</span>
                                <span className="admin-ficha-card-val">{ch.reason}</span>
                              </div>
                              <div className="admin-ficha-card-row">
                                <span className="admin-ficha-card-label">Registrado por</span>
                                <span className="admin-ficha-card-val">{adminName}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Descargas DIAN recientes */}
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Descargas DIAN recientes</h2>
                  <button
                    type="button"
                    className="btn-primary admin-btn-sm"
                    onClick={handleOpenExtraction}
                  >
                    Descargar de la DIAN
                  </button>
                </div>
                {recent_extractions.length === 0 ? (
                  <p className="admin-empty-text">No hay descargas DIAN registradas.</p>
                ) : (
                  <>
                    <div className="admin-table-container admin-desktop-only">
                      <table className="admin-table" aria-label="Historial de extracciones DIAN">
                        <thead>
                          <tr>
                            <th scope="col">Periodo</th>
                            <th scope="col">Estado</th>
                            <th scope="col">Intentos</th>
                            <th scope="col">Detalle / Error</th>
                            <th scope="col">Fecha finalización</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recent_extractions.map((ext) => {
                            const err = friendlyExtractionError(ext.error_code);
                            return (
                              <tr key={ext.id} className="admin-table-row">
                                <td>{fmtPeriod(ext.period)}</td>
                                <td>
                                  <span
                                    className={`admin-pill-status status-${jobStatus(ext.status).tone}`}
                                  >
                                    {jobStatus(ext.status).label}
                                  </span>
                                </td>
                                <td>{ext.attempts}</td>
                                <td>
                                  <span
                                    title={err.code || undefined}
                                    className={ext.error_code ? 'text-alert' : ''}
                                  >
                                    {err.text}
                                  </span>
                                </td>
                                <td>
                                  <span className="admin-nowrap">
                                    {ext.finished_at
                                      ? fmtBogotaDate(ext.finished_at)
                                      : ext.next_run_at
                                        ? `Próx: ${fmtBogotaDate(ext.next_run_at)}`
                                        : '—'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="admin-mobile-only" style={{ gap: '10px' }}>
                      {recent_extractions.map((ext) => {
                        const err = friendlyExtractionError(ext.error_code);
                        const finalDate = ext.finished_at
                          ? fmtBogotaDate(ext.finished_at)
                          : ext.next_run_at
                            ? `Próx: ${fmtBogotaDate(ext.next_run_at)}`
                            : '—';

                        return (
                          <div key={ext.id} className="admin-ficha-card">
                            <div className="admin-ficha-card-top">
                              <strong className="admin-ficha-card-main">{fmtPeriod(ext.period)}</strong>
                              <span
                                className={`admin-pill-status status-${jobStatus(ext.status).tone}`}
                              >
                                {jobStatus(ext.status).label}
                              </span>
                            </div>
                            <div className="admin-ficha-card-meta">
                              <div className="admin-ficha-card-row">
                                <span className="admin-ficha-card-label">Intentos</span>
                                <span className="admin-ficha-card-val">{ext.attempts}</span>
                              </div>
                              <div className="admin-ficha-card-row">
                                <span className="admin-ficha-card-label">Detalle / error</span>
                                <span
                                  title={err.code || undefined}
                                  className={`admin-ficha-card-val ${ext.error_code ? 'text-alert' : ''}`}
                                >
                                  {err.text}
                                </span>
                              </div>
                              <div className="admin-ficha-card-row">
                                <span className="admin-ficha-card-label">Finalización</span>
                                <span className="admin-ficha-card-val admin-nowrap">{finalDate}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Documentos */}
              <div className="card admin-card">
                <div className="admin-card-head">
                  <h2 className="admin-section-title">Documentos</h2>
                  <span className="admin-count-badge">
                    {docsState.status === 'ready' ? docsState.data.length : ficha.active_documents_count}
                  </span>
                </div>

                {docActionError && (
                  <p className="form-error" role="alert">
                    {docActionError}
                  </p>
                )}

                <ResourceView state={docsState} onRetry={retryDocs} loadingLabel="Cargando documentos del cliente…">
                  {(docs) => (
                    <>
                      {docs.length === 0 ? (
                        <p className="admin-empty-text">No hay documentos registrados para este cliente.</p>
                      ) : (
                        <>
                          {/* Vista de tabla para escritorio (>= 1024 px) */}
                          <div className="admin-table-container admin-desktop-only">
                            <table className="admin-table" aria-label="Documentos del cliente">
                              <thead>
                                <tr>
                                  <th scope="col">#</th>
                                  <th scope="col">Tipo</th>
                                  <th scope="col">Descripción</th>
                                  <th scope="col">Fecha</th>
                                  <th scope="col">Tamaño</th>
                                  <th scope="col">Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {docs.map((doc) => (
                                  <tr key={doc.id} className="admin-table-row">
                                    <td>
                                      <span className="admin-doc-num">#{doc.number}</span>
                                    </td>
                                    <td>
                                      <strong>{docTitle(doc)}</strong>
                                      <span className="admin-doc-filename" style={{ display: 'block' }}>
                                        {doc.original_filename}
                                      </span>
                                    </td>
                                    <td>{doc.description || '—'}</td>
                                    <td>{fmtBogotaDate(doc.created_at)}</td>
                                    <td>{fmtFileSize(doc.size_bytes)}</td>
                                    <td>
                                      <div className="admin-doc-actions">
                                        <button
                                          type="button"
                                          className="btn-outline admin-btn-sm"
                                          aria-label={`Abrir ${docTitle(doc)}`}
                                          disabled={openingDocId !== null}
                                          onClick={() => handleOpenDoc(doc)}
                                        >
                                          {openingDocId === doc.id ? 'Abriendo…' : 'Abrir'}
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-outline admin-btn-sm admin-btn-danger"
                                          aria-label={`Retirar ${docTitle(doc)}`}
                                          onClick={() => {
                                            setDocToDelete(doc);
                                            setDeleteError(null);
                                            setDeleteOpen(true);
                                          }}
                                        >
                                          Retirar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Vista de tarjetas apiladas para móvil (< 1024 px) */}
                          <div className="admin-mobile-only" style={{ gap: '10px' }}>
                            {docs.map((doc) => (
                              <div key={doc.id} className="card admin-doc-card">
                                <div className="admin-doc-card-top">
                                  <div>
                                    <span className="admin-doc-num">#{doc.number}</span>{' '}
                                    <strong>{docTitle(doc)}</strong>
                                    <div className="admin-doc-filename">{doc.original_filename}</div>
                                  </div>
                                  <div className="admin-doc-actions">
                                    <button
                                      type="button"
                                      className="btn-outline admin-btn-sm"
                                      aria-label={`Abrir ${docTitle(doc)}`}
                                      disabled={openingDocId !== null}
                                      onClick={() => handleOpenDoc(doc)}
                                    >
                                      {openingDocId === doc.id ? 'Abriendo…' : 'Abrir'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-outline admin-btn-sm admin-btn-danger"
                                      aria-label={`Retirar ${docTitle(doc)}`}
                                      onClick={() => {
                                        setDocToDelete(doc);
                                        setDeleteError(null);
                                        setDeleteOpen(true);
                                      }}
                                    >
                                      Retirar
                                    </button>
                                  </div>
                                </div>
                                {doc.description && <p className="admin-muted-text">{doc.description}</p>}
                                <div className="admin-doc-card-meta">
                                  <span>{fmtBogotaDate(doc.created_at)}</span>
                                  <span>·</span>
                                  <span>{fmtFileSize(doc.size_bytes)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Zona de subida */}
                      <div className="admin-upload-section">
                        <h3 className="admin-section-subtitle">Subir nuevo documento</h3>

                        {uploadError && (
                          <p className="form-error" role="alert" style={{ marginBottom: '12px' }}>
                            {uploadError}
                          </p>
                        )}

                        <div
                          className={`admin-dropzone ${isDragging ? 'dragging' : ''}`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <span className="admin-dropzone-icon" aria-hidden="true">
                            <IconDocument size={32} />
                          </span>
                          <p className="admin-dropzone-text">
                            Arrastra y suelta un archivo aquí o haz clic en Elegir archivo
                          </p>
                          <input
                            id="admin-doc-file"
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            onChange={handleFileInputChange}
                            className="admin-file-input-hidden"
                          />
                          <label
                            htmlFor="admin-doc-file"
                            className="btn-outline admin-btn-sm"
                            style={{ cursor: 'pointer' }}
                          >
                            Elegir archivo
                          </label>
                          <p className="admin-dropzone-hint">
                            Formatos aceptados: PDF, JPEG o PNG (hasta 10 MB)
                          </p>

                          {uploadFile && (
                            <div className="admin-selected-file-badge">
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <IconPaperclip size={16} /> {uploadFile.name} ({fmtFileSize(uploadFile.size)})
                              </span>
                              <button
                                type="button"
                                className="btn-link"
                                style={{ color: 'var(--terracota-dark)', marginLeft: '6px' }}
                                onClick={handleClearSelectedFile}
                              >
                                Quitar
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="admin-grid admin-grid-2" style={{ marginBottom: '14px' }}>
                          <div className="field">
                            <label className="field-label" htmlFor="upload-doc-type">
                              Tipo de documento
                            </label>
                            <select
                              id="upload-doc-type"
                              className="field-input"
                              value={uploadDocType}
                              onChange={(e) => setUploadDocType(e.target.value)}
                              disabled={uploadBusy}
                            >
                              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="field">
                            <label className="field-label" htmlFor="upload-doc-desc">
                              Descripción {uploadDocType === 'OTRO' ? '(obligatoria)' : '(opcional)'}
                            </label>
                            <input
                              id="upload-doc-desc"
                              className="field-input"
                              type="text"
                              placeholder={
                                uploadDocType === 'OTRO'
                                  ? 'Escribe qué documento es…'
                                  : 'Detalle o referencia opcional'
                              }
                              value={uploadDescription}
                              onChange={(e) => setUploadDescription(e.target.value)}
                              disabled={uploadBusy}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleUploadSubmit}
                          disabled={uploadBusy}
                        >
                          {uploadBusy ? 'Subiendo…' : 'Subir documento'}
                        </button>
                      </div>
                    </>
                  )}
                </ResourceView>
              </div>

              {/* ================================================================
                  DIÁLOGOS ACCESIBLES (AC #2, #3, #4, #5)
                  ================================================================ */}

              {/* Diálogo: Registrar pago (AC #2) */}
              <Dialog
                isOpen={paymentOpen}
                onClose={() => setPaymentOpen(false)}
                title={paymentStep === 'input' ? 'Registrar pago' : 'Confirmar pago'}
                busy={paymentBusy}
              >
                {paymentError && (
                  <p className="form-error" role="alert">
                    {paymentError}
                  </p>
                )}

                {paymentStep === 'input' ? (
                  <form onSubmit={handlePaymentContinue} noValidate>
                    <div className="field">
                      <label className="field-label" htmlFor="pay-amount">
                        Monto del pago
                      </label>
                      <input
                        id="pay-amount"
                        className="field-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej. 270000"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value.replace(/\D/g, ''))}
                        disabled={paymentBusy}
                      />
                      <span className="field-hint" aria-live="polite">
                        Formato: {paymentAmount ? fmtMoney(Number(paymentAmount)) : '$0'}
                      </span>
                      {subscription?.final_price && (
                        <span className="field-hint admin-field-hint-period">
                          Valor del periodo: {fmtMoney(Number(subscription.final_price))}
                        </span>
                      )}
                    </div>

                    <div className="field">
                      <label className="field-label" htmlFor="pay-reference">
                        Referencia de pago
                      </label>
                      <input
                        id="pay-reference"
                        className="field-input"
                        type="text"
                        placeholder="Ej. REF-889900 o comprobante"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        disabled={paymentBusy}
                      />
                    </div>

                    <div className="stack admin-dialog-actions">
                      <button className="btn-primary" type="submit" disabled={paymentBusy}>
                        Continuar
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => setPaymentOpen(false)}
                        disabled={paymentBusy}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : paymentMismatch ? (
                  /* Aviso 409 AMOUNT_MISMATCH (Story 9.3 AC #11) */
                  <div className="admin-mismatch-box" role="alert">
                    <p className="admin-mismatch-title">
                      <strong>Aviso de diferencia de monto</strong>
                    </p>
                    <div className="admin-mismatch-rows">
                      <p className="admin-mismatch-row">
                        <span>Valor esperado: </span>
                        <strong>{fmtMoney(Number(paymentMismatch.expected_amount))}</strong>
                      </p>
                      <p className="admin-mismatch-row">
                        <span>Valor recibido: </span>
                        <strong>{fmtMoney(Number(paymentMismatch.amount))}</strong>
                      </p>
                      <p className="admin-mismatch-row">
                        <span>Diferencia: </span>
                        <strong
                          className={
                            Number(paymentMismatch.difference) < 0
                              ? 'text-danger'
                              : 'text-success'
                          }
                        >
                          {fmtMoney(Number(paymentMismatch.difference))}
                        </strong>
                      </p>
                    </div>

                    <div className="stack admin-dialog-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() => handlePaymentConfirm(true)}
                        disabled={paymentBusy}
                      >
                        {paymentBusy ? 'Registrando…' : 'Registrar de todas formas'}
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => {
                          setPaymentMismatch(null);
                          setPaymentStep('input');
                        }}
                        disabled={paymentBusy}
                      >
                        Corregir monto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-confirm-box">
                    <p className="admin-confirm-text">
                      Registrar pago de{' '}
                      <strong>{fmtMoney(Number(paymentAmount))}</strong> a{' '}
                      <strong>{business.commercial_name}</strong>
                    </p>
                    <p className="admin-muted-text">
                      Referencia: <code>{paymentRef}</code>
                    </p>

                    <div className="stack admin-dialog-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() => handlePaymentConfirm(false)}
                        disabled={paymentBusy}
                      >
                        {paymentBusy ? 'Registrando…' : 'Confirmar'}
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => setPaymentStep('input')}
                        disabled={paymentBusy}
                      >
                        Volver
                      </button>
                    </div>
                  </div>
                )}
              </Dialog>

              {/* Diálogo: Cambiar precio o plan (Story 9.3 AC #7) */}
              <Dialog
                isOpen={subChangeOpen}
                onClose={() => setSubChangeOpen(false)}
                title="Cambiar precio o plan de suscripción"
                busy={subChangeBusy}
              >
                {subChangeError && (
                  <p className="form-error" role="alert">
                    {subChangeError}
                  </p>
                )}
                {subscription && (
                  <form onSubmit={handleSubChangeSubmit}>
                    <fieldset className="admin-fieldset">
                      <legend className="field-label">Tipo de cambio</legend>

                      <div className="admin-radio-group" role="radiogroup">
                        <label className="admin-radio-label">
                          <input
                            type="radio"
                            name="sub-change-mode"
                            value="special"
                            checked={subChangeMode === 'special'}
                            onChange={() => setSubChangeMode('special')}
                            disabled={subChangeBusy}
                          />
                          <span>Precio especial</span>
                        </label>
                        <label className="admin-radio-label">
                          <input
                            type="radio"
                            name="sub-change-mode"
                            value="plan"
                            checked={subChangeMode === 'plan'}
                            onChange={() => setSubChangeMode('plan')}
                            disabled={subChangeBusy}
                          />
                          <span>Cambiar plan</span>
                        </label>
                        <label className="admin-radio-label">
                          <input
                            type="radio"
                            name="sub-change-mode"
                            value="current"
                            checked={subChangeMode === 'current'}
                            onChange={() => setSubChangeMode('current')}
                            disabled={subChangeBusy}
                          />
                          <span>Volver a la tarifa vigente</span>
                        </label>
                      </div>
                    </fieldset>

                    {/* Opciones según el modo */}
                    {subChangeMode === 'special' && (
                      <div className="admin-sub-mode-fields">
                        <div className="field">
                          <label className="field-label" htmlFor="sub-special-monthly">
                            Nuevo valor mensual
                          </label>
                          <input
                            id="sub-special-monthly"
                            type="text"
                            inputMode="numeric"
                            className="field-input"
                            placeholder="Ej. 70000"
                            value={subSpecialMonthly}
                            onChange={(e) => setSubSpecialMonthly(e.target.value.replace(/\D/g, ''))}
                            disabled={subChangeBusy}
                          />
                          <span className="field-hint">
                            Formato: {subSpecialMonthly ? fmtMoney(Number(subSpecialMonthly)) : '$0'}
                          </span>
                        </div>

                        <div className="field">
                          <label className="field-label" htmlFor="sub-special-discount">
                            Nuevo descuento (%)
                          </label>
                          <input
                            id="sub-special-discount"
                            type="number"
                            min="0"
                            max="50"
                            step="any"
                            className="field-input"
                            placeholder="Ej. 10"
                            value={subSpecialDiscount}
                            onChange={(e) => setSubSpecialDiscount(e.target.value)}
                            disabled={subChangeBusy}
                          />
                          <span className="field-hint">Entre 0 % y 50 %</span>
                        </div>
                      </div>
                    )}

                    {subChangeMode === 'plan' && (
                      <div className="admin-sub-mode-fields">
                        <div className="field">
                          <label className="field-label" htmlFor="sub-select-plan">
                            Seleccionar plan
                          </label>
                          <select
                            id="sub-select-plan"
                            className="field-input"
                            value={subSelectedPlan}
                            onChange={(e) => setSubSelectedPlan(e.target.value)}
                            disabled={subChangeBusy}
                          >
                            {pricingPlans.length > 0 ? (
                              pricingPlans.map((p) => (
                                <option key={p.code} value={p.code}>
                                  {p.name} ({p.months} meses, desc {fmtPercent(Number(p.discount_rate))} %)
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="TRIMESTRAL">Trimestral (3 meses)</option>
                                <option value="SEMESTRAL">Semestral (6 meses)</option>
                                <option value="ANUAL">Anual (12 meses)</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>
                    )}

                    {subChangeMode === 'current' && (
                      <div className="admin-sub-mode-fields">
                        <p className="admin-muted-note">
                          Se aplicará la tarifa vigente del segmento:{' '}
                          <strong>
                            {subscription.current_rate_monthly
                              ? fmtMoney(Number(subscription.current_rate_monthly))
                              : 'Tarifa vigente'}
                          </strong>{' '}
                          mensual.
                        </p>
                      </div>
                    )}

                    {/* Motivo obligatorio */}
                    <div className="field">
                      <label className="field-label" htmlFor="sub-change-reason">
                        Motivo del cambio (obligatorio)
                      </label>
                      <textarea
                        id="sub-change-reason"
                        className="field-input admin-textarea"
                        rows={2}
                        placeholder="Ej. Descuento comercial acordado por fidelidad"
                        value={subChangeReason}
                        onChange={(e) => setSubChangeReason(e.target.value)}
                        disabled={subChangeBusy}
                        required
                      />
                    </div>

                    {/* Vista previa antes de guardar */}
                    {(() => {
                      const { beforeFinal, afterFinal } = computeSubPeriodPreview(
                        subscription,
                        pricingPlans,
                        subChangeMode,
                        subSpecialMonthly,
                        subSpecialDiscount,
                        subSelectedPlan,
                      );
                      return (
                        <div className="admin-sub-preview-box" aria-live="polite">
                          <p className="admin-sub-preview-text">
                            Valor del periodo: <strong>{fmtMoney(beforeFinal)}</strong> →{' '}
                            <strong className="text-accent">{fmtMoney(afterFinal)}</strong>
                          </p>
                          <p className="admin-muted-note">Las fechas de corte no cambian.</p>
                        </div>
                      );
                    })()}

                    <div className="stack admin-dialog-actions">
                      <button type="submit" className="btn-primary" disabled={subChangeBusy}>
                        {subChangeBusy ? 'Guardando…' : 'Guardar cambio'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setSubChangeOpen(false)}
                        disabled={subChangeBusy}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </Dialog>

              {/* Diálogo: Cambiar paquete o perfil (Story 10.6 AC #3) */}
              <Dialog
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                title="Cambiar paquete o perfil"
                busy={profileBusy}
              >
                {profileError && (
                  <p className="form-error" role="alert">
                    {profileError}
                  </p>
                )}
                <form onSubmit={handleProfileSubmit}>
                  {/* Selector "¿Declara IVA?" */}
                  <div className="field">
                    <label className="field-label" id="label-profile-declara-iva">
                      ¿Declara IVA?
                    </label>
                    <div
                      className="admin-toggle-group"
                      role="radiogroup"
                      aria-labelledby="label-profile-declara-iva"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={profileVatResponsible}
                        className={`admin-toggle-btn ${profileVatResponsible ? 'active' : ''}`}
                        onClick={() => handleProfileVatChange(true)}
                        disabled={profileBusy}
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!profileVatResponsible}
                        className={`admin-toggle-btn ${!profileVatResponsible ? 'active' : ''}`}
                        onClick={() => handleProfileVatChange(false)}
                        disabled={profileBusy}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Selector de Perfil */}
                  <div className="field">
                    <label className="field-label" htmlFor="dialog-client-profile">
                      Perfil
                    </label>
                    {profileVatResponsible ? (
                      <div>
                        <input
                          id="dialog-client-profile"
                          type="text"
                          className="field-input"
                          value="Factura electrónica"
                          readOnly
                          disabled
                        />
                        <span className="field-hint">
                          Un declarante de IVA siempre factura electrónicamente
                        </span>
                      </div>
                    ) : (
                      <select
                        id="dialog-client-profile"
                        className="field-input"
                        value={profileIncomeSource}
                        onChange={(e) =>
                          setProfileIncomeSource(e.target.value as AdminIncomeSource)
                        }
                        disabled={profileBusy}
                      >
                        <option value="DIAN">Factura electrónica</option>
                        <option value="MANUAL_SALES">Ventas</option>
                        <option value="MIXED">Mixto (factura + ventas)</option>
                      </select>
                    )}
                  </div>

                  {/* Aviso informativo de precio */}
                  <div className="admin-notice-box" role="note">
                    El precio del cliente no cambia. Si debe pagar la tarifa del nuevo paquete, usa{' '}
                    <strong>Cambiar precio → Volver a la tarifa vigente</strong>.
                  </div>

                  <div className="stack admin-dialog-actions">
                    <button className="btn-primary" type="submit" disabled={profileBusy}>
                      {profileBusy ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      className="btn-outline"
                      type="button"
                      onClick={() => setProfileModalOpen(false)}
                      disabled={profileBusy}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Dialog>

              {/* Diálogo: Editar perfil tributario (AC #3) */}
              <Dialog
                isOpen={taxProfileOpen}
                onClose={() => setTaxProfileOpen(false)}
                title="Editar perfil tributario"
                busy={taxProfileBusy}
              >
                {taxProfileError && (
                  <p className="form-error" role="alert">
                    {taxProfileError}
                  </p>
                )}
                <form onSubmit={handleTaxProfileSubmit}>
                  <div className="field">
                    <label className="field-label" htmlFor="select-iva-periodicity">
                      Periodicidad de IVA
                    </label>
                    <select
                      id="select-iva-periodicity"
                      className="field-input"
                      value={ivaPeriodicity}
                      onChange={(e) => setIvaPeriodicity(e.target.value)}
                      disabled={taxProfileBusy}
                    >
                      <option value="BIMESTRAL">Bimestral</option>
                      <option value="CUATRIMESTRAL">Cuatrimestral</option>
                      <option value="">No responsable</option>
                    </select>
                  </div>

                  <div className="field">
                    <label className="admin-checkbox-container" htmlFor="check-withholding">
                      <input
                        id="check-withholding"
                        type="checkbox"
                        checked={isWithholding}
                        onChange={(e) => setIsWithholding(e.target.checked)}
                        disabled={taxProfileBusy}
                      />
                      <span>Agente de retención en la fuente</span>
                    </label>
                  </div>

                  <div className="stack admin-dialog-actions">
                    <button className="btn-primary" type="submit" disabled={taxProfileBusy}>
                      {taxProfileBusy ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      className="btn-outline"
                      type="button"
                      onClick={() => setTaxProfileOpen(false)}
                      disabled={taxProfileBusy}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </Dialog>

              {/* Diálogo: Enlace de activación de Telegram generado (AC #4) */}
              <Dialog
                isOpen={activationModalOpen}
                onClose={() => setActivationModalOpen(false)}
                title="Enlace de activación de Telegram"
                busy={false}
              >
                <div className="admin-activation-dialog-body">
                  <p className="lead">
                    Comparte este enlace con el cliente para que vincule su cuenta de Telegram con Konta.
                  </p>

                  <div className="field">
                    <label className="field-label" htmlFor="dialog-activation-link">
                      Enlace:
                    </label>
                    <div className="admin-copy-row">
                      <input
                        id="dialog-activation-link"
                        className="field-input admin-activation-input"
                        type="text"
                        readOnly
                        value={activationLink}
                      />
                      <button
                        type="button"
                        className="btn-outline admin-btn-copy"
                        onClick={handleCopyActivationLink}
                      >
                        {copiedLink ? '¡Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  <div className="stack admin-dialog-actions">
                    <a
                      href={clientWhatsappUrl(
                        contact.phone || '',
                        `¡Hola ${contact.full_name}! Usa este enlace para activar tu bot de Telegram en Konta: ${activationLink}`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary admin-btn-wa"
                    >
                      Enviar por WhatsApp
                    </a>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => setActivationModalOpen(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </Dialog>

              {/* Diálogo: Confirmar desvincular Telegram (AC #4) */}
              <Dialog
                isOpen={unlinkConfirmOpen}
                onClose={() => setUnlinkConfirmOpen(false)}
                title="Desvincular Telegram"
                busy={unlinkBusy}
              >
                {unlinkError && (
                  <p className="form-error" role="alert">
                    {unlinkError}
                  </p>
                )}
                <div className="admin-unlink-box">
                  <p className="admin-confirm-text">
                    ¿Estás seguro de que deseas desvincular la cuenta de Telegram de{' '}
                    <strong>{contact.full_name}</strong>?
                  </p>
                  <p className="admin-warning-note">
                    Consecuencia: El cliente dejará de recibir alertas de vencimiento, notificaciones de facturación
                    y resúmenes automáticos hasta que vuelva a generar un enlace de activación.
                  </p>

                  <div className="stack admin-dialog-actions">
                    <button
                      className="btn-primary admin-btn-danger"
                      type="button"
                      onClick={handleUnlinkTelegram}
                      disabled={unlinkBusy}
                    >
                      {unlinkBusy ? 'Desvinculando…' : 'Desvincular'}
                    </button>
                    <button
                      className="btn-outline"
                      type="button"
                      onClick={() => setUnlinkConfirmOpen(false)}
                      disabled={unlinkBusy}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </Dialog>

              {/* Diálogo: Descargar de la DIAN (Story 8.7 AC #2) */}
              <Dialog
                isOpen={extractionOpen}
                onClose={() => setExtractionOpen(false)}
                title={
                  extractionStep === 'result'
                    ? 'Descarga encolada exitosamente'
                    : extractionStep === 'confirm'
                      ? 'Confirmar descarga de la DIAN'
                      : 'Descargar de la DIAN'
                }
                busy={extractionBusy}
              >
                {extractionError && (
                  <p className="form-error" role="alert">
                    {extractionError}
                  </p>
                )}

                {extractionStep === 'input' && (
                  <form onSubmit={handleExtractionContinue} noValidate>
                    <div className="field">
                      <label className="field-label">Modalidad de descarga</label>
                      <div className="admin-toggle-group" role="radiogroup" aria-label="Modalidad de descarga">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={extractionMode === 'single'}
                          className={`admin-toggle-btn ${extractionMode === 'single' ? 'active' : ''}`}
                          onClick={() => setExtractionMode('single')}
                        >
                          Un mes
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={extractionMode === 'range'}
                          className={`admin-toggle-btn ${extractionMode === 'range' ? 'active' : ''}`}
                          onClick={() => setExtractionMode('range')}
                        >
                          Últimos N meses
                        </button>
                      </div>
                    </div>

                    {extractionMode === 'single' ? (
                      <div className="field">
                        <label className="field-label" htmlFor="select-extraction-month">
                          Mes a descargar
                        </label>
                        <select
                          id="select-extraction-month"
                          className="field-input"
                          value={extractionMonth}
                          onChange={(e) => setExtractionMonth(e.target.value)}
                          disabled={extractionBusy}
                        >
                          {recentMonths(12).map((m) => (
                            <option key={m} value={m}>
                              {fmtPeriod(m)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="field">
                        <label className="field-label" htmlFor="input-extraction-months">
                          Cantidad de meses (1–12)
                        </label>
                        <input
                          id="input-extraction-months"
                          className="field-input"
                          type="number"
                          min={1}
                          max={12}
                          value={extractionMonthsCount}
                          inputMode="numeric"
                          onChange={(e) => setExtractionMonthsCount(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          disabled={extractionBusy}
                        />
                      </div>
                    )}

                    <div className="stack admin-dialog-actions">
                      <button className="btn-primary" type="submit" disabled={extractionBusy}>
                        Continuar
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => setExtractionOpen(false)}
                        disabled={extractionBusy}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                {extractionStep === 'confirm' && (
                  <div className="admin-confirm-box">
                    <p className="admin-confirm-text">
                      {extractionMode === 'single'
                        ? `¿Confirmas solicitar la descarga de la DIAN para ${fmtPeriod(extractionMonth)} de ${business.commercial_name}?`
                        : `¿Confirmas solicitar la descarga de la DIAN de los últimos ${extractionMonthsCount} meses para ${business.commercial_name}?`}
                    </p>
                    <p className="admin-muted-text">
                      La tarea se encolará y el worker de fondo procesará los documentos directamente con la DIAN.
                    </p>

                    <div className="stack admin-dialog-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={handleExtractionConfirm}
                        disabled={extractionBusy}
                      >
                        {extractionBusy ? 'Encolando…' : 'Confirmar descarga'}
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => setExtractionStep('input')}
                        disabled={extractionBusy}
                      >
                        Volver
                      </button>
                    </div>
                  </div>
                )}

                {extractionStep === 'result' && (
                  <div className="admin-confirm-box">
                    <p className="admin-confirm-text">
                      La solicitud ha sido registrada correctamente en el sistema.
                    </p>
                    {extractionResult && (
                      <div className="admin-stat-row" style={{ marginTop: '12px' }}>
                        <span>Estado</span>
                        <strong>{jobStatus(extractionResult.status).label}</strong>
                      </div>
                    )}

                    <div className="stack admin-dialog-actions">
                      <button
                        className="btn-primary"
                        type="button"
                        onClick={() => setExtractionOpen(false)}
                      >
                        Aceptar
                      </button>
                    </div>
                  </div>
                )}
              </Dialog>

              {/* Diálogo: Retirar documento (Story 8.7 AC #1) */}
              <Dialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title="Retirar documento"
                busy={deleteBusy}
              >
                {deleteError && (
                  <p className="form-error" role="alert">
                    {deleteError}
                  </p>
                )}
                {docToDelete && (
                  <div className="admin-confirm-box">
                    <p className="admin-confirm-text">
                      ¿Estás seguro de que deseas retirar el documento{' '}
                      <strong>{docTitle(docToDelete)} (#{docToDelete.number})</strong>?
                    </p>
                    <p className="admin-warning-note">
                      El archivo ({docToDelete.original_filename}) dejará de estar disponible para el cliente.
                    </p>

                    <div className="stack admin-dialog-actions">
                      <button
                        className="btn-primary admin-btn-danger"
                        type="button"
                        onClick={handleConfirmDelete}
                        disabled={deleteBusy}
                      >
                        {deleteBusy ? 'Retirando…' : 'Retirar'}
                      </button>
                      <button
                        className="btn-outline"
                        type="button"
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleteBusy}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </Dialog>
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
