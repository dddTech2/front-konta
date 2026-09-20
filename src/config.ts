/** Número de WhatsApp de Katerinn (solo dígitos, con indicativo). Mismo valor que el prototipo. */
const WHATSAPP_NUMBER: string =
  String(import.meta.env.VITE_KATERINN_WHATSAPP ?? '').replace(/\D/g, '') || '573001234567';

export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
