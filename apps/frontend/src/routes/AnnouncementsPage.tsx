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
  created_at?: string
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Partial<Announcement>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const MAX_ITEMS = 4

  const fmtDisplayDate = (iso?: string) => iso ? iso.split("-").reverse().join("/") : ""

  const load = async () => {
    setLoading(true)
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
    if (!draft.title) return setError("El título es obligatorio")
    try {
      const res = await api.post<Announcement>("/api/pms/announcements", draft)
      setItems(prev => [res.data, ...prev].slice(0, MAX_ITEMS))
      setDraft({}); setShowModal(false)
    } catch (e: any) { setError(e.message) }
  }

  const handleDelete = async (id: number) => {
    if(!confirm('¿Eliminar anuncio?')) return
    try {
      await api.delete(`/api/pms/announcements/${id}`)
      setItems(prev => prev.filter(a => a.id !== id))
    } catch (e: any) { setError(e.message) }
  }

  const handleToggleActive = async (id: number, next: boolean) => {
    try {
      await api.put<Announcement>(`/api/pms/announcements/${id}`, { is_active: next })
      setItems(prev => prev.map(a => a.id === id ? { ...a, is_active: next } : a))
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
           <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Comunicación</span>
           <h1 className="text-5xl font-black text-gray-900 tracking-tight">Anuncios</h1>
           <p className="text-gray-500 font-medium text-lg">Gestiona las novedades para la App de Alumnos.</p>
        </div>
        <button
          className="px-8 py-5 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-[24px] shadow-2xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
          onClick={() => setShowModal(true)}
          disabled={items.length >= MAX_ITEMS}
        >
          <HiOutlinePlus size={24} /> Crear Nuevo Anuncio
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-40 gap-4">
           <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
           <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando tablero...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {items.map((a) => (
            <div key={a.id} className="group bg-white rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden flex flex-col">
               <div className="relative h-48 bg-gray-50 cursor-pointer overflow-hidden" onClick={() => a.image_url && setPreviewImage(toAbsoluteUrl(a.image_url))}>
                  {a.image_url ? (
                    <img src={toAbsoluteUrl(a.image_url)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-200"><HiOutlinePhotograph size={48} /></div>
                  )}
                  <div className="absolute top-5 left-5 right-5 flex justify-between items-center">
                     <button onClick={(e) => { e.stopPropagation(); handleToggleActive(a.id, !a.is_active) }} className={`w-12 h-7 rounded-full flex items-center p-1 transition-colors backdrop-blur-md ${a.is_active ? 'bg-emerald-500/80' : 'bg-gray-400/80'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${a.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
                     </button>
                     <button onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }} className="p-2 bg-rose-500/80 hover:bg-rose-600 text-white rounded-xl backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0">
                        <HiOutlineTrash size={18} />
                     </button>
                  </div>
               </div>

               <div className="p-8 space-y-4 flex-1 flex flex-col">
                  <h3 className="text-xl font-black text-gray-900 leading-tight line-clamp-2">{a.title}</h3>
                  <p className="text-sm text-gray-500 font-medium line-clamp-3 flex-1">{a.body}</p>
                  
                  <div className="pt-6 border-t border-gray-50 space-y-4">
                     <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                        <HiOutlineCalendar size={14} className="text-fuchsia-400" />
                        {fmtDisplayDate(a.start_date)} - {fmtDisplayDate(a.end_date)}
                     </div>
                     {a.link_url && (
                        <a href={a.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-black text-fuchsia-600 hover:text-fuchsia-700 transition-colors">
                           Más Información <HiOutlineExternalLink size={16} />
                        </a>
                     )}
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300" onClick={()=>setShowModal(false)} />
           <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-white/20">
              <div className="p-10 bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white flex justify-between items-center">
                 <div>
                    <h2 className="text-3xl font-black">Nuevo Anuncio</h2>
                    <p className="text-fuchsia-100 font-bold uppercase tracking-widest text-[10px] mt-1">Visible en App de Alumnos</p>
                 </div>
                 <button onClick={()=>setShowModal(false)} className="p-4 hover:bg-white/10 rounded-2xl transition-colors">
                    <HiOutlineX size={28} />
                 </button>
              </div>

              <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Título</label>
                       <input className="w-full bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none transition-all" value={draft.title || ''} onChange={e=>setDraft({...draft, title:e.target.value})} placeholder="Ej: Nueva Temporada 2026" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Descripción</label>
                       <textarea rows={3} className="w-full bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none transition-all resize-none" value={draft.body || ''} onChange={e=>setDraft({...draft, body:e.target.value})} placeholder="Detalles del anuncio..." />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Desde</label>
                          <input type="date" className="w-full bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none transition-all" value={draft.start_date || ''} onChange={e=>setDraft({...draft, start_date:e.target.value})} />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Hasta</label>
                          <input type="date" className="w-full bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none transition-all" value={draft.end_date || ''} onChange={e=>setDraft({...draft, end_date:e.target.value})} />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Imagen / Banner</label>
                    <div className="relative group aspect-[16/9] rounded-[32px] bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:border-fuchsia-400 transition-colors cursor-pointer">
                       {draft.image_url ? (
                          <img src={toAbsoluteUrl(draft.image_url)} className="w-full h-full object-cover" />
                       ) : (
                          <>
                             <HiOutlinePhotograph size={48} className="text-gray-200" />
                             <span className="text-[10px] font-black text-gray-400 uppercase mt-4">Subir Imagen</span>
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

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4">
                 <button onClick={()=>setShowModal(false)} className="flex-1 font-black uppercase tracking-widest text-[10px] text-gray-400">Cancelar</button>
                 <button onClick={handleSave} className="flex-[2] py-5 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-3xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 transition-all">
                    Publicar Anuncio
                 </button>
              </div>
           </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" onClick={()=>setPreviewImage(null)}>
           <img src={previewImage} className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}
