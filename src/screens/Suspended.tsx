import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { whatsappUrl } from '../config';

const DEFAULT_MESSAGE =
  'Tu suscripción se encuentra suspendida temporalmente por pago pendiente. Comunícate con Katerinn para reactivar tus reportes.';

/** Servicio Suspendido: se muestra ante un 403 o `is_blocked` de `/me`. La sesión sigue activa. */
export default function Suspended() {
  const { suspended, refreshMe, isSuspended, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<'idle' | 'answered' | 'failed'>('idle');

  async function onRetry() {
    setChecking(true);
    setOutcome('idle');
    const answered = await refreshMe();
    setChecking(false);
    setOutcome(answered ? 'answered' : 'failed');
  }

  return (
    <main className="page page-center">
      <div className="badge-circle" aria-hidden="true">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <span className="pill">SERVICIO SUSPENDIDO</span>
      <h1 className="h-title" style={{ marginTop: 10 }}>
        Acceso Suspendido
      </h1>
      <p className="lead">{suspended?.message || DEFAULT_MESSAGE}</p>

      <dl className="card" style={{ textAlign: 'left', margin: '0 0 22px' }}>
        {suspended?.plan && (
          <div className="kv">
            <dt>Plan contratado:</dt>
            <dd>{suspended.plan}</dd>
          </div>
        )}
        <div className="kv">
          <dt>Estado actual:</dt>
          <dd style={{ color: 'var(--terracota-dark)' }}>BLOQUEADO</dd>
        </div>
      </dl>

      {outcome === 'answered' && isSuspended && (
        <p className="form-info" role="status">
          Aún no vemos tu pago reflejado. Si ya pagaste, escríbele a Katerinn.
        </p>
      )}
      {outcome === 'failed' && (
        <p className="form-error" role="alert">
          No pudimos verificar tu estado. Inténtalo de nuevo en unos minutos.
        </p>
      )}

      <div className="stack">
        <a
          className="btn-primary"
          href={whatsappUrl('Hola Katerinn, deseo confirmar el pago de mi suscripción Kontable')}
          target="_blank"
          rel="noopener noreferrer"
        >
          Contactar a Katerinn por WhatsApp
        </a>
        <button className="btn-outline" type="button" onClick={onRetry} disabled={checking}>
          {checking ? 'Verificando…' : 'Ya pagué, reintentar verificación'}
        </button>
        <button className="btn-link" type="button" onClick={logout}>
          Salir
        </button>
      </div>
    </main>
  );
}
