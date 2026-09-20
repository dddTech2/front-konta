import { useAuth } from '../auth/AuthContext';
import { whatsappUrl } from '../config';

/** Sesión válida pero sin negocio aprovisionado (`/me` con `business_id` null). No hay llamadas a dashboard. */
export default function SinNegocio() {
  const { logout } = useAuth();

  return (
    <main className="page page-center">
      <div className="brand-mark" aria-hidden="true">
        K.
      </div>
      <h1 className="h-title">Estamos preparando tu cuenta</h1>
      <p className="lead">
        Ya iniciaste sesión, pero todavía no tenemos un negocio activo asociado a tu cuenta. Escríbele a
        Katerinn para que termine de configurarlo.
      </p>
      <div className="stack">
        <a
          className="btn-primary"
          href={whatsappUrl('Hola Katerinn, ya inicié sesión en Kontable pero no veo mi negocio')}
          target="_blank"
          rel="noopener noreferrer"
        >
          Contactar a Katerinn por WhatsApp
        </a>
        <button className="btn-link" type="button" onClick={logout}>
          Salir
        </button>
      </div>
    </main>
  );
}
