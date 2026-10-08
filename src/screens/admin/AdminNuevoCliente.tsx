import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createAdminClient } from '../../api/adminEndpoints';
import type {
  AdminClientCreateRequest,
  AdminClientCreateResponse,
  AdminIncomeSource,
  AdminPersonType,
  AdminPlan,
} from '../../api/adminTypes';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../../api/client';
import { clientWhatsappUrl } from '../../config';

export default function AdminNuevoCliente() {
  const [personType, setPersonType] = useState<AdminPersonType>('PERSONA');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [nit, setNit] = useState('');
  const [legalRepDoc, setLegalRepDoc] = useState('');
  const [plan, setPlan] = useState<AdminPlan>('TRIMESTRAL');
  const [incomeSource, setIncomeSource] = useState<AdminIncomeSource>('DIAN');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminClientCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Protección contra doble envío
  const submitting = useRef(false);

  // Validación de campos del formulario
  function validate(): string | null {
    if (!contactName.trim()) {
      return personType === 'PERSONA'
        ? 'El nombre del cliente es obligatorio.'
        : 'El nombre de contacto es obligatorio.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      return 'El número de celular es obligatorio.';
    }
    if (cleanPhone.length < 10) {
      return 'El número de celular debe tener al menos 10 dígitos.';
    }

    if (personType === 'PERSONA') {
      const cleanDoc = documentNumber.replace(/\D/g, '');
      if (!cleanDoc) {
        return 'El número de cédula es obligatorio.';
      }
    } else {
      if (!companyName.trim()) {
        return 'El nombre de la empresa es obligatorio.';
      }
      const cleanNit = nit.replace(/\D/g, '');
      if (!cleanNit) {
        return 'El NIT de la empresa es obligatorio (solo dígitos).';
      }
      const cleanRepDoc = legalRepDoc.replace(/\D/g, '');
      if (!cleanRepDoc) {
        return 'La cédula del representante legal es obligatoria.';
      }
    }

    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;

    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    submitting.current = true;
    setBusy(true);

    try {
      const payload: AdminClientCreateRequest = {
        person_type: personType,
        contact_name: contactName.trim(),
        phone: phone.replace(/\D/g, ''),
        plan,
        income_source: incomeSource,
      };

      if (personType === 'PERSONA') {
        payload.document_number = documentNumber.replace(/\D/g, '');
      } else {
        payload.company_name = companyName.trim();
        payload.nit = nit.replace(/\D/g, '');
        payload.legal_rep_doc = legalRepDoc.replace(/\D/g, '');
      }

      const res = await createAdminClient(payload);
      setCreated(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          setError(err.message);
        }
      } else {
        setError(NETWORK_ERROR_MESSAGE);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!created?.activation_link) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(created.activation_link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        return;
      }
    } catch {
      // Intenta con fallback si falla clipboard API
    }

    try {
      const input = document.createElement('textarea');
      input.value = created.activation_link;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  // Vista de éxito al crear el cliente
  if (created) {
    const waText = `¡Hola ${contactName}! Te damos la bienvenida a Kontable. Usa este enlace para activar tu bot en Telegram: ${created.activation_link}`;
    const waLink = clientWhatsappUrl(phone, waText);

    return (
      <section aria-label="Cliente creado" className="screen admin-screen admin-nuevo-screen">
        <div className="admin-ficha-nav">
          <Link to="/admin/clientes" className="admin-back-btn">
            ← Volver a clientes
          </Link>
        </div>

        <div className="card admin-success-card" role="status">
          <div className="admin-success-head">
            <span className="admin-success-icon" aria-hidden="true">✓</span>
            <h1 className="h-title admin-success-title">Cliente creado exitosamente</h1>
            <p className="lead">
              El cliente fue registrado en el sistema. Comparte el enlace de activación para que vincule su cuenta de Telegram.
            </p>
          </div>

          <div className="admin-activation-box">
            <label className="field-label" htmlFor="activation-link-text">
              Enlace de activación de Telegram:
            </label>
            <div className="admin-copy-row">
              <input
                id="activation-link-text"
                className="field-input admin-activation-input"
                type="text"
                readOnly
                value={created.activation_link}
              />
              <button
                type="button"
                className="btn-outline admin-btn-copy"
                onClick={handleCopy}
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className="admin-success-actions">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary admin-btn-wa"
            >
              Enviar por WhatsApp
            </a>
            <Link
              to={`/admin/clientes/${created.business_id}`}
              className="btn-outline"
            >
              Ver ficha del cliente
            </Link>
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setCreated(null);
                setContactName('');
                setPhone('');
                setDocumentNumber('');
                setCompanyName('');
                setNit('');
                setLegalRepDoc('');
                setError(null);
              }}
            >
              Crear otro cliente
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Nuevo cliente" className="screen admin-screen admin-nuevo-screen">
      <div className="admin-ficha-nav">
        <Link to="/admin/clientes" className="admin-back-btn">
          ← Volver a clientes
        </Link>
      </div>

      <div className="card admin-form-card">
        <div className="admin-form-header">
          <h1 className="h-title">Nuevo cliente</h1>
          <p className="lead">Registra un nuevo cliente y genera su enlace de activación de Telegram.</p>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Selector Persona / Empresa */}
          <div className="field">
            <label className="field-label" id="label-tipo-persona">
              Tipo de contribuyente
            </label>
            <div className="admin-toggle-group" role="radiogroup" aria-labelledby="label-tipo-persona">
              <button
                type="button"
                role="radio"
                aria-checked={personType === 'PERSONA'}
                className={`admin-toggle-btn ${personType === 'PERSONA' ? 'active' : ''}`}
                onClick={() => setPersonType('PERSONA')}
                disabled={busy}
              >
                Persona Natural
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={personType === 'EMPRESA'}
                className={`admin-toggle-btn ${personType === 'EMPRESA' ? 'active' : ''}`}
                onClick={() => setPersonType('EMPRESA')}
                disabled={busy}
              >
                Empresa
              </button>
            </div>
          </div>

          {/* Campos para Persona Natural */}
          {personType === 'PERSONA' ? (
            <>
              <div className="field">
                <label className="field-label" htmlFor="persona-nombre">
                  Nombre completo
                </label>
                <input
                  id="persona-nombre"
                  className="field-input"
                  type="text"
                  placeholder="Ej. Carlos Pérez"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="persona-celular">
                  Celular
                </label>
                <input
                  id="persona-celular"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 3001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  disabled={busy}
                />
                <span className="field-hint">10 dígitos, sin espacios ni guiones.</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="persona-cedula">
                  Cédula de ciudadanía
                </label>
                <input
                  id="persona-cedula"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 10203040"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value.replace(/\D/g, ''))}
                  disabled={busy}
                />
                <span className="field-hint">Solo números, sin puntos ni separadores.</span>
              </div>
            </>
          ) : (
            /* Campos para Empresa */
            <>
              <div className="field">
                <label className="field-label" htmlFor="empresa-contacto">
                  Nombre de contacto
                </label>
                <input
                  id="empresa-contacto"
                  className="field-input"
                  type="text"
                  placeholder="Ej. Carlos Pérez"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="empresa-celular">
                  Celular
                </label>
                <input
                  id="empresa-celular"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 3001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  disabled={busy}
                />
                <span className="field-hint">10 dígitos, sin espacios ni guiones.</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="empresa-razon">
                  Nombre de la empresa / Razón social
                </label>
                <input
                  id="empresa-razon"
                  className="field-input"
                  type="text"
                  placeholder="Ej. Panadería La Espiga SAS"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="empresa-nit">
                  NIT
                </label>
                <input
                  id="empresa-nit"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 900123456"
                  value={nit}
                  onChange={(e) => setNit(e.target.value.replace(/\D/g, ''))}
                  disabled={busy}
                />
                <span className="field-hint">Solo números, sin dígito de verificación ni puntos.</span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="empresa-rep-doc">
                  Cédula del representante legal
                </label>
                <input
                  id="empresa-rep-doc"
                  className="field-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 80123456"
                  value={legalRepDoc}
                  onChange={(e) => setLegalRepDoc(e.target.value.replace(/\D/g, ''))}
                  disabled={busy}
                />
                <span className="field-hint">Solo números, sin puntos ni separadores.</span>
              </div>
            </>
          )}

          {/* Selector de Plan */}
          <div className="field">
            <label className="field-label" htmlFor="cliente-plan">
              Plan
            </label>
            <select
              id="cliente-plan"
              className="field-input"
              value={plan}
              onChange={(e) => setPlan(e.target.value as AdminPlan)}
              disabled={busy}
            >
              <option value="TRIMESTRAL">Trimestral (3 meses)</option>
              <option value="SEMESTRAL">Semestral (6 meses)</option>
              <option value="ANUAL">Anual (12 meses)</option>
            </select>
          </div>

          {/* Selector de Tipo de negocio */}
          <div className="field">
            <label className="field-label" htmlFor="cliente-origen">
              Tipo de negocio
            </label>
            <select
              id="cliente-origen"
              className="field-input"
              value={incomeSource}
              onChange={(e) => setIncomeSource(e.target.value as AdminIncomeSource)}
              disabled={busy}
            >
              <option value="DIAN">Facturador DIAN</option>
              <option value="MANUAL_SALES">Ventas manuales</option>
            </select>
          </div>

          <div className="stack admin-form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creando cliente…' : 'Crear cliente'}
            </button>
            <Link to="/admin/clientes" className="btn-outline">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </section>
  );
}
