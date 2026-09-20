/**
 * Almacén del JWT: memoria + `sessionStorage` (sobrevive a F5, muere al cerrar la pestaña).
 * Nunca `localStorage`. Si `sessionStorage` no está disponible, la sesión vive solo en memoria.
 */
const STORAGE_KEY = 'kontable.token';

let memoryToken: string | null = null;

export function getToken(): string | null {
  return memoryToken;
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // sin sessionStorage: la sesión vive solo en memoria
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}

/** Carga el token guardado en `sessionStorage` a memoria; devuelve el token o null. */
export function restoreToken(): string | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    memoryToken = stored || null;
  } catch {
    // se conserva lo que haya en memoria
  }
  return memoryToken;
}
