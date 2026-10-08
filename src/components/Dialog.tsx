import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  children: ReactNode;
  busy?: boolean;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Diálogo modal accesible (Story 8.6 AC #5).
 * - role="dialog", aria-modal="true"
 * - aria-labelledby enlazado al título
 * - Foco inicial automático o en el ref indicado
 * - Tecla Escape cierra el diálogo (si no está ocupado)
 */
export default function Dialog({
  isOpen,
  onClose,
  title,
  titleId: customTitleId,
  children,
  busy = false,
  className = '',
  initialFocusRef,
}: DialogProps) {
  const generatedId = useId();
  const titleId = customTitleId || `dialog-title-${generatedId}`;
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Foco inicial: usa el ref provisto o el primer elemento interactivo
    const timer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]',
        );
        if (focusable) {
          focusable.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onClose();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !busy) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        className={`modal card ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h2 className="h-title modal-title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
