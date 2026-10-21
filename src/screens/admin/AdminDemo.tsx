import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminPricing } from '../../api/adminEndpoints';
import type { AdminPricingPlan, AdminPricingQuote, AdminPricingResponse, SaleResponse } from '../../api/types';
import { DemoAuthProvider } from '../../auth/AuthContext';
import { BRAND_NAME } from '../../brand';
import isotipoOscuro from '../../assets/brand/isotipo-oscuro.svg';
import { clientSections } from '../../clientSections';
import SalesForm from '../../components/SalesForm';
import SalesMenuItem from '../../components/SalesMenuItem';
import { DEMO_PROFILES, type DemoProfileId } from '../../demo/demoData';
import { fmtMoney, fmtMoneyExact, fmtPercent } from '../../format';
import Calendario from '../Calendario';
import Dashboard from '../Dashboard';
import Documentos from '../Documentos';
import Historial from '../Historial';
import IvaDetail from '../IvaDetail';
import Resumen from '../Resumen';
import { incomeSourceLabel, packageLabel, planLabel } from './labels';

const PROFILE_IDS: DemoProfileId[] = ['con-iva-fe', 'sin-iva-fe', 'sin-iva-ventas', 'sin-iva-mixto'];

export default function AdminDemo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const perfilParam = searchParams.get('perfil') as DemoProfileId | null;

  const currentProfileId: DemoProfileId =
    perfilParam && PROFILE_IDS.includes(perfilParam) ? perfilParam : 'con-iva-fe';

  const profile = DEMO_PROFILES[currentProfileId];
  const sections = clientSections(profile.me);

  // Pestaña activa dentro del marco simulado
  const [activeTab, setActiveTab] = useState<string>(() => sections[0]?.path ?? '/inicio');

  // Al cambiar de perfil se muestra su pantalla principal
  const firstTab = sections[0]?.path ?? '/inicio';
  useEffect(() => {
    setActiveTab(firstTab);
  }, [currentProfileId, firstTab]);

  // Modo presentación (pantalla completa sin selector ni precios)
  const [isPresentation, setIsPresentation] = useState(false);

  // Formulario y confirmación de ventas para perfiles con ventas manuales
  const [salesOpen, setSalesOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<SaleResponse | null>(null);
  const [salesVersion, setSalesVersion] = useState(0);

  // Tarifas vigentes desde /api/admin/pricing (único dato real)
  const [pricing, setPricing] = useState<AdminPricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState(false);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingError(false);
    try {
      const data = await getAdminPricing();
      setPricing(data);
    } catch {
      setPricingError(true);
    } finally {
      setPricingLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPricing();
  }, [fetchPricing]);

  // Tecla Esc para salir del modo presentación (AC #7)
  useEffect(() => {
    if (!isPresentation) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsPresentation(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPresentation]);

  function handleSelectProfile(id: DemoProfileId) {
    setSearchParams({ perfil: id });
    setConfirmation(null);
    setSalesOpen(false);
  }

  function onSaleRegistered(sale: SaleResponse) {
    setSalesOpen(false);
    setConfirmation(sale);
    setSalesVersion((n) => n + 1);
  }

  // Intercepción en fase de captura para enlaces internos dentro del marco (AC #3, Dev Note #72)
  function handleFrameClickCapture(e: MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest('a[href]');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    try {
      const url = new URL(href, window.location.origin);
      // Con HashRouter (producción) el enlace llega como "#/calendario"; en pruebas, como "/calendario".
      const pathname = url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : url.pathname;
      const matching = sections.find((s) => s.path === pathname);
      e.preventDefault();
      if (matching) {
        setActiveTab(matching.path);
      }
    } catch {
      e.preventDefault();
    }
  }

  // Renderizador de pantallas según la pestaña seleccionada
  function renderScreen(path: string) {
    const bizId = profile.me.business_id!;
    switch (path) {
      case '/inicio':
        return <Dashboard businessId={bizId} />;
      case '/iva':
        return <IvaDetail businessId={bizId} />;
      case '/historial':
        return <Historial businessId={bizId} />;
      case '/calendario':
        return <Calendario businessId={bizId} />;
      case '/documentos':
        return <Documentos businessId={bizId} />;
      case '/resumen':
        return <Resumen businessId={bizId} refreshKey={salesVersion} />;
      default:
        return null;
    }
  }

  // Tarifas del paquete actual
  const currentRate = pricing?.rates.find((r) => r.package === profile.package);
  const activePlans = pricing?.plans.filter((p) => p.is_active) ?? [];
  const packageQuotes = pricing?.quotes.filter((q) => q.package === profile.package) ?? [];

  return (
    <div className={`admin-demo ${isPresentation ? 'admin-demo-presenting' : ''}`}>
      <div className="admin-demo-header">
        <div>
          <h1 className="admin-demo-title">Demostración</h1>
          {!isPresentation && (
            <p className="admin-demo-sub">
              Muestra a los prospectos cómo funciona Konta para cada tipo de cliente con datos de ejemplo.
            </p>
          )}
        </div>
        <div className="admin-demo-actions">
          {isPresentation ? (
            <button
              type="button"
              className="btn-outline demo-btn-exit"
              onClick={() => setIsPresentation(false)}
            >
              Salir de la presentación
            </button>
          ) : (
            <button
              type="button"
              className="btn-outline demo-btn-present"
              onClick={() => setIsPresentation(true)}
            >
              Presentar
            </button>
          )}
        </div>
      </div>

      {/* Selector de 4 opciones (AC #2), oculto en modo presentación */}
      {!isPresentation && (
        <div className="demo-selector-group" role="tablist" aria-label="Tipos de cliente para demostración">
          {PROFILE_IDS.map((id) => {
            const p = DEMO_PROFILES[id];
            const isSelected = id === currentProfileId;
            const labelText = `${packageLabel(p.package)} · ${incomeSourceLabel(p.incomeSource)}`;

            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`demo-selector-btn ${isSelected ? 'active' : ''}`}
                onClick={() => handleSelectProfile(id)}
              >
                {labelText}
              </button>
            );
          })}
        </div>
      )}

      {/* Vista principal: Marco del cliente + Qué incluye */}
      <div className="demo-content-layout">
        {/* Marco de celular del cliente (AC #3) */}
        <section className="demo-phone-wrapper" aria-label="Vista del cliente en celular">
          <div className="demo-phone" onClickCapture={handleFrameClickCapture}>
            <div className="demo-ribbon" role="status">
              Demostración · datos de ejemplo
            </div>

            <DemoAuthProvider me={profile.me}>
              <div className="shell">
                <header className="shell-header">
                  <div className="row-between">
                    <span className="shell-brand">
                      <img
                        src={isotipoOscuro}
                        alt=""
                        aria-hidden="true"
                        className="shell-logo"
                        width="32"
                        height="32"
                      />
                      {BRAND_NAME}
                    </span>
                    <div className="shell-actions">
                      <SalesMenuItem onOpen={() => setSalesOpen(true)} />
                    </div>
                  </div>
                </header>

                {confirmation && (
                  <div className="sale-confirmation" role="status">
                    <span>Venta registrada por {fmtMoneyExact(confirmation.total_amount)}.</span>
                    <button className="btn-link" type="button" onClick={() => setConfirmation(null)}>
                      Cerrar
                    </button>
                  </div>
                )}

                {salesOpen && (
                  <SalesForm
                    businessId={profile.me.business_id!}
                    onClose={() => setSalesOpen(false)}
                    onRegistered={onSaleRegistered}
                  />
                )}

                <nav className="shell-nav" aria-label="Secciones">
                  {sections.map((s) => (
                    <a
                      key={s.path}
                      href={s.path}
                      className={activeTab === s.path ? 'active' : ''}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(s.path);
                      }}
                    >
                      {s.label}
                    </a>
                  ))}
                </nav>

                <main className="shell-main">{renderScreen(activeTab)}</main>
              </div>
            </DemoAuthProvider>
          </div>
        </section>

        {/* Panel lateral: Qué incluye este paquete (AC #6) */}
        <aside className="demo-info-panel" aria-label="Qué incluye este paquete">
          <div className="card demo-info-card">
            <div className="demo-info-section">
              <span className="demo-badge">
                {packageLabel(profile.package)} · {incomeSourceLabel(profile.incomeSource)}
              </span>
              <p className="demo-line-text">{profile.lineText}</p>
              <p className="demo-business-name">
                Negocio de ejemplo: <strong>{profile.name}</strong>
              </p>
            </div>

            <div className="demo-info-section">
              <h2 className="demo-section-heading">Qué incluye este paquete</h2>
              <ul className="demo-features-list">
                {profile.includes.map((feat, idx) => (
                  <li key={idx} className="demo-feature-item">
                    <span className="demo-check-icon" aria-hidden="true">
                      ✓
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="demo-info-section">
              <h2 className="demo-section-heading">En Telegram</h2>
              <dl className="demo-telegram-list">
                {profile.telegramCommands.map((item) => (
                  <div key={item.command} className="demo-telegram-item">
                    <dt className="demo-telegram-cmd">{item.command}</dt>
                    <dd className="demo-telegram-desc">{item.description}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Precio: solo visible en modo normal, no en modo presentación (AC #6, #7) */}
            {!isPresentation && (
              <div className="demo-info-section demo-pricing-section">
                <h2 className="demo-section-heading">Precio</h2>

                {pricingLoading && <p className="demo-pricing-loading">Cargando tarifas…</p>}

                {pricingError && (
                  <div className="demo-pricing-error" role="alert">
                    <span>No pudimos cargar las tarifas</span>
                    <button
                      type="button"
                      className="btn-link demo-retry-pricing"
                      onClick={() => void fetchPricing()}
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {!pricingLoading && !pricingError && (
                  <div className="demo-pricing-content">
                    {currentRate && (
                      <div className="demo-current-rate">
                        <span className="demo-rate-label">Tarifa mensual vigente</span>
                        <span className="demo-rate-amount">
                          {fmtMoney(Number(currentRate.monthly_price))} / mes
                        </span>
                      </div>
                    )}

                    <div className="demo-plans-list">
                      <span className="demo-plans-title">Planes para cliente nuevo</span>
                      {activePlans.map((plan: AdminPricingPlan) => {
                        const quote = packageQuotes.find((q: AdminPricingQuote) => q.plan === plan.code);
                        const discount = Number(plan.discount_rate);
                        return (
                          <div key={plan.code} className="demo-plan-row">
                            <span className="demo-plan-name">
                              {planLabel(plan.code, activePlans)}
                              {discount > 0 && (
                                <span className="demo-plan-discount">
                                  ({fmtPercent(discount)}% dto)
                                </span>
                              )}
                            </span>
                            <span className="demo-plan-price">
                              {quote ? fmtMoney(Number(quote.final_price)) : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
