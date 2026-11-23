'use client';

import './list.scss';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { formatDateTime, getSession, http } from '@/lib/api';

type EstadoConv = 'ATENCION_IA' | 'PENDIENTE_ASESOR' | 'ATENCION_HUMANA' | 'CERRADA';
type ModoConv = 'IA' | 'HUMANA';
type DireccionMsg = 'ENTRANTE' | 'SALIENTE';
type RemitenteTipo = 'CLIENTE' | 'ASESOR' | 'IA' | 'SISTEMA';

interface Conversacion {
  id: string;
  waContactName: string;
  waContactPhone: string;
  estado: EstadoConv;
  modoAtencion: ModoConv;
  iaActiva: boolean;
  asesorId: string | null;
  ultimaActividad: string;
  createdAt: string;
  resumenComercial: string | null;
  cliente: { id: string; nombres: string; apellidos: string; celular: string } | null;
  asesor: { id: string; nombres: string; apellidos: string } | null;
  campana: { id: string; nombreCampana: string; plataforma: string } | null;
  asignaciones: { id: string; estado: string; fechaLimiteRespuesta: string | null; alertaEscalada: boolean }[];
  _count: { mensajes: number };
}

interface Mensaje {
  id: string;
  contenido: string;
  direccion: DireccionMsg;
  remitenteTipo: RemitenteTipo;
  createdAt: string;
  mediaUrl: string | null;
}

interface ConversacionDetalle extends Omit<Conversacion, 'asignaciones'> {
  cliente: { id: string; nombres: string; apellidos: string; celular: string; correo: string | null } | null;
  campana: { id: string; nombreCampana: string; plataforma: string } | null;
  mensajes: Mensaje[];
}

const ESTADO_BADGE: Record<EstadoConv, { label: string; cls: string }> = {
  ATENCION_IA: { label: 'Atención IA', cls: 'bg-purple-100 text-purple-700' },
  PENDIENTE_ASESOR: { label: 'Pendiente asesor', cls: 'bg-amber-100 text-amber-700' },
  ATENCION_HUMANA: { label: 'Atención humana', cls: 'bg-blue-100 text-blue-700' },
  CERRADA: { label: 'Cerrada', cls: 'bg-gray-100 text-gray-600' },
};

