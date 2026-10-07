import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { linkLogin } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Entrar() {
  const { token } = useParams<{ token: string }>();
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function handleExchange() {
      if (!token) {
        logout();
        navigate('/login', { replace: true, state: { linkExpired: true } });
        return;
      }

      try {
        const { access_token } = await linkLogin(token);
        if (!active) return;
        await login(access_token);
        if (!active) return;
        navigate('/', { replace: true });
      } catch {
        if (!active) return;
        logout();
        navigate('/login', { replace: true, state: { linkExpired: true } });
      }
    }

    void handleExchange();

    return () => {
      active = false;
    };
  }, [token, login, logout, navigate]);

  return <p className="loading">Entrando…</p>;
}
