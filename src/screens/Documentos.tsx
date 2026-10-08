import { useRef, useState } from 'react';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../api/client';
import { getDocumentLink, getDocuments } from '../api/endpoints';
import type { BusinessDocument } from '../api/types';
import { ResourceView } from '../components/ScreenState';
import { docTitle, openDocumentLink } from '../documents';
import { fmtBogotaDate, fmtFileSize } from '../format';
import { useResource } from '../hooks/useResource';
import '../styles/screens.css';

/**
 * Pantalla de documentos del cliente (Story 7.4b).
 * Muestra los documentos cargados por Katerinn/contador con estados de carga, vacío y error.
 * Permite abrir enlaces temporales firmados para visualizar o descargar archivos.
 */
export default function Documentos({ businessId }: { businessId: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const submitting = useRef(false);

  const { state, retry } = useResource(
    () => getDocuments(businessId),
    [businessId, reloadKey],
  );

  async function handleOpen(doc: BusinessDocument) {
    if (submitting.current) return;
    submitting.current = true;
    setBusyId(doc.id);
    setRowError(null);

    try {
      await openDocumentLink(() => getDocumentLink(businessId, doc.id));
    } catch (err) {

      if (err instanceof ApiError) {
        // 401 y 403 los resuelve apiFetch globalmente (login o servicio suspendido)
        if (err.kind !== 'unauthorized' && err.kind !== 'forbidden') {
          if (err.status === 404) {
            setRowError({ id: doc.id, message: 'Este documento ya no está disponible.' });
            setReloadKey((n) => n + 1);
          } else {
            setRowError({ id: doc.id, message: err.message });
          }
        }
      } else {
        setRowError({ id: doc.id, message: NETWORK_ERROR_MESSAGE });
      }
    } finally {
      submitting.current = false;
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Documentos" className="screen">
      <h1 className="screen-title">Documentos</h1>
      <ResourceView state={state} onRetry={retry} loadingLabel="Cargando tus documentos…">
        {(data) => {
          if (data.documents.length === 0) {
            return (
              <div className="card list-card">
                {rowError && (
                  <p className="form-error" role="alert">
                    {rowError.message}
                  </p>
                )}
                <p className="list-empty">Aún no tienes documentos cargados. Katerinn los subirá aquí.</p>
              </div>
            );
          }

          return (
            <div className="card list-card">
              {rowError && !data.documents.some((d) => d.id === rowError.id) && (
                <p className="form-error" role="alert" style={{ marginTop: '10px' }}>
                  {rowError.message}
                </p>
              )}
              <ul className="plain-list" style={{ margin: 0 }}>
                {data.documents.map((doc) => {
                  const title = docTitle(doc);
                  const hasSeparateDesc = doc.doc_type !== 'OTRO' && Boolean(doc.description?.trim());
                  const isBusy = busyId === doc.id;
                  const hasError = rowError?.id === doc.id;

                  return (
                    <li key={doc.id} className="list-row doc-row">
                      <div className="doc-info">
                        <p className="row-title">{title}</p>
                        {hasSeparateDesc && <p className="row-sub doc-desc">{doc.description}</p>}
                        <p className="row-sub">{`${fmtBogotaDate(doc.created_at)} · ${fmtFileSize(doc.size_bytes)}`}</p>
                        {hasError && (
                          <div className="doc-row-error" role="alert">
                            <span className="doc-row-error-msg">{rowError.message}</span>
                            {rowError.message !== 'Este documento ya no está disponible.' && (
                              <button
                                className="btn-link doc-retry-btn"
                                type="button"
                                disabled={busyId !== null}
                                onClick={() => void handleOpen(doc)}
                              >
                                Reintentar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="doc-actions">
                        <button
                          className="btn-outline doc-btn"
                          type="button"
                          aria-label={`Abrir ${title}`}
                          disabled={busyId !== null}
                          onClick={() => void handleOpen(doc)}
                        >
                          {isBusy ? 'Abriendo…' : 'Abrir'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }}
      </ResourceView>
    </section>
  );
}
