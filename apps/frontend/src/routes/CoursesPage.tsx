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
  HiOutlineUserGroup
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

/* ===== Helpers UI ===== */
function Badge({ children, tone='indigo'}:{children:React.ReactNode; tone?:'indigo'|'emerald'|'gray'|'fuchsia'}) {
  const tones:any = {
    indigo:  'bg-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    gray:    'bg-gray-200 text-gray-700',
    fuchsia: 'bg-fuchsia-100 text-fuchsia-700',
  }
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${tones[tone]}`}>{children}</span>
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const fmtCLP = (n:number) => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }).format(n)
const hhmm = (t?:string|null) => (t ? String(t).slice(0,5) : '--:--')

const hasMoney = (v: unknown) => v !== null && v !== undefined && !Number.isNaN(Number(v))
const money    = (v: unknown) => fmtCLP(Number(v ?? 0))

const TEACHER_GRADS = [
  'from-purple-500 to-pink-500',
  'from-fuchsia-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-red-500',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getCourseGradient(c: Course, idx: number): string {
  if (c.is_active === false) return 'bg-gradient-to-br from-gray-300 to-gray-500'
  if (!c.teacher_name) {
    return idx % 2 === 0 ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-fuchsia-500 to-violet-500'
  }
  const h = hashString(c.teacher_name)
  const grad = TEACHER_GRADS[h % TEACHER_GRADS.length]
  return `bg-gradient-to-br ${grad}`
}

/* ===== Card de Curso ===== */
type CourseCardProps = {
  c: Course
  idx: number
  onEdit: () => void
  onDelete: () => void
  onOpen: () => void
}

function CourseCard({ c, idx, onEdit, onDelete, onOpen }: CourseCardProps) {
  const activo = c.is_active !== false
  const headerGrad = getCourseGradient(c, idx)
  const showMens = hasMoney(c.price)
  const showClass = hasMoney(c.class_price)
  const studentCount = c.student_count || 0

  type Slot = { day: string; time: string }
  const slots: Slot[] = []
  const pushSlot = (dow?: number | null, st?: string | null, et?: string | null) => {
    if (typeof dow === 'number') {
      slots.push({ day: DAY_NAMES[dow], time: `${hhmm(st)} – ${hhmm(et)}` })
    }
  }

  pushSlot(c.day_of_week, c.start_time, c.end_time)
  pushSlot(c.day_of_week_2, c.start_time_2, c.end_time_2)
  pushSlot(c.day_of_week_3, c.start_time_3, c.end_time_3)
  pushSlot(c.day_of_week_4, c.start_time_4, c.end_time_4)
  pushSlot(c.day_of_week_5, c.start_time_5, c.end_time_5)

  return (
    <div
      className="group relative rounded-3xl bg-white shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col border border-gray-100"
      onClick={onOpen}
    >
      <div className={`relative h-32 ${c.image_url ? '' : headerGrad}`}>
        {c.image_url && <img src={toAbsoluteUrl(c.image_url)} alt={c.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        <div className="absolute top-4 right-4 flex gap-2">
          <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-md ${activo ? 'bg-emerald-500/90 text-white' : 'bg-gray-500/90 text-white'}`}>
            {activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-xl font-black text-white leading-tight line-clamp-1 drop-shadow-lg">{c.name}</div>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-white/80 text-xs font-bold">{c.teacher_name || 'Sin Instructor'}</span>
             <span className="w-1 h-1 bg-white/40 rounded-full" />
             <span className="text-white/80 text-xs font-bold">{c.room_name || 'Sin Sala'}</span>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2 text-fuchsia-600 font-bold text-xs bg-fuchsia-50 px-3 py-1.5 rounded-xl border border-fuchsia-100">
             <HiOutlineUserGroup size={16} />
             {studentCount} {studentCount === 1 ? 'Alumno' : 'Alumnos'}
           </div>
           {c.level && <Badge tone="fuchsia">{c.level}</Badge>}
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
             <HiOutlineClock className="text-fuchsia-500" /> Horarios
          </div>
          <div className="space-y-1">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-bold text-gray-700">{s.day}</span>
                <span className="text-gray-400 font-medium">{s.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-gray-50">
           {showMens && (
             <div className="flex flex-col">
               <span className="text-[9px] font-black text-gray-400 uppercase">Mensual</span>
               <span className="text-sm font-black text-fuchsia-600">{money(c.price)}</span>
             </div>
           )}
           {showClass && (
             <div className="flex flex-col text-right">
               <span className="text-[9px] font-black text-gray-400 uppercase">Clase Suelta</span>
               <span className="text-sm font-black text-rose-500">{money(c.class_price)}</span>
             </div>
           )}
        </div>

        <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button onClick={(e)=>{e.stopPropagation(); onEdit()}} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-xl text-white transition-colors">
             <HiOutlinePencil size={18} />
           </button>
           <button onClick={(e)=>{e.stopPropagation(); onDelete()}} className="p-2 bg-rose-500/80 hover:bg-rose-600 backdrop-blur-md rounded-xl text-white transition-colors">
             <HiOutlineTrash size={18} />
           </button>
        </div>
      </div>
    </div>
  )
}

