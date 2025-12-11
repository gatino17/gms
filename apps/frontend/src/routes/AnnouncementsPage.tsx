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
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Partial<Announcement>>({})
  const [error, setError] = useState<string | null>(null)
  const MAX_ITEMS = 4

  const fmtDisplayDate = (iso?: string) => {
    if (!iso) return ''
    const parts = iso.split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
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
        <span className="text-xs text-gray-500">Maximo {MAX_ITEMS} avisos activos</span>
      </div>

      {error && <div className="px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border shadow p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div className="space-y-2">
          <label className="block text-sm font-medium">Enlace (opcional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={draft.link_url || ''}
            onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Orden</label>
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={draft.sort_order ?? ''}
            onChange={(e) => setDraft({ ...draft, sort_order: e.target.value === '' ? undefined : Number(e.target.value) })}
            placeholder="Ej: 1"
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
        <div className="md:col-span-2 flex justify-end">
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
