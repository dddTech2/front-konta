import { useState, type FormEvent } from 'react';
import { BRAND_NAME, BRAND_SLOGAN } from '../../brand';
import isotipoClaro from '../../assets/brand/isotipo-claro.svg';

type Step = 'identifier' | 'code';

const CODE_LENGTH = 6;

/**
 * Ingreso simulado de la demostración (Story 10.7): misma apariencia que `Login`, sin llamar a la API.
 * Acepta cualquier celular/NIT y cualquier código.
 */
export default function DemoLogin({ onEnter }: { onEnter: () => void }) {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');

  const trimmed = identifier.trim();

  function onRequest(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    setCode('');
    setStep('code');
  }

  function onVerify(event: FormEvent) {
    event.preventDefault();
    if (!code) return;
    onEnter();
  }

  return (
    <main className="page demo-login">
      <img className="brand-mark" src={isotipoClaro} alt="" aria-hidden="true" width="64" height="64" />
      <h1 className="h-title">Ingresa a {BRAND_NAME}</h1>
      <p className="brand-tagline">{BRAND_SLOGAN}</p>

      {step === 'identifier' ? (
        <form onSubmit={onRequest} noValidate>
          <p className="lead">
            Escribe tu número de celular o el NIT de tu negocio. Te enviaremos un código por Telegram, sin
            contraseñas.
          </p>
          <label className="field">
            <span className="field-label">Celular o NIT</span>
            <input
              className="field-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />
          </label>
          <button className="btn-primary" type="submit" disabled={!trimmed}>
            Enviarme el código
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} noValidate>
          <p className="lead">Escribe el código que te llegó al chat de Telegram de {BRAND_NAME}.</p>
          <p className="form-info" role="status">
            Te enviamos un código de 6 dígitos a tu Telegram. Vence en 5 minutos.
          </p>
          <label className="field">
            <span className="field-label">Código de 6 dígitos</span>
            <input
              className="field-input code"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              autoFocus
            />
          </label>
          <div className="stack">
            <button className="btn-primary" type="submit" disabled={!code}>
              Entrar
            </button>
            <div className="row-between">
              <button className="btn-link" type="button" onClick={() => setCode('')}>
                Reenviar código
              </button>
              <button className="btn-link" type="button" onClick={() => setStep('identifier')}>
                Cambiar celular o NIT
              </button>
            </div>
          </div>
        </form>
      )}
    </main>
  );
}
