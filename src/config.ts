/** Número de WhatsApp de Katerinn (solo dígitos, con indicativo). Mismo valor que el prototipo. */
const WHATSAPP_NUMBER: string =
  String(import.meta.env.VITE_KATERINN_WHATSAPP ?? '').replace(/\D/g, '') || '573001234567';

export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Enlace de WhatsApp hacia el celular de un cliente.
 * Si el número viene con 10 dígitos (formato estándar móvil colombiano), antepone 57.
 */
export function clientWhatsappUrl(phone: string, message: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  const target = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}

