import { useEffect, useState } from 'react'
import { api } from '../lib/api'

type Announcement = {
  id: number
  title: string
  subtitle?: string
  body?: string
  start_date?: string
  end_date?: string
  image_url?: string
  link_url?: string
  is_active?: boolean
  sort_order?: number | null
  created_at?: string
  updated_at?: string
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Partial<Announcement>>({})
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const MAX_ITEMS = 4

  const fmtDisplayDate = (iso?: string) => {
    if (!iso) return ''
    const parts = iso.split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
  }

  const ageInfo = (a: Announcement) => {
    const base = a.start_date || a.created_at
    if (!base) return { label: '', days: 0 }
    const [y, m, d] = base.split('-').map(Number)
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1))
    const today = new Date()
    const diffDays = Math.floor((today.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(diffDays / 7)
    const label = diffDays < 7
      ? `${diffDays} día${diffDays === 1 ? '' : 's'}`
      : `${weeks} semana${weeks === 1 ? '' : 's'}`
    return { label, days: diffDays }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    try {
      const res = await api.get<Announcement[]>('/api/pms/announcements', { params: { active_only: false, limit: 50 } })
      setItems(res.data)
    } catch (e: any) {
      setError(e?.message || 'Error al cargar anuncios')
    }
  }

  const handleSave = async () => {
    setError(null)
    if (!draft.title) {
      setError('El titulo es obligatorio')
      return
    }
    if (items.length >= MAX_ITEMS) {
      setError(`Solo se permiten ${MAX_ITEMS} avisos. Elimina uno para agregar otro.`)
      return
    }
    try {
      const res = await api.post<Announcement>('/api/pms/announcements', draft)
      setItems((prev) => [res.data, ...prev].slice(0, MAX_ITEMS))
      setDraft({})
      setShowModal(false)
    } catch (e: any) {
      setError(e?.message || 'Error al guardar')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/pms/announcements/${id}`)
      setItems((prev) => prev.filter((a) => a.id !== id))
    } catch (e: any) {
      setError(e?.message || 'Error al eliminar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Novedades / Comunicados</h1>
          <p className="text-sm text-gray-500">Publica banners, saludos o retos para que se vean en la app movil.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Maximo {MAX_ITEMS} avisos activos</span>
          <button
            className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow"
            onClick={() => setShowModal(true)}
            disabled={items.length >= MAX_ITEMS}
          >
            Nueva publicación
          </button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Modal de creación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowModal(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-[95%] max-w-3xl p-4 border">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Nueva publicación</h2>
                <p className="text-sm text-gray-600">Máximo {MAX_ITEMS} avisos</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Titulo</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.title || ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Ej: Fiesta de aniversario"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Subtitulo</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.subtitle || ''}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                  placeholder="Texto corto"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium">Cuerpo</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={draft.body || ''}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Detalle o mensaje para los alumnos"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Inicio</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.start_date || ''}
                  onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Fin</label>
                <input
                  type="date"
                  className="w-full border rounded px-3 py-2"
                  value={draft.end_date || ''}
                  onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Imagen (URL)</label>
                <input
                  className="w-full border rounded px-3 py-2"
            value={draft.image_url || ''}
            onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium">Subir imagen (máx 2MB)</label>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadError(null)
              if (!file.type.startsWith('image/')) {
                setUploadError('Archivo no es una imagen')
                return
              }
              if (file.size > 2 * 1024 * 1024) {
                setUploadError('Máximo 2MB')
                return
              }
              try {
                setUploading(true)
                // Subir a backend
                const fd = new FormData()
                fd.append('file', file)
                const res = await api.post<{ url: string }>('/api/pms/announcements/upload-image', fd, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                })
                setDraft((d) => ({ ...d, image_url: res.data.url }))
              } catch (err: any) {
                setUploadError(err?.response?.data?.detail || err?.message || 'No se pudo subir la imagen')
              } finally {
                setUploading(false)
              }
            }}
          />
          {uploading && <div className="text-xs text-gray-500">Subiendo...</div>}
          {uploadError && <div className="text-xs text-red-600">{uploadError}</div>}
          {draft.image_url && (
            <div className="mt-2">
              <img src={draft.image_url} alt="preview" className="w-full max-w-xs h-32 object-cover rounded" />
            </div>
          )}
        </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Enlace (opcional)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={draft.link_url || ''}
                  onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={draft.is_active ?? true}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Activo
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-4 py-2 rounded border" onClick={() => setShowModal(false)}>Cancelar</button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded bg-fuchsia-600 text-white font-semibold shadow hover:bg-fuchsia-700 disabled:opacity-60"
                disabled={items.length >= MAX_ITEMS}
              >
                Guardar ({items.length}/{MAX_ITEMS})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Publicados</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Aun no hay novedades.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {items.map((a) => (
              <div key={a.id} className="border rounded-lg p-3 shadow-sm bg-gradient-to-br from-white to-fuchsia-50/50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{a.title}</h3>
                    {a.subtitle && <p className="text-sm text-gray-600">{a.subtitle}</p>}
                  </div>
                  {a.start_date || a.end_date ? (
                    <span className="text-xs text-gray-500">
                      {fmtDisplayDate(a.start_date) || 's/inicio'} · {fmtDisplayDate(a.end_date) || 's/fin'}
                    </span>
                  ) : null}
                </div>
                {a.image_url && (
                  <div className="mb-2">
                    <img src={a.image_url} alt={a.title} className="w-full h-32 object-cover rounded" />
                  </div>
                )}
                {a.body && <p className="text-sm text-gray-700">{a.body}</p>}
                {a.link_url && <p className="text-xs text-fuchsia-700 truncate mt-1">{a.link_url}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                  {a.sort_order != null && <span>Orden: {a.sort_order}</span>}
                  {a.is_active === false && <span className="text-rose-600">Inactivo</span>}
                  {(() => {
                    const age = ageInfo(a)
                    if (!age.label) return null
                    const warn = age.days >= 30
                    return (
                      <span className={`px-2 py-0.5 rounded-full ${warn ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {warn ? 'Alerta: ' : ''}Publicado hace {age.label}
                      </span>
                    )
                  })()}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="px-3 py-1 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