export default function WhatsAppPage() {
  const sess = getSession();
  const empresaId = sess?.usuario.empresaId || '';
  const usuarioId = sess?.usuario.id || '';
  const rol = String(sess?.usuario.rolNombre || '').toUpperCase();

  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [buscar, setBuscar] = useState('');
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [convId, setConvId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ConversacionDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cargarConversaciones = useCallback(async () => {
    if (!empresaId) return;
    setLoadingList(true);
    setError(null);
    try {
      const params: any = { page: 1, limit: 50 };
      if (filtroEstado) params.estado = filtroEstado;
      if (buscar.trim()) params.buscar = buscar.trim();
      const { data } = await http.get<{ data: Conversacion[] }>(`/empresas/${empresaId}/whatsapp/conversaciones`, { params });
      setConversaciones(data.data || []);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudieron cargar las conversaciones.');
    } finally {
      setLoadingList(false);
    }
  }, [empresaId, filtroEstado, buscar]);

  useEffect(() => { cargarConversaciones(); }, [cargarConversaciones]);

  const cargarDetalle = useCallback(async (id: string) => {
    if (!empresaId) return;
    setLoadingDetalle(true);
    try {
      const { data } = await http.get<ConversacionDetalle>(`/empresas/${empresaId}/whatsapp/conversaciones/${id}`);
      setDetalle(data);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cargar la conversación.');
    } finally {
      setLoadingDetalle(false);
    }
  }, [empresaId]);

  useEffect(() => {
    if (convId) cargarDetalle(convId);
  }, [convId, cargarDetalle]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detalle?.mensajes.length]);

  const handleEnviar = async () => {
    if (!empresaId || !convId || !texto.trim()) return;
    setEnviando(true);
    try {
      await http.post(`/empresas/${empresaId}/whatsapp/conversaciones/${convId}/mensajes`, {
        contenido: texto.trim(),
      });
      setTexto('');
      await Promise.all([cargarDetalle(convId), cargarConversaciones()]);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo enviar el mensaje.');
    } finally {
      setEnviando(false);
    }
  };

  const handleCerrar = async () => {
    if (!empresaId || !convId) return;
    try {
      await http.patch(`/empresas/${empresaId}/whatsapp/conversaciones/${convId}/estado`, { estado: 'CERRADA' });
      await Promise.all([cargarDetalle(convId), cargarConversaciones()]);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo cerrar la conversación.');
    }
  };

  const handleReactivarIa = async () => {
    if (!empresaId || !convId) return;
    try {
      await http.patch(`/empresas/${empresaId}/whatsapp/conversaciones/${convId}/modo`, {
        modoAtencion: 'IA',
        iaActiva: true,
      });
      await Promise.all([cargarDetalle(convId), cargarConversaciones()]);
    } catch (e) {
      const err = e as AxiosError<any>;
      setError(err.response?.data?.message ?? 'No se pudo reactivar la IA.');
    }
  };

  return (
    <AppLayout>
      <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title mb-0">WhatsApp</h1>
          <p className="page-subtitle mb-0">Atiende conversaciones de clientes transferidas por la IA.</p>
        </div>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Buscar por nombre o teléfono"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            style={{ width: 220 }}
          />
          <select
            className="form-select form-select-sm"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE_ASESOR">Pendiente asesor</option>
            <option value="ATENCION_HUMANA">Atención humana</option>
            <option value="ATENCION_IA">Atención IA</option>
            <option value="CERRADA">Cerradas</option>
          </select>
          <button className="btn btn-sm btn-outline-primary" onClick={cargarConversaciones}>
            <i className="bi bi-arrow-repeat" />
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger small py-2 mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2" />{error}
        </div>
      )}

      <div className="wa-container">
        <div className="wa-grid">
          {/* Lista de conversaciones */}
          <div className="wa-col">
            <div className="wa-col-header d-flex align-items-center justify-content-between">
              <span className="fw-semibold small">Conversaciones ({conversaciones.length})</span>
            </div>
            <div className="wa-list">
              {loadingList && (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm me-2" /> Cargando...
                </div>
              )}
              {!loadingList && conversaciones.length === 0 && (
                <div className="wa-empty py-5">
                  <i className="bi bi-whatsapp fs-1" />
                  <span className="small">Sin conversaciones</span>
                </div>
              )}
              {conversaciones.map((c) => {
                const badge = ESTADO_BADGE[c.estado];
                const esPendiente = c.estado === 'PENDIENTE_ASESOR';
                return (
                  <div
                    key={c.id}
                    className={`wa-item ${convId === c.id ? 'active' : ''} ${esPendiente ? 'unread' : ''}`}
                    onClick={() => setConvId(c.id)}
                  >
                    <div className="wa-item-name">
                      <span className="text-truncate">{c.waContactName || 'Sin nombre'}</span>
                      <span className={`wa-badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="wa-item-phone">
                      <i className="bi bi-telephone me-1" />{c.waContactPhone}
                      {c.asesor && <span className="ms-2">· {c.asesor.nombres}</span>}
                    </div>
                    {c.campana && (
                      <div className="wa-item-campana">
                        <i className="bi bi-megaphone-fill me-1" />{c.campana.nombreCampana}
                      </div>
                    )}
                    <div className="wa-item-preview">
                      {c.resumenComercial || `${c._count.mensajes} mensaje(s) · ${formatDateTime(c.ultimaActividad)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vista de chat */}
          <div className="wa-col">
            {!convId && (
              <div className="wa-empty">
                <i className="bi bi-chat-left-text fs-1" />
                <span className="small">Selecciona una conversación para ver el chat</span>
              </div>
            )}

            {convId && !detalle && loadingDetalle && (
              <div className="wa-empty">
                <div className="spinner-border" />
                <span className="small mt-2">Cargando conversación...</span>
              </div>
            )}

            {convId && detalle && (
              <>
                <div className="wa-chat-header">
                  <div className="min-w-0">
                    <div className="fw-semibold">{detalle.waContactName || 'Sin nombre'}</div>
                    <div className="text-muted small">
                      <i className="bi bi-telephone me-1" />{detalle.waContactPhone}
                      {detalle.cliente?.nombres && (
                        <span className="ms-2">· {detalle.cliente.nombres} {detalle.cliente.apellidos}</span>
                      )}
                    </div>
                    {detalle.campana && (
                      <div className="wa-campana-badge">
                        <i className="bi bi-megaphone-fill" />{detalle.campana.nombreCampana}
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-shrink-0">
                    <span className={`wa-badge ${ESTADO_BADGE[detalle.estado].cls}`}>
                      {ESTADO_BADGE[detalle.estado].label}
                    </span>
                    {detalle.estado !== 'CERRADA' && (
                      <button className="btn btn-sm btn-outline-secondary" onClick={handleCerrar} title="Cerrar conversación">
                        <i className="bi bi-x-circle" />
                      </button>
                    )}
                    {detalle.modoAtencion === 'HUMANA' && (
                      <button className="btn btn-sm btn-outline-purple" onClick={handleReactivarIa} title="Reactivar IA">
                        <i className="bi bi-robot" /> IA
                      </button>
                    )}
                  </div>
                </div>

                <div className="wa-messages">
                  {detalle.mensajes.map((m) => {
                    const esEntrante = m.direccion === 'ENTRANTE';
                    const clase = esEntrante ? 'cliente' : m.remitenteTipo === 'IA' ? 'ia' : 'asesor';
                    const autor = esEntrante ? 'Cliente' : m.remitenteTipo === 'IA' ? 'IA' : 'Asesor';
                    return (
                      <div key={m.id} className={`wa-msg ${clase}`}>
                        {!esEntrante && (
                          <div className="text-end" style={{ fontSize: '.65rem', color: m.remitenteTipo === 'IA' ? '#6d28d9' : '#15803d', fontWeight: 600, marginBottom: 2 }}>
                            {autor}
                          </div>
                        )}
                        <div>{m.contenido}</div>
                        {m.mediaUrl && (
                          <div className="mt-2">
                            {m.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={m.mediaUrl} alt="media" style={{ maxWidth: 200, borderRadius: 8 }} />
                            ) : (
                              <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="small">
                                <i className="bi bi-paperclip" /> Archivo adjunto
                              </a>
                            )}
                          </div>
                        )}
                        <div className="wa-msg-meta">{formatDateTime(m.createdAt)}</div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="wa-composer">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Escribe un mensaje al cliente..."
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
                    disabled={enviando || detalle.estado === 'CERRADA'}
                  />
                  <button
                    className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                    onClick={handleEnviar}
                    disabled={enviando || !texto.trim() || detalle.estado === 'CERRADA'}
                  >
                    {enviando && <span className="spinner-border spinner-border-sm" />}
                    <i className="bi bi-send" />
                    <span className="d-none d-sm-inline">Enviar</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
