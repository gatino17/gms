import { useEffect, useMemo, useState } from "react"
import { api, toAbsoluteUrl } from "../lib/api"
import {
  HiOutlineCalendar,
  HiOutlineExternalLink,
  HiOutlinePencilAlt,
  HiOutlinePhotograph,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineX,
} from "react-icons/hi"

type Announcement = {
  id: number
  title: string
  subtitle?: string | null
  body?: string | null
  announcement_type?: string | null
  audience?: string | null
  start_date?: string | null
  end_date?: string | null
  image_url?: string | null
  link_url?: string | null
  is_active?: boolean
  created_at?: string | null
}

const ANNOUNCEMENT_TYPES = [
  { value: "important", label: "Aviso importante", badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100" },
  { value: "promotion", label: "Promocion", badge: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { value: "event", label: "Evento", badge: "bg-blue-50 text-blue-700 border-blue-100" },
  { value: "schedule", label: "Cambio de horario", badge: "bg-amber-50 text-amber-700 border-amber-100" },
  { value: "payment", label: "Recordatorio de pago", badge: "bg-purple-50 text-purple-700 border-purple-100" },
  { value: "holiday", label: "Feriado", badge: "bg-rose-50 text-rose-700 border-rose-100" },
]

const ANNOUNCEMENT_AUDIENCES = [
  { value: "both", label: "Alumnos y profes", shortLabel: "Todos", badge: "bg-slate-50 text-slate-700 border-slate-100" },
  { value: "students", label: "Solo alumnos", shortLabel: "Alumnos", badge: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100" },
  { value: "teachers", label: "Solo profesores", shortLabel: "Profes", badge: "bg-blue-50 text-blue-700 border-blue-100" },
]

const announcementType = (value?: string | null) =>
  ANNOUNCEMENT_TYPES.find((item) => item.value === value) || ANNOUNCEMENT_TYPES[0]

const announcementAudience = (value?: string | null) =>
  ANNOUNCEMENT_AUDIENCES.find((item) => item.value === value) || ANNOUNCEMENT_AUDIENCES[0]

const fmtDisplayDate = (iso?: string | null) => iso ? iso.split("-").reverse().join("/") : "Sin fecha"
const todayYMD = () => new Date().toISOString().slice(0, 10)

const parseYMD = (value?: string | null) => {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

const isActiveNow = (item: Announcement) => {
  if (!item.is_active) return false
  const now = parseYMD(todayYMD())!
  const start = parseYMD(item.start_date)
  const end = parseYMD(item.end_date)
  if (start && start > now) return false
  if (end && end < now) return false
  return true
}

const isCurrentMonth = (item: Announcement) => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const start = parseYMD(item.start_date) || (item.created_at ? new Date(item.created_at) : monthStart)
  const end = parseYMD(item.end_date) || monthEnd
  return start <= monthEnd && end >= monthStart
}

const daysUntilEnd = (item: Announcement) => {
  const end = parseYMD(item.end_date)
  if (!end) return null
  const now = parseYMD(todayYMD())!
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

const emptyDraft: Partial<Announcement> = {
  announcement_type: "important",
  audience: "both",
  is_active: true,
  start_date: todayYMD(),
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Partial<Announcement>>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<Announcement[]>("/api/pms/announcements", { params: { active_only: false, limit: 50 } })
      setItems(res.data || [])
    } catch (e: any) {
      setError(e?.message || "Error al cargar anuncios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const metrics = useMemo(() => {
    const active = items.filter(isActiveNow)
    const month = items.filter((item) => isActiveNow(item) && isCurrentMonth(item))
    const students = active.filter((item) => item.audience === "students" || item.audience === "both" || !item.audience)
    const teachers = active.filter((item) => item.audience === "teachers" || item.audience === "both" || !item.audience)
    const soon = active.filter((item) => {
      const days = daysUntilEnd(item)
      return days != null && days >= 0 && days <= 7
    })
    return { active, month, students, teachers, soon }
  }, [items])

  const grouped = useMemo(() => ({
    both: items.filter((item) => (item.audience || "both") === "both"),
    students: items.filter((item) => item.audience === "students"),
    teachers: items.filter((item) => item.audience === "teachers"),
  }), [items])

  const openCreate = () => {
    setEditingId(null)
    setDraft({ ...emptyDraft, start_date: todayYMD() })
    setShowModal(true)
  }

  const openEdit = (item: Announcement) => {
    setEditingId(item.id)
    setDraft({
      title: item.title,
      subtitle: item.subtitle || "",
      body: item.body || "",
      announcement_type: item.announcement_type || "important",
      audience: item.audience || "both",
      start_date: item.start_date || "",
      end_date: item.end_date || "",
      image_url: item.image_url || "",
      link_url: item.link_url || "",
      is_active: item.is_active ?? true,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setDraft({ ...emptyDraft, start_date: todayYMD() })
  }

  const buildPayload = () => ({
    title: (draft.title || "").trim(),
    subtitle: draft.subtitle || null,
    body: draft.body || null,
    announcement_type: draft.announcement_type || "important",
    audience: draft.audience || "both",
    start_date: draft.start_date || null,
    end_date: draft.end_date || null,
    image_url: draft.image_url || null,
    link_url: draft.link_url || null,
    is_active: draft.is_active ?? true,
  })

  const handleSave = async () => {
    const payload = buildPayload()
    if (!payload.title) return
    setError(null)
    try {
      if (editingId) {
        const res = await api.put<Announcement>(`/api/pms/announcements/${editingId}`, payload)
        setItems((prev) => prev.map((item) => item.id === editingId ? res.data : item))
      } else {
        const res = await api.post<Announcement>("/api/pms/announcements", payload)
        setItems((prev) => [res.data, ...prev])
      }
      closeModal()
    } catch (e: any) {
      setError(e?.message || "Error al guardar anuncio")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminar anuncio?")) return
    try {
      await api.delete(`/api/pms/announcements/${id}`)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (e: any) {
      setError(e?.message || "Error al eliminar anuncio")
    }
  }

  const handleToggleActive = async (id: number, next: boolean) => {
    try {
      await api.put<Announcement>(`/api/pms/announcements/${id}`, { is_active: next })
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, is_active: next } : item))
    } catch (e: any) {
      setError(e?.message || "Error al cambiar estado")
    }
  }

  const renderAnnouncementCard = (item: Announcement, compact = false) => {
    const image = toAbsoluteUrl(item.image_url)
    const type = announcementType(item.announcement_type)
    const audience = announcementAudience(item.audience)
    const active = isActiveNow(item)
    const days = daysUntilEnd(item)

    return (
      <article key={item.id} className="group overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/80">
        <div className={`relative ${compact ? "h-24" : "h-36"} cursor-pointer overflow-hidden bg-gray-50`} onClick={() => image && setPreviewImage(image)}>
          {image ? (
            <img src={image} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={item.title} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-200"><HiOutlinePhotograph size={40} /></div>
          )}
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleActive(item.id, !item.is_active) }}
              className={`flex h-6 w-10 items-center rounded-full p-1 transition-colors backdrop-blur-md ${item.is_active ? "bg-emerald-500/85" : "bg-gray-400/85"}`}
            >
              <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${item.is_active ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div className="flex gap-2 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
              <button onClick={(e) => { e.stopPropagation(); openEdit(item) }} className="rounded-xl bg-white/90 p-2 text-fuchsia-600 shadow-sm backdrop-blur-md transition hover:bg-white">
                <HiOutlinePencilAlt size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }} className="rounded-xl bg-rose-500/85 p-2 text-white backdrop-blur-md transition hover:bg-rose-600">
                <HiOutlineTrash size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4 md:p-5">
          <div className="flex flex-wrap gap-2">
            <span className={`w-fit rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${type.badge}`}>{type.label}</span>
            <span className={`w-fit rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${audience.badge}`}>{audience.label}</span>
            <span className={`w-fit rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${active ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-gray-100 bg-gray-50 text-gray-500"}`}>{active ? "Activo" : "Inactivo"}</span>
          </div>
          <div>
            <h3 className="line-clamp-2 text-base font-black leading-tight text-gray-950 md:text-lg">{item.title}</h3>
            {item.subtitle ? <p className="mt-1 text-xs font-black text-fuchsia-600">{item.subtitle}</p> : null}
          </div>
          <p className="line-clamp-3 flex-1 text-[11px] font-semibold leading-5 text-gray-500 md:text-xs">{item.body || "Sin descripcion"}</p>
          <div className="border-t border-gray-50 pt-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 text-[9px] font-black uppercase tracking-widest text-gray-800">
              <HiOutlineCalendar size={13} className="text-fuchsia-500" />
              {fmtDisplayDate(item.start_date)} - {item.end_date ? fmtDisplayDate(item.end_date) : "Este mes"}
            </div>
            {days != null && days >= 0 && days <= 7 ? (
              <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-rose-500">Vence en {days} dias</p>
            ) : null}
            {item.link_url ? (
              <a href={item.link_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-fuchsia-600 hover:text-fuchsia-700">
                Mas informacion <HiOutlineExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  const renderSection = (title: string, subtitle: string, data: Announcement[], accent: string) => (
    <section className="rounded-[32px] border border-gray-100 bg-white/80 p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.24em] ${accent}`}>{subtitle}</p>
          <h2 className="text-xl font-black text-gray-950">{title}</h2>
        </div>
        <span className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-black text-gray-700">{data.length}</span>
      </div>
      {data.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {data.map((item) => renderAnnouncementCard(item, true))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-gray-200 bg-gray-50/70 px-4 py-8 text-center text-xs font-black uppercase tracking-widest text-gray-400">
          Sin anuncios para esta audiencia
        </div>
      )}
    </section>
  )

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 px-1 pb-20 pt-4 md:space-y-8 md:px-0">
        <div className="flex flex-col gap-6 px-2 sm:flex-row sm:items-end sm:justify-between md:px-0">
          <div className="space-y-1 text-center sm:text-left">
            <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-600 md:text-[10px]">Comunicacion</span>
            <h1 className="text-2xl font-black leading-none tracking-tight text-gray-900 md:text-3xl">Anuncios</h1>
            <p className="text-xs font-medium text-gray-500 md:text-sm">Gestiona comunicaciones para alumnos y profesores.</p>
          </div>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 text-sm font-black text-white shadow-xl shadow-fuchsia-100 transition-all hover:scale-[1.02] active:scale-95 sm:w-auto"
            onClick={openCreate}
          >
            <HiOutlinePlus size={18} /> Crear nuevo
          </button>
        </div>

        {error && (
          <div className="mx-2 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-600 md:mx-0">
            <HiOutlineX size={14} className="cursor-pointer" onClick={() => setError(null)} />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Activos", metrics.active.length, "text-fuchsia-600", "bg-fuchsia-50"],
            ["Del mes", metrics.month.length, "text-slate-900", "bg-white"],
            ["Alumnos", metrics.students.length, "text-fuchsia-600", "bg-fuchsia-50"],
            ["Profes", metrics.teachers.length, "text-blue-600", "bg-blue-50"],
            ["Vencen pronto", metrics.soon.length, "text-rose-600", "bg-rose-50"],
          ].map(([label, value, color, bg]) => (
            <div key={String(label)} className={`rounded-[24px] border border-gray-100 ${bg} p-4 shadow-sm`}>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</p>
              <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-40">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-100 border-t-fuchsia-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-fuchsia-600/60">Sincronizando tablero...</span>
          </div>
        ) : (
          <>
            <section className="rounded-[34px] border border-fuchsia-100 bg-gradient-to-br from-white via-fuchsia-50/40 to-white p-4 shadow-sm md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.24em] text-fuchsia-600">Vigentes</p>
                  <h2 className="text-xl font-black text-gray-950">Anuncios del mes</h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-fuchsia-600 shadow-sm">{metrics.month.length}</span>
              </div>
              {metrics.month.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {metrics.month.map((item) => renderAnnouncementCard(item))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-fuchsia-200 bg-white/70 px-4 py-10 text-center text-xs font-black uppercase tracking-widest text-fuchsia-400">
                  No hay anuncios activos este mes
                </div>
              )}
            </section>

            {renderSection("Para todos", "Audiencia general", grouped.both, "text-slate-500")}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {renderSection("Alumnos", "Portal alumnos", grouped.students, "text-fuchsia-600")}
              {renderSection("Profesores", "Portal profesores", grouped.teachers, "text-blue-600")}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 md:items-center md:p-6">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xl" onClick={closeModal} />
          <div className="relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl md:max-h-[calc(100dvh-4rem)] md:max-w-lg md:rounded-[24px]">
            <div className="flex shrink-0 items-center justify-between bg-gradient-to-br from-fuchsia-600 to-purple-600 p-4 text-white md:p-6">
              <div>
                <h2 className="text-lg font-black md:text-xl">{editingId ? "Editar anuncio" : "Nuevo anuncio"}</h2>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-fuchsia-100">Define audiencia, tipo y vigencia</p>
              </div>
              <button onClick={closeModal} className="rounded-xl p-2 transition-colors hover:bg-white/10">
                <HiOutlineX size={20} />
              </button>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto bg-gray-50/30 p-5 md:p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Tipo de aviso</label>
                    <select className="w-full rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.announcement_type || "important"} onChange={(e) => setDraft({ ...draft, announcement_type: e.target.value })}>
                      {ANNOUNCEMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Visible para</label>
                    <select className="w-full rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.audience || "both"} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}>
                      {ANNOUNCEMENT_AUDIENCES.map((audience) => <option key={audience.value} value={audience.value}>{audience.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Titulo</label>
                  <input className="w-full rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej: Nueva temporada 2026" />
                </div>

                <div className="space-y-1.5">
                  <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Subtitulo opcional</label>
                  <input className="w-full rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.subtitle || ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Ej: Promocion valida este mes" />
                </div>

                <div className="space-y-1.5">
                  <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Descripcion</label>
                  <textarea rows={4} className="w-full resize-none rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.body || ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Detalles del anuncio..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Desde</label>
                    <input type="date" className="w-full rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-[11px] font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.start_date || ""} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Hasta</label>
                    <input type="date" className="w-full rounded-xl border-2 border-transparent bg-white px-4 py-2.5 text-[11px] font-bold text-gray-700 shadow-sm outline-none transition-all focus:border-fuchsia-200" value={draft.end_date || ""} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
                  </div>
                </div>
                {!draft.end_date ? <p className="px-2 text-[10px] font-bold text-fuchsia-600">Sin fecha de termino: se mostrara durante el mes actual en mobile.</p> : null}
              </div>

              <div className="space-y-2">
                <label className="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Imagen / Banner</label>
                <div className="group relative flex aspect-[16/9] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-white shadow-sm transition-colors hover:border-fuchsia-400 md:rounded-[24px]">
                  {draft.image_url ? (
                    <img src={toAbsoluteUrl(draft.image_url) || ""} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <>
                      <HiOutlinePhotograph size={40} className="text-gray-200" />
                      <span className="mt-4 text-[8px] font-black uppercase text-gray-400">Subir imagen</span>
                    </>
                  )}
                  <input type="file" className="absolute inset-0 cursor-pointer opacity-0" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const fd = new FormData()
                    fd.append("file", file)
                    const res = await api.post<{ url: string }>("/api/pms/announcements/upload-image", fd, { headers: { "Content-Type": "multipart/form-data" } })
                    setDraft({ ...draft, image_url: res.data.url })
                  }} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-3 border-t border-gray-100 bg-gray-50 p-4 md:p-6">
              <button onClick={closeModal} className="flex-1 text-[9px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-gray-600">Cancelar</button>
              <button onClick={handleSave} className="flex-[2] rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 py-3 text-[10px] font-black text-white shadow-xl shadow-fuchsia-100 transition-all hover:scale-105 active:scale-95 md:text-xs">
                {editingId ? "Guardar cambios" : "Publicar anuncio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setPreviewImage(null)} />
          <img src={previewImage} className="relative z-10 max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl" alt="" />
        </div>
      )}
    </>
  )
}
