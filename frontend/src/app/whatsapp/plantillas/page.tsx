'use client';

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getSession, http } from '@/lib/api';

interface PlantillaMeta {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string | null;
  components: { type: string; format?: string; text?: string }[];
}

const etiquetaEstado = (estado: string) => {
  const etiquetas: Record<string, string> = {
    APPROVED: 'Aprobada',
    PENDING: 'En revisión',
    IN_REVIEW: 'En revisión',
    REJECTED: 'Rechazada',
    PAUSED: 'Pausada',
    DISABLED: 'Desactivada',
    PENDING_DELETION: 'Pendiente de eliminación',
  };
  return etiquetas[estado] ?? estado;
};

export default function PlantillasWhatsAppPage() {
  const session = getSession();
  const empresaId = session?.usuario.empresaId ?? '';
  const rol = String(session?.usuario.rolNombre ?? '').toUpperCase();
  const [plantillas, setPlantillas] = useState<PlantillaMeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [idioma, setIdioma] = useState('es_PE');
  const [categoria, setCategoria] = useState<'UTILITY' | 'MARKETING'>('UTILITY');
  const [encabezado, setEncabezado] = useState<'NONE' | 'IMAGE' | 'VIDEO'>('IMAGE');
  const [cuerpo, setCuerpo] = useState(
    'Hola {{1}}, te compartimos la información de la propiedad que solicitaste. Responde este mensaje si deseas más detalles.',
  );
  const [ejemplosVariables, setEjemplosVariables] = useState('cliente');
  const [muestra, setMuestra] = useState<File | null>(null);

  const variables = useMemo(
    () => [...cuerpo.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1])),
    [cuerpo],
  );
  const cantidadVariables = Math.max(0, ...variables);
  const ejemplos = ejemplosVariables.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);

  const cargarPlantillas = useCallback(async () => {
    if (!empresaId || rol !== 'ADMIN') {
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const { data } = await http.get<PlantillaMeta[]>(`/empresas/${empresaId}/whatsapp/plantillas`);
      setPlantillas(data || []);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudieron consultar las plantillas de Meta.');
    } finally {
      setCargando(false);
    }
  }, [empresaId, rol]);

  useEffect(() => {
    cargarPlantillas();
  }, [cargarPlantillas]);

  const seleccionarMuestra = (file?: File) => {
    if (!file) return;
    const imagenValida = encabezado === 'IMAGE' && ['image/jpeg', 'image/png'].includes(file.type);
    const videoValido = encabezado === 'VIDEO' && file.type === 'video/mp4';
    const maximo = encabezado === 'IMAGE' ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    if (!imagenValida && !videoValido) {
      setMuestra(null);
      setError(encabezado === 'IMAGE' ? 'La muestra debe ser JPG o PNG.' : 'La muestra debe ser MP4.');
      return;
    }
    if (file.size > maximo) {
      setMuestra(null);
      setError(encabezado === 'IMAGE' ? 'La imagen de muestra no puede superar 5 MB.' : 'El video de muestra no puede superar 16 MB.');
      return;
    }
    setError(null);
    setMuestra(file);
  };

  const enviarARevision = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setAviso(null);

    if (cantidadVariables !== ejemplos.length) {
      setError(`Escribe un ejemplo por línea para cada variable. Se necesitan ${cantidadVariables}.`);
      return;
    }
    if (encabezado !== 'NONE' && !muestra) {
      setError('Selecciona la imagen o el video de muestra que Meta revisará.');
      return;
    }
    if (encabezado === 'NONE' && muestra) {
      setError('Quita la muestra o elige Imagen/Video como encabezado.');
      return;
    }

    setEnviando(true);
    try {
      const form = new FormData();
      form.append('name', nombre.trim());
      form.append('language', idioma);
      form.append('category', categoria);
      form.append('body', cuerpo.trim());
      form.append('headerFormat', encabezado);
      form.append('bodyExamples', JSON.stringify(ejemplos));
      if (muestra) form.append('headerSample', muestra);
      const { data } = await http.post(`/empresas/${empresaId}/whatsapp/plantillas`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setAviso(`Plantilla enviada a Meta para revisión${data?.status ? ` (${etiquetaEstado(data.status)})` : ''}.`);
      setNombre('');
      setMuestra(null);
      await cargarPlantillas();
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'Meta no pudo recibir la plantilla.');
    } finally {
      setEnviando(false);
    }
  };

  if (rol !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="alert alert-warning">Solo un administrador puede crear o gestionar plantillas.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h1 className="page-title mb-0">Plantillas de WhatsApp</h1>
          <p className="page-subtitle mb-0">
            Envía mensajes a revisión y consulta el estado que devuelve Meta.
          </p>
        </div>
        <button className="btn btn-sm btn-outline-primary" onClick={cargarPlantillas} disabled={cargando}>
          <i className="bi bi-arrow-repeat me-1" />Actualizar estados
        </button>
      </div>

      <div className="alert alert-info small">
        Meta revisa cada plantilla y decide si la aprueba o rechaza; el CRM no puede aprobarla por sí mismo.
        Solo envía plantillas a clientes que aceptaron recibir mensajes. Meta puede cobrar por mensaje según
        la categoría y el país del destinatario.
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}
      {aviso && <div className="alert alert-success small">{aviso}</div>}

      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">Plantillas de la cuenta WhatsApp</div>
            <div className="card-body">
              {cargando ? (
                <div className="text-center py-4"><span className="spinner-border spinner-border-sm me-2" />Consultando Meta...</div>
              ) : plantillas.length === 0 ? (
                <p className="text-muted small mb-0">Meta todavía no devuelve plantillas para esta cuenta.</p>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {plantillas.map((plantilla) => {
                    const body = plantilla.components.find((component) => component.type.toUpperCase() === 'BODY')?.text;
                    const header = plantilla.components.find((component) => component.type.toUpperCase() === 'HEADER');
                    return (
                      <div key={`${plantilla.id}-${plantilla.language}`} className="border rounded p-3">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <strong>{plantilla.name}</strong>
                          <span className={`badge ${plantilla.status === 'APPROVED' ? 'text-bg-success' : plantilla.status === 'REJECTED' ? 'text-bg-danger' : 'text-bg-secondary'}`}>
                            {etiquetaEstado(plantilla.status)}
                          </span>
                        </div>
                        <div className="small text-muted mt-1">
                          {plantilla.category} · {plantilla.language}
                          {header?.format ? ` · Encabezado ${header.format.toLowerCase()}` : ''}
                        </div>
                        {body && <div className="small mt-2">{body}</div>}
                        {plantilla.rejected_reason && (
                          <div className="small text-danger mt-2">Motivo: {plantilla.rejected_reason}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">Crear y enviar a revisión</div>
            <div className="card-body">
              <form onSubmit={enviarARevision}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="template-name">Nombre (minúsculas y guion bajo)</label>
                  <input
                    id="template-name"
                    className="form-control"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    maxLength={512}
                    placeholder="seguimiento_propiedad"
                    required
                  />
                </div>

                <div className="row g-2 mb-3">
                  <div className="col">
                    <label className="form-label" htmlFor="template-category">Categoría</label>
                    <select id="template-category" className="form-select" value={categoria} onChange={(e) => setCategoria(e.target.value as 'UTILITY' | 'MARKETING')}>
                      <option value="UTILITY">Utilidad</option>
                      <option value="MARKETING">Marketing</option>
                    </select>
                  </div>
                  <div className="col">
                    <label className="form-label" htmlFor="template-language">Idioma</label>
                    <select id="template-language" className="form-select" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
                      <option value="es_PE">Español (Perú)</option>
                      <option value="es">Español</option>
                      <option value="en_US">Inglés (EE. UU.)</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="template-header">Encabezado</label>
                  <select
                    id="template-header"
                    className="form-select"
                    value={encabezado}
                    onChange={(e) => {
                      setEncabezado(e.target.value as 'NONE' | 'IMAGE' | 'VIDEO');
                      setMuestra(null);
                    }}
                  >
                    <option value="IMAGE">Imagen</option>
                    <option value="VIDEO">Video</option>
                    <option value="NONE">Sin medios</option>
                  </select>
                </div>

                {encabezado !== 'NONE' && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="template-sample">
                      Muestra para revisión ({encabezado === 'IMAGE' ? 'JPG/PNG, máx. 5 MB' : 'MP4, máx. 16 MB'})
                    </label>
                    <input
                      id="template-sample"
                      type="file"
                      className="form-control"
                      accept={encabezado === 'IMAGE' ? 'image/jpeg,image/png' : 'video/mp4'}
                      onChange={(e) => {
                        seleccionarMuestra(e.target.files?.[0]);
                        e.currentTarget.value = '';
                      }}
                    />
                    {muestra && <div className="form-text">{muestra.name}</div>}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label" htmlFor="template-body">Texto de la plantilla</label>
                  <textarea
                    id="template-body"
                    className="form-control"
                    rows={5}
                    maxLength={1024}
                    value={cuerpo}
                    onChange={(e) => setCuerpo(e.target.value)}
                    required
                  />
                  <div className="form-text">Usa variables posicionales como {'{{1}}'} y {'{{2}}'}.</div>
                </div>

                {cantidadVariables > 0 && (
                  <div className="mb-3">
                    <label className="form-label" htmlFor="template-examples">Ejemplos de variables (uno por línea)</label>
                    <textarea
                      id="template-examples"
                      className="form-control"
                      rows={Math.min(cantidadVariables, 4)}
                      value={ejemplosVariables}
                      onChange={(e) => setEjemplosVariables(e.target.value)}
                      placeholder={'Ana\nCasa en Pimentel'}
                    />
                    <div className="form-text">Meta requiere un ejemplo por cada variable.</div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary w-100" disabled={enviando || cargando}>
                  {enviando && <span className="spinner-border spinner-border-sm me-2" />}
                  Enviar a revisión de Meta
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
