import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearToken, getToken, restoreToken, setToken } from './session';

afterEach(() => {
  vi.restoreAllMocks();
  clearToken();
  window.sessionStorage.clear();
});

describe('session', () => {
  it('guarda en memoria y sessionStorage, nunca en localStorage', () => {
    setToken('jwt-1');

    expect(getToken()).toBe('jwt-1');
    expect(window.sessionStorage.getItem('kontable.token')).toBe('jwt-1');
    expect(window.localStorage.length).toBe(0);
  });

  it('restoreToken recupera el token guardado tras un F5', () => {
    window.sessionStorage.setItem('kontable.token', 'jwt-guardado');

    expect(restoreToken()).toBe('jwt-guardado');
    expect(getToken()).toBe('jwt-guardado');
  });

  it('clearToken limpia memoria y sessionStorage', () => {
    setToken('jwt-1');

    clearToken();

    expect(getToken()).toBeNull();
    expect(window.sessionStorage.getItem('kontable.token')).toBeNull();
  });

  it('si sessionStorage falla, la sesión vive en memoria sin lanzar errores', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(() => setToken('jwt-1')).not.toThrow();
    expect(getToken()).toBe('jwt-1');
    expect(restoreToken()).toBe('jwt-1');
  });
});
