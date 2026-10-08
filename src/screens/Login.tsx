import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError, NETWORK_ERROR_MESSAGE, requestOtp, verifyOtp } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { BRAND_NAME, BRAND_TAGLINE } from '../brand';
import { whatsappUrl } from '../config';
import isotipoClaro from '../assets/brand/isotipo-claro.svg';
import logotipoHorizontal from '../assets/brand/logotipo-horizontal-claro.svg';

type Step = 'identifier' | 'code';

const CODE_LENGTH = 6;

const LINK_EXPIRED_MESSAGE =
  'El enlace venció o no es válido. Escribe /dashboard en Telegram para recibir uno nuevo, o entra con tu código.';

interface LocationState {
  linkExpired?: boolean;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return NETWORK_ERROR_MESSAGE;
}

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    state?.linkExpired ? LINK_EXPIRED_MESSAGE : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (state?.linkExpired) {
      setError(LINK_EXPIRED_MESSAGE);
    }
  }, [state?.linkExpired]);

  const trimmed = identifier.trim();

  async function sendCode(successInfo: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await requestOtp(trimmed);
      setInfo(successInfo);
      return true;
    } catch (err) {
      setInfo(null);
      setError(messageOf(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onRequest(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || busy) return;
    if (await sendCode('Te enviamos un código de 6 dígitos a tu Telegram. Vence en 5 minutos.')) {
      setCode('');
      setStep('code');
    }
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { access_token } = await verifyOtp(trimmed, code);
      await login(access_token);
    } catch (err) {
      // 401 en verify-otp = código inválido: se muestra en el formulario, sin redirigir.
      setError(messageOf(err));
      setBusy(false);
    }
  }

  function changeIdentifier() {
    setStep('identifier');
    setCode('');
    setError(null);
    setInfo(null);
  }

  return (
    <main className="page">
      <img className="brand-mark" src={isotipoClaro} alt="" aria-hidden="true" width="64" height="64" />
      <h1 className="h-title">Ingresa a {BRAND_NAME}</h1>
      <p className="brand-tagline">{BRAND_TAGLINE}</p>

      {step === 'identifier' ? (
        <form onSubmit={onRequest} noValidate>
          <p className="lead">
            Escribe tu número de celular o el NIT de tu negocio. Te enviaremos un código por Telegram, sin
            contraseñas.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            <span className="field-label">Celular o NIT</span>
            <input
              className="field-input"
              type="text"
              inputMode="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={busy}
            />
          </label>
          <button className="btn-primary" type="submit" disabled={busy || !trimmed}>
            {busy ? 'Enviando…' : 'Enviarme el código'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} noValidate>
          <p className="lead">Escribe el código que te llegó al chat de Telegram de {BRAND_NAME}.</p>
          {info && (
            <p className="form-info" role="status">
              {info}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <label className="field">
            <span className="field-label">Código de 6 dígitos</span>
            <input
              className="field-input code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              disabled={busy}
              autoFocus
            />
          </label>
          <div className="stack">
            <button className="btn-primary" type="submit" disabled={busy || code.length !== CODE_LENGTH}>
              {busy ? 'Verificando…' : 'Entrar'}
            </button>
            <div className="row-between">
              <button
                className="btn-link"
                type="button"
                disabled={busy}
                onClick={() => void sendCode('Te enviamos un código nuevo. El anterior ya no sirve.')}
              >
                Reenviar código
              </button>
              <button className="btn-link" type="button" disabled={busy} onClick={changeIdentifier}>
                Cambiar celular o NIT
              </button>
            </div>
          </div>
        </form>
      )}

      <p className="fine-print">
        ¿No tienes Telegram vinculado?{' '}
        <a
          href={whatsappUrl(`Hola Katerinn, necesito vincular mi Telegram para entrar a ${BRAND_NAME}`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Escríbele a Katerinn
        </a>
        .
        <br />
        Este acceso es exclusivo para clientes activos de la asesoría de Katerinn Romero.
      </p>

      <footer className="login-brand-footer">
        <span>Un servicio de</span>
        <img
          src={logotipoHorizontal}
          alt="Katerinn Romero — Asesoría contable, tributaria y financiera"
          className="login-brand-logo"
        />
      </footer>
    </main>
  );
}
