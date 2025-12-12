import { useEffect, useState } from "react"
import { api, toAbsoluteUrl } from "../lib/api"

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
  const [uploadInfo, setUploadInfo] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Record<number, boolean>>({})
  const MAX_ITEMS = 4

  const fmtDisplayDate = (iso?: string) => {
    if (!iso) return ""
    const parts = iso.split("-")
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
  }

  const parseISO = (iso?: string) => {
    if (!iso) return undefined
    const [y, m, d] = iso.split("-").map(Number)
    if (!y || !m || !d) return undefined
    return new Date(Date.UTC(y, m - 1, d))
  }

  const ageInfo = (a: Announcement) => {
    const created = parseISO(a.created_at || "")
    const start = parseISO(a.start_date)
    const end = parseISO(a.end_date)
    const today = new Date()

    if (start && start > today) {
      const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { label: `Faltan ${diff} dias`, tone: "future" as const }
    }
    if (end && today > end) {
      const diff = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24))
      return { label: `Evento vencio hace ${diff} dias`, tone: "expired" as const }
    }
    const base = start || created
    if (!base) return { label: "", tone: "ok" as const }
    const diffDays = Math.floor((today.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(diffDays / 7)
    const label = diffDays < 7 ? `${diffDays} dias` : `${weeks} semanas`
    const tone = diffDays >= 30 ? "warn" : "ok"
    return { label: `Publicado hace ${label}`, tone }
  }

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    try {
      const res = await api.get<Announcement[]>("/api/pms/announcements", { params: { active_only: false, limit: 50 } })
      setItems(res.data)
    } catch (e: any) {
      setError(e?.message || "Error al cargar anuncios")
    }
  }

  const handleSave = async () => {
    setError(null)
    if (!draft.title) {
      setError("El titulo es obligatorio")
      return
    }
    if (items.length >= MAX_ITEMS) {
      setError(`Solo se permiten ${MAX_ITEMS} avisos. Elimina uno para agregar otro.`)
      return
    }
    try {
      const res = await api.post<Announcement>("/api/pms/announcements", draft)
      setItems((prev) => [res.data, ...prev].slice(0, MAX_ITEMS))
      setDraft({})
      setShowModal(false)
    } catch (e: any) {
      setError(e?.message || "Error al guardar")
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/pms/announcements/${id}`)
      setItems((prev) => prev.filter((a) => a.id !== id))
    } catch (e: any) {
      setError(e?.message || "Error al eliminar")
    }
  }

  const handleToggleActive = async (id: number, next: boolean) => {
    try {
      setToggling((prev) => ({ ...prev, [id]: true }))
      await api.put<Announcement>(`/api/pms/announcements/${id}`, { is_active: next })
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: next } : a)))
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar el estado")
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
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
                <input
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  value={draft.title || ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Ej: Fiesta de aniversario"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Subtitulo</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  value={draft.subtitle || ''}
                  onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                  placeholder="Texto corto"
                />
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
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  value={draft.start_date || ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setDraft({ ...draft, start_date: v, end_date: draft.end_date || v })
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Fin</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  value={draft.end_date || draft.start_date || ''}
                  onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Imagen (URL)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  value={draft.image_url || ''}
                  onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Enlace (opcional)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-fuchsia-200"
                  value={draft.link_url || ''}
                  onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium">Subir imagen (max 2MB)</label>
                <label className="group flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl bg-gradient-to-r from-fuchsia-50 to-rose-50 text-sm text-gray-600 cursor-pointer hover:border-fuchsia-300 hover:bg-rose-50 transition" title="Subir imagen">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setUploadError(null)
                      setUploadInfo(null)
                      if (!file.type.startsWith('image/')) {
                        setUploadError('Archivo no es una imagen')
                        return
                      }
                      if (file.size > 2 * 1024 * 1024) {
                        setUploadError('Maximo 2MB')
                        return
                      }
                      // Validar resolución mínima 600x600
                      const tempUrl = URL.createObjectURL(file)
                      const img = new Image()
                      img.src = tempUrl
                      await new Promise<void>((resolve) => {
                        img.onload = () => resolve()
                        img.onerror = () => resolve()
                      })
                      if (img.width < 600 || img.height < 600) {
                        setUploadError('Resolucion muy baja (min 600x600)')
                        URL.revokeObjectURL(tempUrl)
                        return
                      }
                      URL.revokeObjectURL(tempUrl)
                      try {
                        setUploading(true)
                        const fd = new FormData()
                        fd.append('file', file)
                        const res = await api.post<{ url: string }>("/api/pms/announcements/upload-image", fd, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        })
                        setDraft((d) => ({ ...d, image_url: res.data.url }))
                        const sizeKB = (file.size / 1024).toFixed(0)
                        setUploadInfo(`${img.width}x${img.height}px · ${sizeKB} KB`)
                      } catch (err: any) {
                        setUploadError(err?.response?.data?.detail || err?.message || 'No se pudo subir la imagen')
                      } finally {
                        setUploading(false)
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 text-fuchsia-700 font-semibold group-hover:translate-y-[-2px] transition">
                    <span className="text-lg">?</span>
                    <span>Selecciona o arrastra tu banner</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">JPG/PNG, máximo 2MB</p>
                </label>
                {uploading && <div className="text-xs text-gray-500">Subiendo...</div>}
                {uploadError && <div className="text-xs text-red-600">{uploadError}</div>}
                {uploadInfo && <div className="text-xs text-gray-500">{uploadInfo}</div>}
                {draft.image_url && (
                  <div className="mt-2">
                    <img src={toAbsoluteUrl(draft.image_url)} alt="preview" className="w-full max-w-xs h-32 object-cover rounded-lg border border-fuchsia-100 shadow-sm" />
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

      <div className="bg-white rounded-lg border shadow p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3">Publicados</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Aun no hay novedades.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((a) => (
              <div
                key={a.id}
                className="relative border rounded-xl p-3 shadow-sm flex flex-col gap-3 bg-gradient-to-br from-rose-300 via-rose-50 to-amber-50"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-100 flex items-center gap-1">
                    <span aria-hidden>•</span> Publicacion
                  </span>
                  {a.start_date || a.end_date ? (
                    <span className="text-xs text-gray-500 text-right whitespace-nowrap flex items-center gap-1">
                      <span aria-hidden>??</span>
                      {fmtDisplayDate(a.start_date) || 's/inicio'} - {fmtDisplayDate(a.end_date) || 's/fin'}
                    </span>
                  ) : null}
                </div>
                {a.image_url && (
                  <button
                    type="button"
                    className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    onClick={() => setPreviewImage(toAbsoluteUrl(a.image_url) || null)}
                  >
                    <img
                      src={toAbsoluteUrl(a.image_url)}
                      alt={a.title}
                      className="w-full h-48 object-contain"
                    />
                  </button>
                )}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-bold text-lg leading-snug text-gray-900">{a.title}</h3>
                    {a.subtitle && <p className="text-sm text-gray-600">{a.subtitle}</p>}
                  </div>
                </div>
                {a.body && <p className="text-sm text-gray-700 leading-relaxed">{a.body}</p>}
                {a.link_url && (
                  <a
                    href={a.link_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-fuchsia-700 truncate mt-1 inline-flex items-center gap-1 hover:underline"
                  >
                    <span aria-hidden>?</span>
                    {a.link_url}
                  </a>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                  {a.sort_order != null && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700">Orden: {a.sort_order}</span>
                  )}
                  {a.is_active === false && <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-700">Inactivo</span>}
                  {(() => {
                    const age = ageInfo(a)
                    if (!age.label) return null
                    const cls =
                      age.tone === 'expired'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : age.tone === 'future'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : age.tone === 'warn'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    return (
                      <span className={`px-2 py-0.5 rounded-full ${cls}`}>
                        {age.label}
                      </span>
                    )
                  })()}
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="h-4 w-4" checked={a.is_active ?? true} onChange={(e) => handleToggleActive(a.id, e.target.checked)} />
                    <span>{a.is_active ? 'Activo' : 'Inactivo'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl font-bold"
            aria-label="Cerrar"
            onClick={() => setPreviewImage(null)}
          >
            ×
          </button>
          <img src={previewImage} alt="preview full" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  )
}