/* ===== Página ===== */
export default function CoursesPage() {
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const { tenantId } = useTenant()
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<any>({ is_active: true, course_type: 'regular' })
  const [teachers, setTeachers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/pms/courses', { params: { q } })
      setData(res.data.items)
      setTotal(res.data.total)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tenantId])
  useEffect(() => {
    const id = setTimeout(() => { load() }, 300)
    return () => clearTimeout(id)
  }, [q, tenantId])

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

  const stats = useMemo(() => ({
    total: data.length,
    active: data.filter(c => c.is_active !== false).length,
    students: data.reduce((acc, c) => acc + (c.student_count || 0), 0)
  }), [data])

  const openForm = (course: Course | null) => {
    setImageFile(null)
    setImagePreview(null)
    setSaveError(null)
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
    setShowCreate(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Cursos</h1>
          <p className="text-gray-500 font-medium">Panel de gestión y programación de clases.</p>
        </div>
        <button
          onClick={() => openForm(null)}
          className="px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all"
        >
          + Crear Nuevo Curso
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Total Cursos', value: total, icon: HiOutlineCalendar, color: 'fuchsia' },
          { label: 'Activos', value: stats.active, icon: HiOutlineCheckCircle, color: 'emerald' },
          { label: 'Estudiantes', value: stats.students, icon: HiOutlineUserGroup, color: 'blue' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5">
            <div className={`p-4 rounded-2xl bg-${s.color}-50 text-${s.color}-600`}>
              <s.icon size={28} />
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</div>
              <div className="text-3xl font-black text-gray-900">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="relative group">
        <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={24} />
        <input
          className="w-full bg-white border-2 border-gray-100 rounded-3xl pl-14 pr-6 py-5 text-lg font-medium focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50 transition-all outline-none"
          placeholder="Buscar clases, instructores o niveles..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Courses List */}
      {loading ? (
        <div className="flex flex-col items-center py-20 gap-4">
           <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
           <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando...</span>
        </div>
      ) : (
        <div className="space-y-12">
          {grouped.map((g, idx) => (
            <div key={idx} className="space-y-6">
              <div className="flex items-center gap-4">
                 <h2 className="text-2xl font-black text-gray-900">{g.label}</h2>
                 <div className="h-1 flex-1 bg-gray-50 rounded-full overflow-hidden">
                    <div className="h-full w-20 bg-fuchsia-200 rounded-full" />
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {g.items.map((c, i) => (
                  <CourseCard key={c.id} c={c} idx={i} onOpen={() => window.location.href=`/courses/${c.id}`} onEdit={async () => {
                    const res = await api.get(`/api/pms/courses/${c.id}`)
                    openForm(res.data)
                  }} onDelete={async () => {
                    if(confirm('¿Eliminar curso?')) {
                      await api.delete(`/api/pms/courses/${c.id}`)
                      load()
                    }
                  }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar Completo */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={()=>setShowCreate(false)} />
           <div className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 my-8">
              <div className="bg-gradient-to-br from-fuchsia-600 to-purple-600 p-8 text-white flex justify-between items-center">
                 <div>
                    <h2 className="text-2xl font-black">{editId ? 'Editar Clase' : 'Nueva Clase'}</h2>
                    <p className="text-white/70 text-sm font-medium">Configura los detalles completos de la programación.</p>
                 </div>
                 <button onClick={()=>setShowCreate(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">✕</button>
              </div>

              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                 {/* Seccion 1: Info General */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                       <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del curso</label>
                          <input className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-50 transition-all outline-none" value={form.name || ''} onChange={(e)=>setForm({...form, name:e.target.value})} placeholder="Ej: Salsa Estilo Los Angeles" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nivel</label>
                             <input className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-50 transition-all outline-none" value={form.level || ''} onChange={(e)=>setForm({...form, level:e.target.value})} placeholder="Ej: Intermedio" />
                          </div>
                          <div>
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</label>
                             <select className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-50 transition-all outline-none" value={form.course_type || 'regular'} onChange={(e)=>setForm({...form, course_type:e.target.value})}>
                                <option value="regular">Regular</option>
                                <option value="choreography">Coreografía</option>
                             </select>
                          </div>
                       </div>
                    </div>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-[30px] p-4 bg-gray-50/30">
                       <div className="w-32 h-32 rounded-3xl bg-gray-100 overflow-hidden mb-4 shadow-inner relative border-2 border-gray-100">
                          {(imagePreview || form.image_url) ? (
                             <img src={imagePreview || toAbsoluteUrl(form.image_url)} className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-300"><HiOutlineCalendar size={48} /></div>
                          )}
                       </div>
                       <input type="file" ref={fileInputRef} className="hidden" onChange={(e)=>{
                          const file = e.target.files?.[0]
                          if(file) {
                             setImageFile(file)
                             const reader = new FileReader()
                             reader.onload = (ev) => setImagePreview(ev.target?.result as string)
                             reader.readAsDataURL(file)
                          }
                       }} />
                       <button onClick={()=>fileInputRef.current?.click()} className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest hover:underline">Cambiar Imagen</button>
                    </div>
                 </div>

                 {/* Seccion 2: Horarios */}
                 <div className="bg-fuchsia-50/30 p-6 rounded-[30px] border border-fuchsia-100/50 space-y-6">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 text-fuchsia-600 font-black text-xs uppercase tracking-widest">
                          <HiOutlineClock /> Programación de Clases
                       </div>
                    </div>
                    <div className="space-y-4">
                       {[1, 2, 3, 4, 5].map((num) => {
                          const suffix = num === 1 ? '' : `_${num}`
                          const dowKey = `day_of_week${suffix}`
                          const stKey = `start_time${suffix}`
                          const etKey = `end_time${suffix}`
                          return (
                             <div key={num} className="grid grid-cols-3 gap-4 pb-4 border-b border-fuchsia-100/30 last:border-0 last:pb-0">
                                <div>
                                   <label className="text-[9px] font-black text-gray-400 uppercase">Día {num}</label>
                                   <select className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 mt-1 font-bold text-sm focus:border-fuchsia-300 outline-none transition-all" value={form[dowKey] ?? ''} onChange={(e)=>setForm({...form, [dowKey]: e.target.value === '' ? null : Number(e.target.value)})}>
                                      <option value="">(No aplica)</option>
                                      {DAY_NAMES.map((n,i)=><option key={i} value={i}>{n}</option>)}
                                   </select>
                                </div>
                                <div>
                                   <label className="text-[9px] font-black text-gray-400 uppercase">Inicio</label>
                                   <input type="time" className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 mt-1 font-bold text-sm focus:border-fuchsia-300 outline-none transition-all" value={form[stKey] || ''} onChange={(e)=>setForm({...form, [stKey]:e.target.value})} />
                                </div>
                                <div>
                                   <label className="text-[9px] font-black text-gray-400 uppercase">Fin</label>
                                   <input type="time" className="w-full bg-white border-2 border-gray-100 rounded-xl px-4 py-3 mt-1 font-bold text-sm focus:border-fuchsia-300 outline-none transition-all" value={form[etKey] || ''} onChange={(e)=>setForm({...form, [etKey]:e.target.value})} />
                                </div>
                             </div>
                          )
                       })}
                    </div>
                 </div>

                 {/* Seccion 3: Instructores y Sala */}
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Instructor</label>
                        <select className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 outline-none transition-all" value={form.teacher_id || ''} onChange={(e)=>setForm({...form, teacher_id:e.target.value})}>
                            <option value="">Seleccionar...</option>
                            {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sala</label>
                        <select className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 outline-none transition-all" value={form.room_id || ''} onChange={(e)=>setForm({...form, room_id:e.target.value})}>
                            <option value="">Seleccionar...</option>
                            {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                 </div>

                 {/* Seccion 4: Precios y Cupos */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mensualidad ($)</label>
                        <input type="number" className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-50 transition-all outline-none" value={form.price || ''} onChange={(e)=>setForm({...form, price:e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Por Clase ($)</label>
                        <input type="number" className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-50 transition-all outline-none" value={form.class_price || ''} onChange={(e)=>setForm({...form, class_price:e.target.value})} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cupos Máx.</label>
                        <input type="number" className="w-full bg-white border-2 border-gray-100 rounded-2xl px-5 py-4 mt-2 font-bold focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-50 transition-all outline-none" value={form.max_capacity || ''} onChange={(e)=>setForm({...form, max_capacity:e.target.value})} />
                    </div>
                 </div>

                 {/* Seccion 5: Estado */}
                 <div className="flex items-center justify-between p-6 bg-gray-50 rounded-[30px] border border-gray-100">
                    <div>
                       <div className="font-black text-gray-900">Estado de Inscripción</div>
                       <div className="text-xs text-gray-500">Define si el curso está activo y visible para los alumnos.</div>
                    </div>
                    <button onClick={()=>setForm({...form, is_active: !form.is_active})} className={`w-14 h-8 rounded-full transition-all relative ${form.is_active ? 'bg-fuchsia-600' : 'bg-gray-300'}`}>
                       <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${form.is_active ? 'left-7' : 'left-1'}`} />
                    </button>
                 </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                 <button onClick={()=>setShowCreate(false)} className="flex-1 py-4 text-gray-400 font-black uppercase tracking-widest text-xs hover:text-gray-600 transition-colors">Cancelar</button>
                 <button disabled={saving} onClick={async () => {
                    setSaving(true)
                    try {
                       const fd = { ...form }
                       const clean = (val: any) => (val === "" || val === undefined) ? null : val
                       const fieldsToClean = [
                          'start_time', 'end_time', 'start_time_2', 'end_time_2', 
                          'start_time_3', 'end_time_3', 'start_time_4', 'end_time_4', 
                          'start_time_5', 'end_time_5', 'price', 'class_price', 
                          'max_capacity', 'teacher_id', 'room_id'
                       ]
                       fieldsToClean.forEach(f => { fd[f] = clean(fd[f]) })

                       let res
                       if(editId) res = await api.put(`/api/pms/courses/${editId}`, fd)
                       else res = await api.post('/api/pms/courses', fd)
                       
                       if(imageFile) {
                          const formData = new FormData()
                          formData.append('file', imageFile)
                          await api.post(`/api/pms/courses/${res.data.id}/image`, formData)
                       }
                       setShowCreate(false); load()
                    } catch(e:any) { 
                       const msg = e.response?.data?.detail 
                          ? (Array.isArray(e.response.data.detail) 
                              ? e.response.data.detail.map((d:any)=> d.msg).join(' | ') 
                              : e.response.data.detail)
                          : e.message
                       alert("Error al guardar: " + msg) 
                    }
                    finally { setSaving(false) }
                 }} className="flex-[2] py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Confirmar Cambios'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
