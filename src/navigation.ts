/** Navega la pestaña actual a otra URL. Aislado en su propio módulo para poder simularlo en pruebas (jsdom no deja redefinir `location.assign`). */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
