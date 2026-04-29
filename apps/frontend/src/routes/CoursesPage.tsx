import { useEffect, useMemo, useRef, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import {
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineCalendar,
  HiOutlineTag,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlineX,
  HiOutlinePhotograph,
  HiOutlineLocationMarker
} from 'react-icons/hi'
import { useTenant } from '../lib/tenant'

type Course = {
  id: number
  name: string
  level?: string
  image_url?: string | null
  course_type?: string | null
  classes_per_week?: number | null
  day_of_week?: number | null
  start_time?: string | null
  end_time?: string | null
  day_of_week_2?: number | null
  start_time_2?: string | null
  end_time_2?: string | null
  day_of_week_3?: number | null
  start_time_3?: string | null
  end_time_3?: string | null
  day_of_week_4?: number | null
  start_time_4?: string | null
  end_time_4?: string | null
  day_of_week_5?: number | null
  start_time_5?: string | null
  end_time_5?: string | null
  start_date?: string | null
  price?: number | string | null
  class_price?: number | string | null
  is_active?: boolean
  teacher_name?: string | null
  room_name?: string | null
  student_count?: number
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '--:--')

function getCourseGradient(c: Course, idx: number): string {
  if (c.is_active === false) return 'from-gray-300 to-gray-500'
  const gradients = [
    'from-fuchsia-500 to-purple-600',
    'from-indigo-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600'
  ]
  return gradients[idx % gradients.length]
}

export default function CoursesPage() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<any>({ is_active: true, course_type: 'regular' })
  const [teachers, setTeachers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/pms/courses', { params: { q } })
      setData(res.data.items || [])
      setTotal(res.data.total || 0)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tenantId])
  useEffect(() => {
    const id = setTimeout(() => { load() }, 300)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    const fetchRefs = async () => {
      const [t, r] = await Promise.all([api.get('/api/pms/teachers'), api.get('/api/pms/rooms')])
      setTeachers(t.data.items || [])
      setRooms(r.data || [])
    }
    fetchRefs()
  }, [tenantId])

  const grouped = useMemo(() => {
    const map = new Map<number | 'nd', { label: string, items: Course[] }>()
    for (const c of data) {
      const key = (c.day_of_week ?? 'nd') as number | 'nd'
      if (!map.has(key)) map.set(key, { label: typeof key === 'number' ? DAY_NAMES[key] : 'Sin día', items: [] })
      map.get(key)!.items.push(c)
    }
    return Array.from(map.entries()).sort((a,b)=> (a[0] === 'nd' ? 99 : (a[0] as number)) - (b[0] === 'nd' ? 99 : (b[0] as number))).map(([,v])=>v)
  }, [data])

  const openForm = (course: Course | null) => {
    setImageFile(null); setImagePreview(null)
    if (!course) {
      setEditId(null)
      setForm({ is_active: true, course_type: 'regular' })
    } else {
      const f = (t: any) => t ? String(t).slice(0, 5) : ''
      setEditId(course.id)
      setForm({
        ...course,
        start_time: f(course.start_time), end_time: f(course.end_time),
        start_time_2: f(course.start_time_2), end_time_2: f(course.end_time_2),
        start_time_3: f(course.start_time_3), end_time_3: f(course.end_time_3),
        start_time_4: f(course.start_time_4), end_time_4: f(course.end_time_4),
        start_time_5: f(course.start_time_5), end_time_5: f(course.end_time_5),
      })
    }
    setShowForm(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Academia</span>
          <h1 className="text-5xl font-black text-gray-900 tracking-tight">Cursos & Clases</h1>
          <p className="text-gray-500 font-medium text-lg">Administra la programación, cupos y oferta académica.</p>
        </div>
        <button
          onClick={() => openForm(null)}
          className="px-8 py-5 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-[24px] shadow-2xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3"
        >
          <HiOutlinePlus size={24} /> Crear Nuevo Curso
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-2 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-2">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
          <input
            className="w-full bg-transparent border-none rounded-full pl-16 pr-6 py-5 text-lg font-bold text-gray-700 placeholder-gray-300 outline-none"
            placeholder="Buscar por curso, nivel o instructor..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center py-40 gap-4">
           <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
           <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando academia...</span>
        </div>
      ) : (
        <div className="space-y-16">
          {grouped.map((g, idx) => (
            <div key={idx} className="space-y-8">
              <div className="flex items-center gap-6">
                 <h2 className="text-3xl font-black text-gray-900">{g.label}</h2>
                 <div className="h-[2px] flex-1 bg-gray-100 rounded-full" />
                 <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{g.items.length} Clases</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {g.items.map((c, i) => (
                  <div key={c.id} className="group relative bg-white rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer" onClick={() => window.location.href=`/courses/${c.id}`}>
                    {/* Visual Header */}
                    <div className={`h-40 relative bg-gradient-to-br ${getCourseGradient(c, i)}`}>
                       {c.image_url && <img src={toAbsoluteUrl(c.image_url)} className="w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:scale-110 transition-transform duration-700" />}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                       <div className="absolute top-5 right-5">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-md border border-white/20 ${c.is_active !== false ? 'bg-emerald-500/80 text-white' : 'bg-gray-500/80 text-white'}`}>
                             {c.is_active !== false ? 'Activo' : 'Inactivo'}
                          </span>
                       </div>
                       <div className="absolute bottom-5 left-6 right-6">
                          <div className="text-xs font-black text-white/80 uppercase tracking-widest mb-1">{c.level || 'Nivel General'}</div>
                          <div className="text-2xl font-black text-white leading-tight line-clamp-1">{c.name}</div>
                       </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-6">
                       <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center font-black text-xs">
                                {c.student_count || 0}
                             </div>
                             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumnos</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <HiOutlineLocationMarker className="text-fuchsia-300" />
                             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{c.room_name || 'Sin Sala'}</span>
                          </div>
                       </div>

                       <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                             <HiOutlineClock className="text-fuchsia-600" /> Horarios
                          </div>
                          <div className="space-y-1">
                             {[
                               { d: c.day_of_week, st: c.start_time, et: c.end_time },
                               { d: c.day_of_week_2, st: c.start_time_2, et: c.end_time_2 },
                               { d: c.day_of_week_3, st: c.start_time_3, et: c.end_time_3 }
                             ].filter(s => s.d != null).map((s, si) => (
                               <div key={si} className="flex items-center justify-between text-xs">
                                  <span className="font-black text-gray-700">{DAY_NAMES[s.d!]}</span>
                                  <span className="font-bold text-gray-400">{hhmm(s.st)} - {hhmm(s.et)}</span>
                               </div>
                             ))}
                          </div>
                       </div>

                       <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-gray-400 uppercase">Mensual</span>
                             <span className="text-lg font-black text-gray-900">{fmtCLP.format(Number(c.price || 0))}</span>
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors">{c.teacher_name || 'Sin Instructor'}</div>
                             <div className="text-[9px] font-bold text-gray-400 uppercase">Instructor</div>
                          </div>
                       </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="absolute top-4 left-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                       <button onClick={(e)=>{e.stopPropagation(); openForm(c)}} className="p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-2xl text-white shadow-xl transition-all">
                          <HiOutlinePencil size={20} />
                       </button>
                       <button onClick={async (e)=>{
                          e.stopPropagation()
                          if(confirm('¿Eliminar curso?')) {
                             await api.delete(`/api/pms/courses/${c.id}`)
                             load()
                          }
                       }} className="p-3 bg-rose-500/80 hover:bg-rose-600 backdrop-blur-md rounded-2xl text-white shadow-xl transition-all">
                          <HiOutlineTrash size={20} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300" onClick={()=>setShowForm(false)} />
           <div className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 max-h-[90vh] flex flex-col border border-white/20">
              <div className="p-10 bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h2 className="text-3xl font-black">{editId ? 'Editar Clase' : 'Nueva Clase'}</h2>
                    <p className="text-fuchsia-100 font-bold uppercase tracking-widest text-[10px] mt-1">Configuración completa de programa</p>
                 </div>
                 <button onClick={()=>setShowForm(false)} className="p-4 hover:bg-white/10 rounded-2xl transition-colors">
                    <HiOutlineX size={28} />
                 </button>
              </div>

              <div className="p-10 overflow-y-auto space-y-10 custom-scrollbar flex-1 bg-gray-50/50">
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                    <div className="md:col-span-8 space-y-8">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre del Curso</label>
                          <input className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50 px-6 py-4 rounded-2xl font-bold text-gray-700 transition-all outline-none" value={form.name || ''} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Ej: Salsa Cubana" />
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nivel</label>
                             <input className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50 px-6 py-4 rounded-2xl font-bold text-gray-700 transition-all outline-none" value={form.level || ''} onChange={(e)=>setForm({...form, level:e.target.value})} placeholder="Intermedio" />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Tipo de Programa</label>
                             <select className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none appearance-none" value={form.course_type || 'regular'} onChange={(e)=>setForm({...form, course_type:e.target.value})}>
                                <option value="regular">Regular</option>
                                <option value="choreography">Coreografía</option>
                             </select>
                          </div>
                       </div>
                    </div>
                    <div className="md:col-span-4">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-2 block">Imagen del Curso</label>
                       <div className="relative group aspect-square rounded-[32px] bg-white border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:border-fuchsia-400 transition-colors cursor-pointer" onClick={()=>fileInputRef.current?.click()}>
                          {(imagePreview || form.image_url) ? (
                             <img src={imagePreview || toAbsoluteUrl(form.image_url)} className="w-full h-full object-cover" />
                          ) : (
                             <>
                                <HiOutlinePhotograph size={48} className="text-gray-200 group-hover:text-fuchsia-200 transition-colors" />
                                <span className="text-[10px] font-black text-gray-400 uppercase mt-4">Subir Foto</span>
                             </>
                          )}
                          <input type="file" ref={fileInputRef} className="hidden" onChange={(e)=>{
                             const f = e.target.files?.[0]
                             if(f) {
                                setImageFile(f)
                                const reader = new FileReader()
                                reader.onload = (ev) => setImagePreview(ev.target?.result as string)
                                reader.readAsDataURL(f)
                             }
                          }} />
                       </div>
                    </div>
                 </div>

                 {/* Horarios Grid */}
                 <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 text-fuchsia-600 font-black uppercase tracking-widest text-[10px]">
                       <HiOutlineClock size={18} /> Programación Semanal
                    </div>
                    <div className="space-y-4">
                       {[1,2,3,4,5].map(num => {
                          const suffix = num === 1 ? '' : `_${num}`
                          const dowK = `day_of_week${suffix}`; const stK = `start_time${suffix}`; const etK = `end_time${suffix}`
                          return (
                             <div key={num} className="grid grid-cols-12 gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0 items-end">
                                <div className="col-span-4">
                                   <select className="w-full bg-gray-50 border-none px-4 py-3 rounded-xl font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-fuchsia-100" value={form[dowK] ?? ''} onChange={(e)=>setForm({...form, [dowK]: e.target.value==='' ? null : Number(e.target.value)})}>
                                      <option value="">(No asig.)</option>
                                      {DAY_NAMES.map((n,i)=><option key={i} value={i}>{n}</option>)}
                                   </select>
                                </div>
                                <div className="col-span-4">
                                   <input type="time" className="w-full bg-gray-50 border-none px-4 py-3 rounded-xl font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-fuchsia-100" value={form[stK] || ''} onChange={(e)=>setForm({...form, [stK]:e.target.value})} />
                                </div>
                                <div className="col-span-4">
                                   <input type="time" className="w-full bg-gray-50 border-none px-4 py-3 rounded-xl font-bold text-sm outline-none focus:bg-white focus:ring-2 focus:ring-fuchsia-100" value={form[etK] || ''} onChange={(e)=>setForm({...form, [etK]:e.target.value})} />
                                </div>
                             </div>
                          )
                       })}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Instructor Principal</label>
                       <select className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none appearance-none" value={form.teacher_id || ''} onChange={(e)=>setForm({...form, teacher_id:e.target.value})}>
                          <option value="">Seleccionar Instructor...</option>
                          {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Sala Asignada</label>
                       <select className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none appearance-none" value={form.room_id || ''} onChange={(e)=>setForm({...form, room_id:e.target.value})}>
                          <option value="">Seleccionar Sala...</option>
                          {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Mensualidad ($)</label>
                       <input type="number" className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none" value={form.price || ''} onChange={(e)=>setForm({...form, price:e.target.value})} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Clase Suelta ($)</label>
                       <input type="number" className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none" value={form.class_price || ''} onChange={(e)=>setForm({...form, class_price:e.target.value})} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Capacidad Máx.</label>
                       <input type="number" className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 px-6 py-4 rounded-2xl font-bold text-gray-700 outline-none" value={form.max_capacity || ''} onChange={(e)=>setForm({...form, max_capacity:e.target.value})} />
                    </div>
                 </div>
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
                 <button onClick={()=>setForm({...form, is_active: !form.is_active})} className="flex items-center gap-4 group">
                    <div className={`w-14 h-8 rounded-full flex items-center p-1 transition-all ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                       <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <span className="text-sm font-black text-gray-700 uppercase tracking-widest">Curso Activo</span>
                 </button>
                 
                 <div className="flex gap-4">
                    <button onClick={()=>setShowForm(false)} className="px-8 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                    <button
                      disabled={saving}
                      onClick={async () => {
                         setSaving(true)
                         try {
                           const fd = { ...form }
                           const clean = (v:any) => (v===""||v===undefined)?null:v
                           const keys = ['start_time','end_time','start_time_2','end_time_2','start_time_3','end_time_3','start_time_4','end_time_4','start_time_5','end_time_5','price','class_price','max_capacity','teacher_id','room_id']
                           keys.forEach(k=> fd[k]=clean(fd[k]))
                           let r; if(editId) r=await api.put(`/api/pms/courses/${editId}`, fd); else r=await api.post('/api/pms/courses', fd)
                           if(imageFile){ const f=new FormData(); f.append('file', imageFile); await api.post(`/api/pms/courses/${r.data.id}/image`, f) }
                           setShowForm(false); load()
                         } catch(e:any){ alert("Error: "+ (e.response?.data?.detail || e.message)) }
                         finally { setSaving(false) }
                      }}
                      className="px-10 py-5 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-3xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                       {saving ? 'Guardando...' : editId ? 'Actualizar Programa' : 'Crear Programa'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
