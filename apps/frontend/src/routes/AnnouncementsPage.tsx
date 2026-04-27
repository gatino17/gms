import { useEffect, useState } from "react"
import { api, toAbsoluteUrl } from "../lib/api"
import { HiOutlineSpeakerphone, HiOutlinePlus, HiOutlineX, HiOutlineTrash, HiOutlinePhotograph, HiOutlineExternalLink, HiOutlineCalendar, HiOutlineClock } from "react-icons/hi"

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
  const [loading, setLoading] = useState(false)
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
      return { label: `Comienza en ${diff} días`, tone: "future" as const }
    }
    if (end && today > end) {
      const diff = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24))
      return { label: `Finalizó hace ${diff} días`, tone: "expired" as const }
    }
    const base = start || created
    if (!base) return { label: "Activo", tone: "ok" as const }
    const diffDays = Math.floor((today.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))
    const weeks = Math.floor(diffDays / 7)
    const label = diffDays < 7 ? `${diffDays} días` : `${weeks} sem`
    const tone = diffDays >= 30 ? "warn" : "ok"
    return { label: `Publicado hace ${label}`, tone }
  }

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get<Announcement[]>("/api/pms/announcements", { params: { active_only: false, limit: 50 } })
      setItems(res.data)
    } catch (e: any) {
      setError(e?.message || "Error al cargar anuncios")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    if (!draft.title) {
      setError("El título es obligatorio")
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
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h1 className="text-4xl font-black text-gray-900 tracking-tight">Anuncios y Novedades</h1>
           <p className="text-gray-500 font-medium mt-2">Publica banners, comunicados o retos para la app móvil de los alumnos.</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
              <span className="font-black text-gray-700 uppercase tracking-widest text-[10px]">
                 {items.length} / {MAX_ITEMS} Activos
              </span>
           </div>
           <button
             className="px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
             onClick={() => setShowModal(true)}
             disabled={items.length >= MAX_ITEMS}
           >
             <HiOutlinePlus size={16} /> Crear Anuncio
           </button>
        </div>
      </div>

      {error && (
         <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
            <HiOutlineX className="shrink-0" /> {error}
         </div>
      )}

      {/* Grid de Anuncios */}
      {loading ? (
         <div className="flex flex-col items-center justify-center py-40 gap-4">
           <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
           <span className="text-fuchsia-600 font-black tracking-widest text-[10px] uppercase">Cargando Tablero...</span>
         </div>
      ) : items.length === 0 ? (
         <div className="bg-white rounded-[40px] shadow-xl shadow-gray-100/50 border border-gray-100 p-20 text-center flex flex-col items-center">
            <HiOutlineSpeakerphone size={64} className="text-gray-200 mb-6" />
            <h3 className="text-2xl font-black text-gray-900">Sin Comunicados</h3>
            <p className="text-gray-500 mt-2 font-medium">Aún no has publicado ninguna novedad para tus alumnos.</p>
         </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {items.map((a) => {
               const age = ageInfo(a)
               const toneStyles = 
                 age.tone === 'expired' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                 age.tone === 'future' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                 age.tone === 'warn' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                 'bg-emerald-50 text-emerald-600 border-emerald-200'

               return (
                 <div key={a.id} className="bg-white rounded-[40px] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden flex flex-col group hover:-translate-y-1 transition-all duration-300">
                    {/* Imagen / Banner */}
                    <div className="relative h-48 bg-gray-100 group-hover:bg-fuchsia-50 transition-colors cursor-pointer" onClick={() => a.image_url && setPreviewImage(toAbsoluteUrl(a.image_url) || null)}>
                       {a.image_url ? (
                          <img src={toAbsoluteUrl(a.image_url)} alt={a.title} className="w-full h-full object-cover" />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                             <HiOutlinePhotograph size={40} />
                          </div>
                       )}
                       {/* Overlay Status */}
                       <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm backdrop-blur-md ${toneStyles}`}>
                             {age.label}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); setToggling(prev => ({...prev, [a.id]: !a.is_active})) }} className={`w-10 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${a.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                             <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${a.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                       </div>
                    </div>

                    {/* Contenido */}
                    <div className="p-8 flex-1 flex flex-col">
                       <h3 className="font-black text-xl text-gray-900 leading-tight mb-2 line-clamp-2">{a.title}</h3>
                       {a.subtitle && <p className="text-sm font-bold text-fuchsia-600 mb-4">{a.subtitle}</p>}
                       {a.body && <p className="text-sm text-gray-600 line-clamp-3 mb-6 flex-1">{a.body}</p>}

                       {/* Meta & Actions */}
                       <div className="mt-auto space-y-4">
                          {(a.start_date || a.end_date) && (
                             <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                <HiOutlineCalendar size={16} />
                                <span>{fmtDisplayDate(a.start_date) || '—'} a {fmtDisplayDate(a.end_date) || '—'}</span>
                             </div>
                          )}

                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                             {a.link_url ? (
                                <a href={a.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-black text-fuchsia-600 hover:text-fuchsia-700 transition-colors">
                                   Ver Enlace <HiOutlineExternalLink size={14} />
                                </a>
                             ) : <span />}
                             
                             <button onClick={() => handleDelete(a.id)} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                <HiOutlineTrash size={20} />
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>
               )
            })}
         </div>
      )}

      {/* Modal Creación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
            {/* Header Modal */}
            <div className="px-10 py-8 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white flex items-center justify-between shrink-0">
               <div>
                  <h2 className="text-2xl font-black tracking-tight">Nuevo Comunicado</h2>
                  <p className="text-fuchsia-100 text-xs font-bold uppercase tracking-widest mt-1">Límite: {MAX_ITEMS} avisos activos</p>
               </div>
               <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                  <HiOutlineX size={24} />
               </button>
            </div>

            {/* Formulario */}
            <div className="p-10 overflow-y-auto space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Título Principal</label>
                  <input
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Ej: Masterclass de Verano"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Subtítulo (Opcional)</label>
                  <input
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                    value={draft.subtitle || ''}
                    onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                    placeholder="Resumen corto"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Cuerpo del Mensaje</label>
                  <textarea
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none resize-none"
                    rows={4}
                    value={draft.body || ''}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    placeholder="Detalles para los alumnos..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha Inicio Visibilidad</label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                    value={draft.start_date || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setDraft({ ...draft, start_date: v, end_date: draft.end_date || v })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha Fin Visibilidad</label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                    value={draft.end_date || draft.start_date || ''}
                    onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Enlace de Acción (URL Opcional)</label>
                  <input
                    className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                    value={draft.link_url || ''}
                    onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                    placeholder="https://google.com/form..."
                  />
                </div>

                {/* Zona Carga Imagen */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Banner Gráfico</label>
                  <div className="relative group">
                     {draft.image_url ? (
                        <div className="relative w-full h-48 rounded-[24px] border-2 border-gray-100 overflow-hidden">
                           <img src={toAbsoluteUrl(draft.image_url)} alt="preview" className="w-full h-full object-cover" />
                           <button onClick={() => setDraft(d => ({...d, image_url: ''}))} className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-xl shadow-lg hover:bg-rose-600 transition-colors z-10">
                              <HiOutlineTrash size={20} />
                           </button>
                        </div>
                     ) : (
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-fuchsia-200 rounded-[24px] bg-fuchsia-50/50 cursor-pointer hover:bg-fuchsia-50 hover:border-fuchsia-400 transition-colors group">
                           <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                 const file = e.target.files?.[0]
                                 if (!file) return
                                 setUploadError(null)
                                 setUploadInfo(null)
                                 if (!file.type.startsWith('image/')) { setUploadError('Archivo no es una imagen'); return }
                                 if (file.size > 2 * 1024 * 1024) { setUploadError('Máximo 2MB'); return }
                                 
                                 const tempUrl = URL.createObjectURL(file)
                                 const img = new Image()
                                 img.src = tempUrl
                                 await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve() })
                                 if (img.width < 600 || img.height < 600) {
                                    setUploadError('Resolución muy baja (mínimo 600x600px)')
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
                                    setUploadInfo(`${img.width}x${img.height}px · ${(file.size/1024).toFixed(0)} KB`)
                                 } catch (err: any) {
                                    setUploadError(err?.response?.data?.detail || err?.message || 'No se pudo subir la imagen')
                                 } finally {
                                    setUploading(false)
                                 }
                              }}
                           />
                           {uploading ? (
                              <div className="w-10 h-10 border-4 border-fuchsia-200 border-t-fuchsia-600 rounded-full animate-spin" />
                           ) : (
                              <>
                                 <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-fuchsia-500 mb-4 group-hover:scale-110 transition-transform">
                                    <HiOutlinePhotograph size={32} />
                                 </div>
                                 <span className="font-black text-gray-600">Subir Diseño (JPG/PNG)</span>
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Recomendado: 1080x1080px (Max 2MB)</span>
                              </>
                           )}
                        </label>
                     )}
                  </div>
                  {uploadError && <div className="text-xs font-bold text-rose-500 mt-2 flex items-center gap-1"><HiOutlineX /> {uploadError}</div>}
                  {uploadInfo && <div className="text-xs font-bold text-emerald-500 mt-2">{uploadInfo}</div>}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="px-10 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
               <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-12 h-7 rounded-full flex items-center p-1 transition-colors ${draft.is_active ?? true ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                     <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${draft.is_active ?? true ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-black text-gray-700">Publicar Inmediatamente</span>
               </label>
               
               <div className="flex gap-4">
                  <button onClick={() => setShowModal(false)} className="px-8 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                  <button
                     onClick={handleSave}
                     disabled={items.length >= MAX_ITEMS || uploading || !draft.title}
                     className="px-10 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                     Crear Anuncio
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors" onClick={() => setPreviewImage(null)}>
            <HiOutlineX size={40} />
          </button>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
