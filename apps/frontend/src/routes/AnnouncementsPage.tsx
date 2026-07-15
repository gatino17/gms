import { useEffect, useState } from "react"
import { api, toAbsoluteUrl } from "../lib/api"
import { 
  HiOutlinePlus, 
  HiOutlineX, 
  HiOutlineTrash, 
  HiOutlinePhotograph, 
  HiOutlineExternalLink, 
  HiOutlineCalendar 
} from "react-icons/hi"

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
  created_at?: string
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Partial<Announcement>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const MAX_ITEMS = 4

  const fmtDisplayDate = (iso?: string) => iso ? iso.split("-").reverse().join("/") : ""

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

  const handleSave = async () => {
    if (!draft.title) return
    setError(null)
    try {
      const res = await api.post<Announcement>("/api/pms/announcements", draft)
      setItems(prev => [res.data, ...prev].slice(0, MAX_ITEMS))
      setDraft({})
      setShowModal(false)
    } catch (e: any) { 
      setError(e.message) 
    }
  }

  const handleDelete = async (id: number) => {
    if(!confirm('¿Eliminar anuncio?')) return
    try {
      await api.delete(`/api/pms/announcements/${id}`)
      setItems(prev => prev.filter(a => a.id !== id))
    } catch (e: any) { 
      setError(e.message) 
    }
  }

  const handleToggleActive = async (id: number, next: boolean) => {
    try {
      await api.put<Announcement>(`/api/pms/announcements/${id}`, { is_active: next })
      setItems(prev => prev.map(a => a.id === id ? { ...a, is_active: next } : a))
    } catch (e: any) { 
      setError(e.message) 
    }
  }

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20 px-1 md:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-2 md:px-0 pt-4">
          <div className="space-y-1 text-center sm:text-left">
             <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Comunicación</span>
             <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">Anuncios</h1>
             <p className="text-gray-500 font-medium text-xs md:text-sm">Gestiona las novedades para la App.</p>
          </div>
          <button
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black text-sm rounded-xl shadow-xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            onClick={() => setShowModal(true)}
            disabled={items.length >= MAX_ITEMS}
          >
            <HiOutlinePlus size={18} /> Crear Nuevo
          </button>
        </div>

        {error && (
          <div className="mx-2 md:mx-0 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-2">
             <HiOutlineX size={14} className="cursor-pointer" onClick={() => setError(null)} />
             {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center py-40 gap-4">
             <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
             <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando tablero...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 px-1 md:px-0">
            {items.map((a) => (
              <div key={a.id} className="group bg-white rounded-2xl md:rounded-[28px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col">
                 <div className="relative h-32 md:h-36 bg-gray-50 cursor-pointer overflow-hidden" onClick={() => a.image_url && setPreviewImage(toAbsoluteUrl(a.image_url) ?? null)}>
                    {a.image_url ? (
                      <img src={toAbsoluteUrl(a.image_url)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200"><HiOutlinePhotograph size={40} /></div>
                    )}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                       <button onClick={(e) => { e.stopPropagation(); handleToggleActive(a.id, !a.is_active) }} className={`w-10 h-6 rounded-full flex items-center p-1 transition-colors backdrop-blur-md ${a.is_active ? 'bg-emerald-500/80' : 'bg-gray-400/80'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${a.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                       </button>
                       <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }} className="p-2 bg-rose-500/80 hover:bg-rose-600 text-white rounded-xl backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0">
                          <HiOutlineTrash size={16} />
                       </button>
                    </div>
                 </div>

                 <div className="p-4 md:p-6 space-y-3 flex-1 flex flex-col">
                    <h3 className="text-base md:text-lg font-black text-gray-900 leading-tight line-clamp-2">{a.title}</h3>
                    <p className="text-[11px] md:text-xs text-gray-500 font-medium line-clamp-3 flex-1">{a.body}</p>
                    
                    <div className="pt-3 md:pt-4 border-t border-gray-50 space-y-3">
                       <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black text-gray-800 uppercase tracking-widest bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100">
                          <HiOutlineCalendar size={12} className="text-fuchsia-400" />
                          {fmtDisplayDate(a.start_date)} - {fmtDisplayDate(a.end_date)}
                       </div>
                       {a.link_url && (
                          <a href={a.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] font-black text-fuchsia-600 hover:text-fuchsia-700 transition-colors">
                             Más Información <HiOutlineExternalLink size={14} />
                          </a>
                       )}
                    </div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Form - Portal-like behavior */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center p-4 md:p-6 overflow-y-auto">
           <div className="fixed inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={()=>setShowModal(false)} />
           <div className="relative w-full md:max-w-lg bg-white rounded-2xl md:rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-white/20 max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)]">
              <div className="p-4 md:p-6 bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h2 className="text-lg md:text-xl font-black">Nuevo Anuncio</h2>
                    <p className="text-fuchsia-100 font-bold uppercase tracking-widest text-[8px] mt-1">Visible en App de Alumnos</p>
                 </div>
                 <button onClick={()=>setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <HiOutlineX size={20} />
                 </button>
              </div>

              <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1 min-h-0 custom-scrollbar bg-gray-50/30">
                 <div className="space-y-4">
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Título</label>
                       <input className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-4 py-2.5 rounded-xl font-bold text-sm text-gray-700 outline-none transition-all shadow-sm" value={draft.title || ''} onChange={e=>setDraft({...draft, title:e.target.value})} placeholder="Ej: Nueva Temporada 2026" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Descripción</label>
                       <textarea rows={3} className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-4 py-2.5 rounded-xl font-bold text-sm text-gray-700 outline-none transition-all resize-none shadow-sm" value={draft.body || ''} onChange={e=>setDraft({...draft, body:e.target.value})} placeholder="Detalles del anuncio..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Desde</label>
                          <input type="date" className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-4 py-2.5 rounded-xl font-bold text-[11px] text-gray-700 outline-none transition-all shadow-sm" value={draft.start_date || ''} onChange={e=>setDraft({...draft, start_date:e.target.value})} />
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Hasta</label>
                          <input type="date" className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-4 py-2.5 rounded-xl font-bold text-[11px] text-gray-700 outline-none transition-all shadow-sm" value={draft.end_date || ''} onChange={e=>setDraft({...draft, end_date:e.target.value})} />
                       </div>
                    </div>
                 </div>

                  <div className="space-y-2">
                     <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Imagen / Banner</label>
                     <div className="relative group aspect-[16/9] rounded-xl md:rounded-[24px] bg-white border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:border-fuchsia-400 transition-colors cursor-pointer shadow-sm">
                        {draft.image_url ? (
                           <img src={toAbsoluteUrl(draft.image_url)} className="w-full h-full object-cover" alt="" />
                        ) : (
                           <>
                              <HiOutlinePhotograph size={40} className="text-gray-200" />
                              <span className="text-[8px] font-black text-gray-400 uppercase mt-4">Subir Imagen</span>
                           </>
                        )}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async e=>{
                           const f=e.target.files?.[0]; if(!f) return;
                           const fd=new FormData(); fd.append('file', f)
                           const res=await api.post<{url:string}>("/api/pms/announcements/upload-image", fd, { headers:{'Content-Type':'multipart/form-data'} })
                           setDraft({...draft, image_url:res.data.url})
                        }} />
                     </div>
                  </div>
              </div>

              <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-100 flex gap-3 shrink-0">
                 <button onClick={()=>setShowModal(false)} className="flex-1 font-black uppercase tracking-widest text-[9px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                 <button onClick={handleSave} className="flex-[2] py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black text-[10px] md:text-xs rounded-xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 transition-all">
                    Publicar Anuncio
                 </button>
              </div>
           </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-black/90 backdrop-blur-xl" onClick={()=>setPreviewImage(null)} />
           <img src={previewImage} className="relative z-10 max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" alt="" />
        </div>
      )}
    </>
  )
}
