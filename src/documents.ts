import { apiUrl } from './api/client';
import type { DocumentType } from './api/types';
import { navigateTo } from './navigation';

/**
 * Etiquetas legibles para los tipos de documentos conocidos (Story 7.4b y 8.7).
 */
export const DOC_TYPE_LABELS: Record<Exclude<DocumentType, 'OTRO'>, string> = {
  RUT: 'RUT',
  CAMARA_COMERCIO: 'Cámara de comercio',
  CEDULA_REPRESENTANTE: 'Cédula del representante',
  CERTIFICACION_BANCARIA: 'Certificación bancaria',
};

export const ALL_DOC_TYPE_LABELS: Record<string, string> = {
  ...DOC_TYPE_LABELS,
  OTRO: 'Otro',
};

export function docTypeLabel(docType: string): string {
  return ALL_DOC_TYPE_LABELS[docType] ?? docType;
}

/**
 * Título o nombre legible de un documento: si es OTRO usa su descripción; si no, su tipo legible.
 */
export function docTitle(doc: { doc_type: string; description?: string | null }): string {
  if (doc.doc_type === 'OTRO') {
    return doc.description?.trim() || 'Otro documento';
  }
  return DOC_TYPE_LABELS[doc.doc_type as Exclude<DocumentType, 'OTRO'>] ?? doc.doc_type;
}

/**
 * Opciones para formularios de subida de documentos.
 */
export const DOCUMENT_TYPE_OPTIONS: Array<{ value: DocumentType; label: string }> = [
  { value: 'RUT', label: 'RUT' },
  { value: 'CAMARA_COMERCIO', label: 'Cámara de comercio' },
  { value: 'CEDULA_REPRESENTANTE', label: 'Cédula del representante' },
  { value: 'CERTIFICACION_BANCARIA', label: 'Certificación bancaria' },
  { value: 'OTRO', label: 'Otro' },
];

/**
 * Abre síncronamente una pestaña para evitar el bloqueo de ventanas emergentes tras await,
 * solicita el enlace firmado temporal a través de `fetchLink` y redirige.
 * Si window.open devuelve null o falla, redirige en la pestaña actual usando `navigateTo`.
 * Ante cualquier error, cierra el popup emergente y propaga el error.
 */
export async function openDocumentLink(fetchLink: () => Promise<{ url: string }>): Promise<void> {
  let popup: Window | null = null;
  try {
    popup = window.open('', '_blank');
  } catch {
    popup = null;
  }

  try {
    const { url } = await fetchLink();
    const destination = apiUrl(url);
    if (popup) {
      popup.location.href = destination;
    } else {
      navigateTo(destination);
    }
  } catch (err) {
    if (popup) {
      try {
        popup.close();
      } catch {
        // Ignorar error al cerrar pestaña en navegadores que restringen script close
      }
    }
    throw err;
  }
}

/**
 * Validación de tamaño de archivo (máximo 10 MB).
 */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Tipos MIME aceptados para subida de documentos.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

/**
 * Verifica si el archivo tiene un tipo permitido por MIME o extensión de archivo.
 */
export function isAllowedDocumentType(file: File): boolean {
  if (file.type && ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
    return true;
  }
  const lowerName = file.name.toLowerCase();
  return (
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png')
  );
}
