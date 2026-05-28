import { useEffect, useMemo, useRef, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import {
  HiOutlineClock,
  HiOutlineUser,
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
  total_classes?: number | null
  created_at?: string
  updated_at?: string
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '--:--')
const fmtDate = (value?: string | null) => {
  if (!value) return '--'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value).slice(0, 10)
  return dt.toLocaleDateString('es-CL')
}

function getCourseGradient(c: Course): string {
  if (c.is_active === false) return 'from-gray-300 to-gray-500'
  
  const name = (c.name || '').toLowerCase()
  
  // Asignar colores temáticos según el tipo de baile
  if (name.includes('salsa')) return 'from-amber-400 to-orange-500'
  if (name.includes('heel')) return 'from-fuchsia-500 to-pink-600'
  if (name.includes('bachata')) return 'from-indigo-500 to-blue-600'
  if (name.includes('ballet') || name.includes('lyrical')) return 'from-rose-400 to-pink-500'
  if (name.includes('reggaeton') || name.includes('urbano') || name.includes('dancehall')) return 'from-emerald-500 to-teal-600'
  if (name.includes('hip hop') || name.includes('k-pop') || name.includes('kpop')) return 'from-violet-500 to-purple-600'
  if (name.includes('contemporaneo') || name.includes('jazz')) return 'from-cyan-500 to-blue-500'
  if (name.includes('twerk')) return 'from-rose-500 to-red-600'

  // Fallback: usar el nombre del curso para generar un hash y asignar un color consistente
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const gradients = [
    'from-fuchsia-500 to-purple-600',
    'from-indigo-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-violet-500 to-indigo-600',
    'from-cyan-500 to-teal-500'
  ]
  return gradients[Math.abs(hash) % gradients.length]
}

