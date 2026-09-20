import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from './routerFuture';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter future={ROUTER_FUTURE}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
);
