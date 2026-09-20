/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// `base: '/app/'` porque FastAPI monta `dist/` en `/app` (FRONTEND_DIR). El enrutado es por hash,
// así que el servidor de estáticos no necesita fallback de SPA.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const proxy = { '/api': env.VITE_DEV_API || 'http://127.0.0.1:8000' };
  return {
    base: '/app/',
    plugins: [react()],
    // En desarrollo la API corre aparte (por defecto en el puerto 8000); `preview` sirve el build con el mismo proxy.
    server: { proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
