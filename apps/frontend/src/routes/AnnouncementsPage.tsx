import { useState } from 'react'

type Announcement = {
  id: number
  title: string
  subtitle?: string
  body?: string
  start_date?: string
  end_date?: string
  image_url?: string
  link_url?: string
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Partial<Announcement>>({})

  const handleSave = () => {
    if (!draft.title) return
    const next: Announcement = {
      id: Date.now(),
      title: draft.title,
      subtitle: draft.subtitle,
      body: draft.body,
      start_date: draft.start_date,
      end_date: draft.end_date,
      image_url: draft.image_url,
      link_url: draft.link_url,
    }
    setItems((prev) => [next, ...prev])
    setDraft({})
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Novedades / Comunicados</h1>
          <p className="text-sm text-gray-500">Publica banners, saludos de cumpleaños o retos para que se vean en la app móvil.</p>
        </div>
        <span className="text-xs text-gray-500">Futuro: conectar a API</span>
      </div>

      <div className="bg-white rounded-lg border shadow p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Título</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={draft.title || ''}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Ej: Fiesta de aniversario"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Subtítulo</label>
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
        <div className="md:col-span-2 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded bg-fuchsia-600 text-white font-semibold shadow hover:bg-fuchsia-700"
          >
            Guardar en borrador
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Borradores locales</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay novedades. Guarda un borrador para previsualizar.</p>
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
                      {a.start_date || 's/inicio'} → {a.end_date || 's/fin'}
                    </span>
                  ) : null}
                </div>
                {a.body && <p className="text-sm text-gray-700">{a.body}</p>}
                {a.link_url && <p className="text-xs text-fuchsia-700 truncate mt-1">{a.link_url}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