export default function CoursesPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  
  const [showArchived, setShowArchived] = useState(false)
  const [deleteDecision, setDeleteDecision] = useState<Course | null>(null)
  const [archiveSimpleDecision, setArchiveSimpleDecision] = useState<Course | null>(null)
  const [archiveDecision, setArchiveDecision] = useState<{
    course: Course
    studentCount: number
    enrollmentIds: number[]
  } | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<any>({ is_active: true, course_type: 'regular' })
  const [visibleSlots, setVisibleSlots] = useState(1)
  const [teachers, setTeachers] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  
  const [saving, setSaving] = useState(false)
  const [nameRequiredError, setNameRequiredError] = useState(false)
  const [formRequiredError, setFormRequiredError] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasErr = (k: string) => Boolean(fieldErrors[k])
  const clearErr = (k: string) => setFieldErrors((prev) => ({ ...prev, [k]: false }))

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

  const activeCourses = useMemo(() => data.filter((c) => c.is_active !== false), [data])
  const archivedCourses = useMemo(() => data.filter((c) => c.is_active === false), [data])

  const setCourseActive = async (course: Course, isActive: boolean) => {
    const payload = {
      name: course.name,
      description: (course as any).description ?? null,
      level: course.level ?? null,
      image_url: course.image_url ?? null,
      course_type: course.course_type ?? null,
      total_classes: course.total_classes ?? null,
      classes_per_week: course.classes_per_week ?? null,
      day_of_week: course.day_of_week ?? null,
      start_time: course.start_time ?? null,
      end_time: course.end_time ?? null,
      day_of_week_2: course.day_of_week_2 ?? null,
      start_time_2: course.start_time_2 ?? null,
      end_time_2: course.end_time_2 ?? null,
      day_of_week_3: course.day_of_week_3 ?? null,
      start_time_3: course.start_time_3 ?? null,
      end_time_3: course.end_time_3 ?? null,
      day_of_week_4: course.day_of_week_4 ?? null,
      start_time_4: course.start_time_4 ?? null,
      end_time_4: course.end_time_4 ?? null,
      day_of_week_5: course.day_of_week_5 ?? null,
      start_time_5: course.start_time_5 ?? null,
      end_time_5: course.end_time_5 ?? null,
      teacher_id: (course as any).teacher_id ?? null,
      room_id: (course as any).room_id ?? null,
      start_date: course.start_date ?? null,
      max_capacity: (course as any).max_capacity ?? null,
      price: course.price ?? null,
      class_price: course.class_price ?? null,
      is_active: isActive,
    }
    await api.put(`/api/pms/courses/${course.id}`, payload)
    await load()
  }

  const fetchCourseActiveEnrollments = async (courseId: number) => {
    const res = await api.get('/api/pms/course_status')
    const rows = res.data || []
    const row = rows.find((r: any) => Number(r?.course?.id) === Number(courseId))
    const students = row?.students || []
    const enrollmentIds = students.map((s: any) => s.enrollment_id).filter(Boolean)
    return { studentCount: students.length, enrollmentIds }
  }

  const requestArchiveCourse = async (course: Course) => {
    const quickCount = Number(course.student_count || 0)
    if (quickCount <= 0) {
      setArchiveSimpleDecision(course)
      return
    }
    setArchiveLoading(true)
    try {
      const info = await fetchCourseActiveEnrollments(course.id)
      setArchiveDecision({
        course,
        studentCount: info.studentCount || quickCount,
        enrollmentIds: info.enrollmentIds || []
      })
    } catch {
      setArchiveDecision({
        course,
        studentCount: quickCount,
        enrollmentIds: []
      })
    } finally {
      setArchiveLoading(false)
    }
  }

  const archiveLeavingStudentsWithoutCourse = async () => {
    if (!archiveDecision) return
    setArchiveLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      for (const enrollmentId of archiveDecision.enrollmentIds) {
        await api.put(`/api/pms/enrollments/${enrollmentId}`, {
          is_active: false,
          end_date: today
        })
      }
      await setCourseActive(archiveDecision.course, false)
      setArchiveDecision(null)
    } finally {
      setArchiveLoading(false)
    }
  }

  const deleteCoursePermanently = async (course: Course) => {
    if (Number(course.student_count || 0) > 0) {
      setArchiveDecision({
        course,
        studentCount: Number(course.student_count || 0),
        enrollmentIds: []
      })
      return
    }
    await api.delete(`/api/pms/courses/${course.id}`)
    await load()
  }

  const grouped = useMemo(() => {
    const map = new Map<number | 'nd', { label: string, items: Course[] }>()
    for (const c of activeCourses) {
      const days = [
        c.day_of_week, 
        c.day_of_week_2, 
        c.day_of_week_3, 
        c.day_of_week_4, 
        c.day_of_week_5
      ].filter(d => d != null) as number[]

      if (days.length === 0) {
        if (!map.has('nd')) map.set('nd', { label: 'Sin día', items: [] })
        map.get('nd')!.items.push(c)
      } else {
        for (const day of Array.from(new Set(days))) {
          if (!map.has(day)) map.set(day, { label: DAY_NAMES[day], items: [] })
          map.get(day)!.items.push(c)
        }
      }
    }
    return Array.from(map.entries()).sort((a,b)=> (a[0] === 'nd' ? 99 : (a[0] as number)) - (b[0] === 'nd' ? 99 : (b[0] as number))).map(([,v])=>v)
  }, [activeCourses])

  const openForm = (course: Course | null) => {
    setImageFile(null); setImagePreview(null)
    if (!course) {
      setEditId(null)
      setForm({ is_active: true, course_type: 'regular', classes_per_week: 1 })
      setVisibleSlots(1)
      setNameRequiredError(false)
      setFormRequiredError(false)
      setFieldErrors({})
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
      const slots = course.classes_per_week || 
                    (course.day_of_week_5 != null ? 5 : 
                     course.day_of_week_4 != null ? 4 : 
                     course.day_of_week_3 != null ? 3 : 
                     course.day_of_week_2 != null ? 2 : 1)
      setVisibleSlots(slots)
      setNameRequiredError(false)
      setFormRequiredError(false)
      setFieldErrors({})
    }
    setShowForm(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Academia</span>
          <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">Cursos & Clases</h1>
          <p className="text-gray-500 font-medium text-xs md:text-sm">Administra tu oferta académica.</p>
        </div>
        <button
          onClick={() => openForm(null)}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black text-sm rounded-xl shadow-xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <HiOutlinePlus size={18} /> Crear Nuevo
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mx-0 bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full bg-transparent border-none rounded-full pl-12 pr-6 py-2.5 md:py-3 text-sm md:text-base font-bold text-gray-700 placeholder-gray-300 outline-none"
            placeholder="Buscar curso, nivel o instructor..."
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
        <div className="space-y-10 px-0 md:px-0">
          {grouped.map((g, idx) => (
            <div key={idx} className="space-y-4 md:space-y-6">
              <div className="flex items-center gap-3 md:gap-4">
                 <h2 className="text-xl md:text-2xl font-black text-gray-900">{g.label}</h2>
                 <div className="h-[2px] flex-1 bg-gray-100 rounded-full" />
                 <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{g.items.length} Clases</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {g.items.map((c, i) => (
                   <div key={c.id} className="group relative bg-white rounded-2xl md:rounded-[28px] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden cursor-pointer" onClick={() => window.location.href=`/courses/${c.id}`}>
                    {/* Visual Header */}
                    <div className={`h-32 md:h-36 relative bg-gradient-to-br ${getCourseGradient(c)}`}>
                       {c.image_url && <img src={toAbsoluteUrl(c.image_url)} className="w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:scale-110 transition-transform duration-700" />}
                       <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                       <div className="absolute top-4 right-4">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest backdrop-blur-md border border-white/20 ${c.is_active !== false ? 'bg-emerald-500/80 text-white' : 'bg-gray-500/80 text-white'}`}>
                             {c.is_active !== false ? 'Activo' : 'Inactivo'}
                          </span>
                       </div>
                       <div className="absolute bottom-4 left-5 right-5">
                          <div className="text-[9px] font-black text-white/80 uppercase tracking-widest mb-1">{c.level || 'Nivel General'}</div>
                          <div className="text-xl font-black text-white leading-tight line-clamp-1">{c.name}</div>
                       </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                       <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                          <div className="flex items-center gap-2">
                             <div className="w-7 h-7 rounded-full bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center font-black text-[10px]">
                                {c.student_count || 0}
                             </div>
                             <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Alumnos</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <HiOutlineLocationMarker className="text-fuchsia-300" size={12} />
                             <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{c.room_name || 'Sin Sala'}</span>
                          </div>
                       </div>

                       <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                             <HiOutlineClock className="text-fuchsia-600" size={12} /> Horarios
                          </div>
                          <div className="space-y-1">
                             {[
                               { d: c.day_of_week, st: c.start_time, et: c.end_time },
                               { d: c.day_of_week_2, st: c.start_time_2, et: c.end_time_2 },
                               { d: c.day_of_week_3, st: c.start_time_3, et: c.end_time_3 }
                             ].filter(s => s.d != null).map((s, si) => (
                               <div key={si} className="flex items-center justify-between text-[11px]">
                                  <span className="font-black text-gray-700">{DAY_NAMES[s.d!]}</span>
                                  <span className="font-bold text-gray-400">{hhmm(s.st)} - {hhmm(s.et)}</span>
                               </div>
                             ))}
                          </div>
                       </div>

                       <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-[8px] font-black text-gray-400 uppercase leading-none mb-1">
                                {c.course_type === 'choreography' ? 'Total Proyecto' : 'Mensual'}
                             </span>
                             <span className="text-base font-black text-gray-900 leading-none">{fmtCLP.format(Number(c.price || 0))}</span>
                             {c.course_type === 'choreography' && c.total_classes && (
                                <span className="text-[8px] font-bold text-fuchsia-400 uppercase mt-1">{c.total_classes} clases</span>
                             )}
                          </div>
                          <div className="text-right min-w-0">
                             <div className="text-[9px] font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors truncate">{c.teacher_name || 'Sin Instructor'}</div>
                             <div className="text-[8px] font-bold text-gray-400 uppercase leading-none">Instructor</div>
                          </div>
                       </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="absolute top-3 left-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0">
                       <button onClick={(e)=>{e.stopPropagation(); openForm(c)}} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-xl text-white shadow-xl transition-all">
                          <HiOutlinePencil size={16} />
                       </button>
                        <button onClick={async (e)=>{
                           e.stopPropagation()
                           await requestArchiveCourse(c)

                        }} className="p-2 bg-rose-500/80 hover:bg-rose-600 backdrop-blur-md rounded-xl text-white shadow-xl transition-all">
                           <HiOutlineTrash size={16} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-4 md:p-6">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-lg font-black text-gray-900">Historial de Cursos</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {archivedCourses.length} archivado(s)
              </p>
            </div>
            <span className="text-xs font-black text-fuchsia-600 uppercase tracking-widest">
              {showArchived ? 'Ocultar' : 'Ver historial'}
            </span>
          </button>

          {showArchived && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {archivedCourses.length === 0 && (
                <div className="text-sm font-bold text-gray-400">No hay cursos archivados.</div>
              )}
              {archivedCourses.map((c) => (
                <div key={`arch-${c.id}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-black text-gray-800">{c.name}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                    {c.teacher_name || 'Sin instructor'}
                  </div>
                  <div className="mt-2 space-y-1 text-[10px] font-bold text-gray-500">
                    <div>Inicio: <span className="text-gray-700">{fmtDate(c.start_date)}</span></div>
                    <div>Archivado: <span className="text-gray-700">{fmtDate(c.updated_at)}</span></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={async () => {
                        if (confirm('Reactivar este curso?')) await setCourseActive(c, true)
                      }}
                      className="w-full py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                    >
                      Reactivar
                    </button>
                    <button
                      onClick={() => setDeleteDecision(c)}
                      className="w-full py-2 rounded-lg bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-colors"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {archiveDecision && (
        <div className="fixed left-0 top-0 z-[9999] h-screen w-screen flex items-center justify-center p-4">
          <div className="fixed left-0 top-0 h-screen w-screen bg-black/60 backdrop-blur-sm" onClick={() => !archiveLoading && setArchiveDecision(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-gray-900">Curso con alumnos activos</h3>
            <p className="text-sm text-gray-600">
              Este curso tiene <span className="font-black">{archiveDecision.studentCount}</span> alumno(s) activo(s).
              Debes trasladarlos o dejarlos sin curso activo antes de archivarlo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setArchiveDecision(null)
                  navigate('/course-status')
                }}
                disabled={archiveLoading}
                className="py-3 rounded-xl bg-fuchsia-600 text-white text-xs font-black uppercase tracking-widest hover:bg-fuchsia-700 disabled:opacity-60"
              >
                Ir a Trasladar
              </button>
              <button
                onClick={archiveLeavingStudentsWithoutCourse}
                disabled={archiveLoading}
                className="py-3 rounded-xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-60"
              >
                Dejar Sin Curso
              </button>
            </div>
            <button
              onClick={() => setArchiveDecision(null)}
              disabled={archiveLoading}
              className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-200 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {archiveSimpleDecision && (
        <div className="fixed left-0 top-0 z-[9999] h-screen w-screen flex items-center justify-center p-4">
          <div className="fixed left-0 top-0 h-screen w-screen bg-black/60 backdrop-blur-sm" onClick={() => setArchiveSimpleDecision(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-gray-900">Archivar curso</h3>
            <p className="text-sm text-gray-600">
              El curso <span className="font-black">{archiveSimpleDecision.name}</span> pasará al historial y no se eliminará.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setArchiveSimpleDecision(null)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await setCourseActive(archiveSimpleDecision, false)
                    setArchiveSimpleDecision(null)
                  } catch (e: any) {
                    alert('No se pudo archivar el curso: ' + (e?.response?.data?.detail || e?.message || 'Error'))
                  }
                }}
                className="py-3 rounded-xl bg-fuchsia-600 text-white text-xs font-black uppercase tracking-widest hover:bg-fuchsia-700"
              >
                Archivar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDecision && (
        <div className="fixed left-0 top-0 z-[9999] h-screen w-screen flex items-center justify-center p-4">
          <div className="fixed left-0 top-0 h-screen w-screen bg-black/60 backdrop-blur-sm" onClick={() => setDeleteDecision(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-black text-gray-900">Eliminar curso definitivamente</h3>
            <p className="text-sm text-gray-600">
              Esta accion no se puede deshacer. Se eliminará el curso <span className="font-black">{deleteDecision.name}</span>.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleteDecision(null)}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-xs font-black uppercase tracking-widest hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await deleteCoursePermanently(deleteDecision)
                  setDeleteDecision(null)
                }}
                className="py-3 rounded-xl bg-rose-600 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="relative z-[60]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
           <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" onClick={()=>setShowForm(false)} />
           <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
             <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
               <div className="relative w-full max-w-4xl max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)] bg-white rounded-[24px] md:rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-gray-100">
                  <div className="p-5 md:p-8 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white flex justify-between items-center shrink-0">
                     <div>
                        <h2 className="text-xl md:text-2xl font-black">{editId ? 'Editar Clase' : 'Nueva Clase'}</h2>
                        <p className="text-fuchsia-100 font-bold uppercase tracking-widest text-[8px] md:text-[9px] mt-1">Configuración de programa</p>
                     </div>
                     <button onClick={()=>setShowForm(false)} className="p-2 md:p-3 hover:bg-white/10 rounded-xl transition-colors">
                        <HiOutlineX size={24} />
                     </button>
                  </div>

                  <div className="p-6 md:p-8 flex-1 min-h-0 overflow-y-auto space-y-6 md:space-y-8 custom-scrollbar bg-gray-50/30">
                     <div className="flex flex-col-reverse md:grid md:grid-cols-12 gap-6 md:gap-10">
                        <div className="md:col-span-8 space-y-6 md:space-y-8">
                           <div className="space-y-2">
                              <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre del Curso <span className="text-rose-500">*</span></label>
                              <input
                                className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 transition-all outline-none shadow-sm ${
                                  nameRequiredError
                                    ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50'
                                    : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'
                                }`}
                                value={form.name || ''}
                                onChange={(e) => {
                                  setForm({ ...form, name: e.target.value })
                                  if (e.target.value.trim()) {
                                    setNameRequiredError(false)
                                    setFormRequiredError(false)
                                  }
                                }}
                                placeholder="Ej: Salsa Cubana"
                              />
                              {nameRequiredError && (
                                <p className="text-rose-600 text-xs font-black px-2">te falta rellenar un campo</p>
                              )}
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                              <div className="space-y-2">
                                 <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nivel <span className="text-rose-500">*</span></label>
                                 <select className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none appearance-none shadow-sm ${hasErr('level') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.level || ''} onChange={(e)=>{setForm({...form, level:e.target.value}); if(e.target.value) clearErr('level')}}>
                                    <option value="">Seleccionar nivel...</option>
                                    <option value="Básico">Básico</option>
                                    <option value="Intermedio">Intermedio</option>
                                    <option value="Avanzado">Avanzado</option>
                                 </select>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Tipo de Programa <span className="text-rose-500">*</span></label>
                                 <select className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none appearance-none shadow-sm ${hasErr('course_type') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.course_type || 'regular'} onChange={(e)=>{setForm({...form, course_type:e.target.value}); if(e.target.value) clearErr('course_type')}}>
                                    <option value="regular">Regular</option>
                                    <option value="choreography">Coreografía</option>
                                 </select>
                              </div>
                              <div className="space-y-2">
                                 <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Clases por Semana <span className="text-rose-500">*</span></label>
                                 <select 
                                    className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none appearance-none shadow-sm ${hasErr('classes_per_week') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} 
                                    value={form.classes_per_week || 1} 
                                    onChange={(e)=>{
                                       const v = Number(e.target.value)
                                       setForm({...form, classes_per_week: v})
                                       setVisibleSlots(v)
                                       clearErr('classes_per_week')
                                    }}
                                 >
                                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} clase{n>1?'s':''} / sem</option>)}
                                 </select>
                              </div>
                              {form.course_type === 'choreography' && (
                                 <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                    <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Total Clases del Proyecto <span className="text-rose-500">*</span></label>
                                    <input 
                                       type="number" 
                                       className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 transition-all outline-none shadow-sm ${hasErr('total_classes') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} 
                                       value={form.total_classes || ''} 
                                       onChange={(e)=>{setForm({...form, total_classes: e.target.value==='' ? null : Number(e.target.value)}); if(e.target.value) clearErr('total_classes')}} 
                                       placeholder="Ej: 8" 
                                    />
                                 </div>
                              )}
                           </div>
                        </div>
                        <div className="md:col-span-4">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-2 block">Imagen del Curso</label>
                           <div className="relative group aspect-square md:aspect-square rounded-2xl md:rounded-[32px] bg-white shadow-sm border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:border-fuchsia-400 transition-colors cursor-pointer" onClick={()=>fileInputRef.current?.click()}>
                              {(imagePreview || form.image_url) ? (
                                 <img src={imagePreview || toAbsoluteUrl(form.image_url)} className="w-full h-full object-cover" />
                              ) : (
                                 <>
                                    <HiOutlinePhotograph size={48} className="text-gray-200 group-hover:text-fuchsia-200 transition-colors" />
                                    <span className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase mt-2 md:mt-4">Subir Foto</span>
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
                      <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm space-y-4 md:space-y-6">
                        <div className="flex items-center gap-3 text-fuchsia-600 font-black uppercase tracking-widest text-[9px] md:text-[10px]">
                           <HiOutlineClock size={18} /> Programación Semanal <span className="text-rose-500">*</span>
                        </div>
                        <div className="space-y-3 md:space-y-4">
                           {[1,2,3,4,5].slice(0, visibleSlots).map(num => {
                              const suffix = num === 1 ? '' : `_${num}`
                              const dowK = `day_of_week${suffix}`; const stK = `start_time${suffix}`; const etK = `end_time${suffix}`
                              return (
                                 <div key={num} className="grid grid-cols-12 gap-2 md:gap-4 pb-3 md:pb-4 border-b border-gray-50 last:border-0 last:pb-0 items-end">
                                    <div className="col-span-5 md:col-span-4">
                                       <select className={`w-full bg-gray-50 border px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm outline-none focus:bg-white appearance-none ${hasErr(dowK) ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-transparent focus:ring-2 focus:ring-fuchsia-100'}`} value={form[dowK] ?? ''} onChange={(e)=>{setForm({...form, [dowK]: e.target.value==='' ? null : Number(e.target.value)}); if(e.target.value!=='') clearErr(dowK)}}>
                                          <option value="">(No asig.)</option>
                                          {DAY_NAMES.map((n,i)=><option key={i} value={i}>{n.slice(0,3)}</option>)}
                                       </select>
                                    </div>
                                    <div className="col-span-3 md:col-span-4">
                                       <input type="time" className={`w-full bg-gray-50 border px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm outline-none focus:bg-white ${hasErr(stK) ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-transparent focus:ring-2 focus:ring-fuchsia-100'}`} value={form[stK] || ''} onChange={(e)=>{setForm({...form, [stK]:e.target.value}); if(e.target.value) clearErr(stK)}} />
                                    </div>
                                    <div className="col-span-4 md:col-span-4">
                                       <input type="time" className={`w-full bg-gray-50 border px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl font-bold text-xs md:text-sm outline-none focus:bg-white ${hasErr(etK) ? 'border-rose-300 focus:ring-2 focus:ring-rose-100' : 'border-transparent focus:ring-2 focus:ring-fuchsia-100'}`} value={form[etK] || ''} onChange={(e)=>{setForm({...form, [etK]:e.target.value}); if(e.target.value) clearErr(etK)}} />
                                    </div>
                                 </div>
                              )
                           })}
                        </div>
                      </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-2 relative">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Instructor Principal <span className="text-rose-500">*</span></label>
                           <select className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none appearance-none shadow-sm ${hasErr('teacher_id') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.teacher_id || ''} onChange={(e)=>{setForm({...form, teacher_id:e.target.value}); if(e.target.value) clearErr('teacher_id')}}>
                              <option value="">Instructor...</option>
                              {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                           </select>
                        </div>
                        <div className="space-y-2 relative">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Sala Asignada</label>
                           <select className="w-full bg-white border-2 border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none appearance-none shadow-sm" value={form.room_id || ''} onChange={(e)=>setForm({...form, room_id:e.target.value})}>
                              <option value="">Sala...</option>
                              {rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                           </select>
                        </div>
                     </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <div className="space-y-2">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha Inicio <span className="text-rose-500">*</span></label>
                           <input type="date" className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none shadow-sm ${hasErr('start_date') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.start_date || ''} onChange={(e)=>{setForm({...form, start_date:e.target.value}); if(e.target.value) clearErr('start_date')}} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Mensualidad ($) <span className="text-rose-500">*</span></label>
                           <input type="number" className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none shadow-sm ${hasErr('price') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.price || ''} onChange={(e)=>{setForm({...form, price:e.target.value}); if(e.target.value!=='') clearErr('price')}} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Clase Suelta ($) <span className="text-rose-500">*</span></label>
                           <input type="number" className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none shadow-sm ${hasErr('class_price') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.class_price || ''} onChange={(e)=>{setForm({...form, class_price:e.target.value}); if(e.target.value!=='') clearErr('class_price')}} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Capacidad Máx. <span className="text-rose-500">*</span></label>
                           <input type="number" className={`w-full bg-white border-2 px-4 md:px-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-gray-700 outline-none shadow-sm ${hasErr('max_capacity') ? 'border-rose-400 focus:border-rose-500 focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50'}`} value={form.max_capacity || ''} onChange={(e)=>{setForm({...form, max_capacity:e.target.value}); if(e.target.value!=='') clearErr('max_capacity')}} />
                        </div>
                     </div>
                  </div>

                  <div className="p-6 md:p-8 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-6 md:gap-0">
                     <button onClick={()=>setForm({...form, is_active: !form.is_active})} className="flex items-center gap-3 md:gap-4 group w-full sm:w-auto justify-center">
                        <div className={`w-10 md:w-14 h-6 md:h-8 rounded-full flex items-center p-1 transition-all ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                           <div className={`w-4 md:w-6 h-4 md:h-6 bg-white rounded-full shadow-sm transition-transform ${form.is_active ? 'translate-x-4 md:translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-[10px] md:text-sm font-black text-gray-700 uppercase tracking-widest">Activo</span>
                     </button>
                     
                     <div className="flex gap-3 md:gap-4 w-full sm:w-auto">
                        <button onClick={()=>setShowForm(false)} className="flex-1 sm:flex-none px-6 py-4 font-black uppercase tracking-widest text-[9px] md:text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                        <button
                          disabled={saving}
                          onClick={async () => {
                             const nextErrors: Record<string, boolean> = {}
                             const missingName = !form.name?.trim()
                             const missingLevel = !form.level
                             const missingType = !form.course_type
                             const missingWeeklyClasses = !form.classes_per_week || Number(form.classes_per_week) < 1
                             const missingTeacher = !form.teacher_id
                             const missingStartDate = !form.start_date
                             const missingPrice = form.price === '' || form.price == null
                             const missingClassPrice = form.class_price === '' || form.class_price == null
                             const missingCapacity = form.max_capacity === '' || form.max_capacity == null
                             const missingTotalClasses = form.course_type === 'choreography' && (form.total_classes === '' || form.total_classes == null)

                             let missingSchedule = false
                             for (let num = 1; num <= visibleSlots; num++) {
                               const suffix = num === 1 ? '' : `_${num}`
                               const dowK = `day_of_week${suffix}`
                               const stK = `start_time${suffix}`
                               const etK = `end_time${suffix}`
                               if (form[dowK] == null || form[dowK] === '' || !form[stK] || !form[etK]) {
                                 missingSchedule = true
                                 if (form[dowK] == null || form[dowK] === '') nextErrors[dowK] = true
                                 if (!form[stK]) nextErrors[stK] = true
                                 if (!form[etK]) nextErrors[etK] = true
                               }
                             }

                             if (missingLevel) nextErrors.level = true
                             if (missingType) nextErrors.course_type = true
                             if (missingWeeklyClasses) nextErrors.classes_per_week = true
                             if (missingTeacher) nextErrors.teacher_id = true
                             if (missingStartDate) nextErrors.start_date = true
                             if (missingPrice) nextErrors.price = true
                             if (missingClassPrice) nextErrors.class_price = true
                             if (missingCapacity) nextErrors.max_capacity = true
                             if (missingTotalClasses) nextErrors.total_classes = true

                             if (
                               missingName ||
                               missingLevel ||
                               missingType ||
                               missingWeeklyClasses ||
                               missingTeacher ||
                               missingStartDate ||
                               missingPrice ||
                               missingClassPrice ||
                               missingCapacity ||
                               missingTotalClasses ||
                               missingSchedule
                             ) {
                                setNameRequiredError(missingName)
                                setFormRequiredError(true)
                                setFieldErrors(nextErrors)
                                return
                             }
                             setNameRequiredError(false)
                             setFormRequiredError(false)
                             setFieldErrors({})
                             setSaving(true)
                             try {
                               const fd = { ...form }
                               const clean = (v:any) => (v===""||v===undefined)?null:v
                               const keys = ['start_time','end_time','start_time_2','end_time_2','start_time_3','end_time_3','start_time_4','end_time_4','start_time_5','end_time_5','price','class_price','max_capacity','teacher_id','room_id','start_date','total_classes','classes_per_week']
                               keys.forEach(k=> fd[k]=clean(fd[k]))
                               let r; if(editId) r=await api.put(`/api/pms/courses/${editId}`, fd); else r=await api.post('/api/pms/courses', fd)
                               if(imageFile){ const f=new FormData(); f.append('file', imageFile); await api.post(`/api/pms/courses/${r.data.id}/image`, f) }
                               setShowForm(false); load()
                             } catch(e:any){ alert("Error: "+ (e.response?.data?.detail || e.message)) }
                             finally { setSaving(false) }
                          }}
                          className="px-10 py-5 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                           {saving ? 'Guardando...' : editId ? 'Actualizar Programa' : 'Crear Programa'}
                        </button>
                     </div>
                     {formRequiredError && (
                        <p className="text-center text-rose-600 text-[10px] md:text-xs font-black uppercase tracking-wider bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
                           faltan campos obligatorios
                        </p>
                     )}
                  </div>
               </div>
             </div>
           </div>
        </div>
      )}
    </div>
  )
}

