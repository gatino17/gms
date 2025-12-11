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
    const label = diffDays < 7 ? `${diffDays} dia${diffDays === 1 ? '' : 's'}` : `${weeks} semana${weeks === 1 ? '' : 's'}`
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
            Nueva publicacion
          </button>
        </div>
      </div>

      {error && <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowModal(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-[95%] max-w-3xl p-0 border overflow-hidden">
            <div className="bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-3 text-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Nueva publicacion</h2>
                <p className="text-xs text-white/80">Maximo {MAX_ITEMS} avisos</p>
              </div>
              <button className="rounded-full hover:bg-white/10 px-2 py-1 text-2xl leading-none" onClick={() => setShowModal(false)}>x</button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Titulo</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-fuchsia-600">✏️</span>
                  <input
                    className="w-full border rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-fuchsia-200"
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Ej: Fiesta de aniversario"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Subtitulo</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-fuchsia-600">📝</span>
                  <input
                    className="w-full border rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-fuchsia-200"
                    value={draft.subtitle || ''}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    placeholder="Texto corto"
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Cuerpo</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  rows={4}
                  value={draft.body || ''}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  placeholder="Detalle o mensaje para los alumnos"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Inicio</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-amber-600">📅</span>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-fuchsia-200"
                    value={draft.start_date || ''}
                    onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Fin</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-amber-600">🗓️</span>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-fuchsia-200"
                    value={draft.end_date || ''}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Imagen (URL)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-indigo-600">🌐</span>
                  <input
                    className="w-full border rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-fuchsia-200"
                    value={draft.image_url || ''}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Enlace (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-indigo-600">🔗</span>
                  <input
                    className="w-full border rounded-lg px-3 py-2 pl-9 focus:ring-2 focus:ring-fuchsia-200"
                    value={draft.link_url || ''}
                    onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium">Subir imagen (max 2MB)</label>
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
                      setUploadError('Maximo 2MB')
                      return
                    }
                    try {
                      setUploading(true)
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
            <div className="mt-4 flex justify-end gap-2 px-5 pb-4">
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
