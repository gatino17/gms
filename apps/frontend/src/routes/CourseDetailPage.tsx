import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { 
  HiOutlineChevronLeft, 
  HiOutlineUserGroup, 
  HiOutlineCheckCircle, 
  HiOutlineClock, 
  HiOutlineCalendar,
  HiOutlineStar,
  HiOutlineLightningBolt,
  HiOutlineTicket,
  HiOutlineUser
} from 'react-icons/hi'
import { IoMale, IoFemale } from 'react-icons/io5'

type StudentRow = {
  id: number
  first_name: string
  last_name: string
  gender?: string | null
  enrolled_since?: string | null
  renewal_date?: string | null
  payment_status?: 'activo' | 'pendiente'
  attendance_count?: number
  birthday_today?: boolean
  attended_today?: boolean
  photo_url?: string | null
}

const fmtCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

function ymdToCL(ymd?: string | null): string { 
  if (!ymd) return ''; 
  const [y,m,d] = ymd.split('-').map(Number); 
  const dt = new Date(y, (m||1)-1, d||1); 
  return dt.toLocaleDateString('es-CL', { day:'2-digit', month:'short' }) 
}

export default function CourseDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { tenantId } = useTenant()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attLoadingId, setAttLoadingId] = useState<number | null>(null)
  const [attendedToday, setAttendedToday] = useState<Set<number>>(new Set())
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [stuStats, setStuStats] = useState<Record<number, { expected: number; attended: number }>>({})

  const fetchTodayAttendance = async () => {
    if (!id) return new Set<number>()
    try {
      const res = await api.get('/api/pms/attendance/today', { params: { course_id: Number(id) } })
      return new Set((res.data?.student_ids ?? []) as number[])
    } catch { return new Set<number>() }
  }

  const fetchDetail = async () => {
    if (!id || tenantId == null) return
    setLoading(true); setError(null)
    try {
      const res = await api.get('/api/pms/course_status', { params: { course_id: Number(id), attendance_days: 30 } })
      const rows = res.data as any[]
      const mainData = rows[0] || null
      setData(mainData)

      const s = new Set<number>()
      if (mainData?.students) {
        for (const st of mainData.students as StudentRow[]) {
          if (st.attended_today) s.add(st.id)
        }
      }
      if (s.size > 0) setAttendedToday(s)
      else setAttendedToday(await fetchTodayAttendance())

    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el curso')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchDetail() }, [id, tenantId])

  const counts = useMemo(() => {
    const students: StudentRow[] = data?.students ?? []
    const total = students.length
    const activos = students.filter(s => s.payment_status === 'activo').length
    const pendientes = total - activos
    const female = students.filter(s =>
      (s.gender || '').toLowerCase().startsWith('f') ||
      (s.gender || '').toLowerCase().startsWith('muj')
    ).length
    const male = students.filter(s => {
      const g = (s.gender || '').toLowerCase()
      return (g.startsWith('m') && !g.startsWith('muj')) || g.startsWith('h')
    }).length
    return { total, activos, pendientes, female, male }
  }, [data])

  async function markAttendance(studentId: number) {
    if (!id) return
    try {
      setAttLoadingId(studentId)
      await api.post('/api/pms/attendance', { 
        student_id: studentId, 
        course_id: Number(id),
        is_recovery: isRecoveryMode
      })
      setAttendedToday(prev => new Set(prev).add(studentId))
      fetchDetail() // Refresh to update counts
    } catch (e: any) {
      alert(e?.message || 'No se pudo marcar asistencia')
    } finally { setAttLoadingId(null) }
  }

  if (loading && !data) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
      <span className="text-fuchsia-600 font-black tracking-widest text-xs uppercase">Cargando detalles...</span>
    </div>
  )

  if (!data && !loading) return (
    <div className="text-center py-20 bg-white rounded-[40px] border border-gray-100 shadow-sm">
       <div className="text-4xl mb-4">📭</div>
       <h3 className="text-xl font-black text-gray-900">No se encontró el curso</h3>
       <Link to="/courses" className="mt-4 inline-flex items-center text-fuchsia-600 font-bold hover:underline">Volver al catálogo</Link>
    </div>
  )

  const course = data?.course || {}
  const teacher = data?.teacher || {}
  const room = data?.room || {}

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4">
        <button onClick={() => navigate('/courses')} className="group flex items-center gap-2 text-gray-400 hover:text-fuchsia-600 transition-colors">
           <div className="p-2 rounded-xl group-hover:bg-fuchsia-50 transition-colors"><HiOutlineChevronLeft size={20} /></div>
           <span className="font-black uppercase tracking-widest text-[10px]">Volver al Catálogo</span>
        </button>
      </div>

      {/* Hero Section */}
      <div className="relative bg-white md:rounded-[40px] shadow-sm border-y md:border border-gray-100 overflow-hidden mx-0 md:mx-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px]">
          {/* Info */}
          <div className="p-6 md:p-8 lg:p-12 space-y-6 md:space-y-8">
            <div className="space-y-3 md:space-y-4 text-center md:text-left">
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                 <span className="px-2 md:px-3 py-1 bg-fuchsia-100 text-fuchsia-700 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-full">{course.level || 'Sin Nivel'}</span>
                 <span className="px-2 md:px-3 py-1 bg-purple-100 text-purple-700 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-full">{course.course_type || 'Regular'}</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 tracking-tight leading-tight">{course.name}</h1>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 md:gap-6 text-gray-500 font-bold text-sm md:text-base">
                 <div className="flex items-center gap-2"><HiOutlineUserGroup className="text-fuchsia-500" /> {teacher.name || 'Sin Instructor'}</div>
                 <div className="flex items-center gap-2"><HiOutlineCalendar className="text-fuchsia-500" /> Sala: {room.name || 'Gral.'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               {[
                 { label: 'Alumnos', value: counts.total, icon: HiOutlineUserGroup, color: 'fuchsia' },
                 { label: 'Precio', value: fmtCLP(course.price || 0), icon: HiOutlineTicket, color: 'emerald' },
                 { label: 'Inicio', value: ymdToCL(course.start_date) || '---', icon: HiOutlineCalendar, color: 'indigo' },
                 { label: 'Estado', value: course.is_active !== false ? 'Abierta' : 'Cerrada', icon: HiOutlineStar, color: 'blue' },
                 { label: 'Sesiones', value: `${course.classes_per_week || 1}/sem`, icon: HiOutlineClock, color: 'amber' },
                 { 
                   label: 'Género', 
                   value: (
                     <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1.5">
                         <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
                           <IoMale size={14} />
                         </div>
                         <span className="text-sm md:text-base">{counts.male}</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         <div className="w-6 h-6 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100 shadow-sm">
                           <IoFemale size={14} />
                         </div>
                         <span className="text-sm md:text-base">{counts.female}</span>
                       </div>
                     </div>
                   ), 
                   icon: HiOutlineUser, 
                   color: 'rose' 
                 },
               ].map((s, i) => (
                 <div key={i} className="bg-gray-50/50 p-4 rounded-2xl md:rounded-3xl border border-gray-100 flex flex-col items-center md:items-start">
                    <div className={`text-${s.color}-600 mb-2`}><s.icon size={18} /></div>
                    <div className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest">{s.label}</div>
                    <div className="text-base md:text-lg font-black text-gray-900 mt-1">{s.value}</div>
                 </div>
               ))}
            </div>
          </div>

          {/* Image */}
          <div className="h-48 md:h-64 lg:h-auto bg-gray-100 relative order-first lg:order-last">
             {course.image_url ? (
               <img src={toAbsoluteUrl(course.image_url)} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full bg-gradient-to-br from-fuchsia-600 to-purple-600 flex items-center justify-center text-white/20">
                  <HiOutlineLightningBolt size={80} className="md:w-[120px] md:h-[120px]" />
               </div>
             )}
             <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-white via-transparent to-transparent opacity-50 md:opacity-100" />
          </div>
        </div>
      </div>

      {/* Students Section */}
      <div className="space-y-6 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div className="flex flex-col md:flex-row items-center gap-4">
              <h2 className="text-2xl font-black text-gray-900 text-center md:text-left">Lista de Alumnos</h2>
              <button 
                onClick={() => setIsRecoveryMode(!isRecoveryMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl border-2 transition-all ${isRecoveryMode ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
              >
                <div className={`w-3 h-3 rounded-full ${isRecoveryMode ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{isRecoveryMode ? 'Recuperación Activa' : 'Modo Normal'}</span>
              </button>
           </div>
           <div className="flex flex-wrap justify-center md:justify-end gap-3 md:gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 rounded-xl border border-pink-100">
                 <span className="text-sm">👩</span>
                 <span className="text-[9px] font-black text-pink-700">{counts.female}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-xl border border-sky-100">
                 <span className="text-sm">👨</span>
                 <span className="text-[9px] font-black text-sky-700">{counts.male}</span>
              </div>
              <div className="hidden md:block w-px h-6 bg-gray-100" />
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-gray-500">OK</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span className="text-[10px] font-bold text-gray-500">PEND</span></div>
           </div>
        </div>

        <div className="bg-white md:rounded-[40px] shadow-sm border-y md:border border-gray-100 overflow-hidden mx-0 md:-mx-4">
          <table className="w-full">
            <thead className="hidden md:table-header-group">
              <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumno</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Próxima Renovación</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Asistencia</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 block md:table-row-group">
              {(data.students || []).map((s: StudentRow) => {
                const isPaid = s.payment_status === 'activo'
                const hasAtt = attendedToday.has(s.id) || !!s.attended_today

                return (
                  <tr key={s.id} className="block md:table-row hover:bg-fuchsia-50/20 transition-colors">
                    <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6">
                       <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 overflow-hidden ${isPaid ? 'bg-fuchsia-100 text-fuchsia-600' : 'bg-gray-100 text-gray-400'}`}>
                             {s.photo_url ? (
                                <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" />
                             ) : (
                                `${s.first_name[0]}${s.last_name[0]}`
                             )}
                          </div>
                          <div className="min-w-0">
                             <div className="font-black text-gray-900 truncate">{s.first_name} {s.last_name}</div>
                             <div className="text-[9px] font-bold text-gray-400 uppercase">Alumno #{s.id}</div>
                          </div>
                       </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-left md:text-center">
                       <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isPaid ? 'Al día' : 'Pendiente'}
                       </span>
                    </td>
                    <td className="hidden md:table-cell px-6 py-6 text-center font-bold text-sm text-gray-600">
                       {s.renewal_date ? ymdToCL(s.renewal_date) : '---'}
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-left md:text-center">
                       <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Asistencia Hoy</div>
                       {hasAtt ? (
                         <div className="inline-flex items-center gap-1.5 text-emerald-600 font-black text-[10px] uppercase">
                            <HiOutlineCheckCircle size={16} /> Presente
                         </div>
                       ) : (
                         <span className="text-gray-300 font-bold text-[10px] uppercase tracking-widest">Ausente</span>
                       )}
                    </td>
                    <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6 text-left md:text-right">
                       <div className="flex items-center gap-2">
                          {!hasAtt && (
                            <button 
                               disabled={attLoadingId === s.id}
                               onClick={() => markAttendance(s.id)}
                               className={`flex-1 md:flex-none px-4 py-2.5 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 ${isRecoveryMode ? 'bg-blue-500 hover:bg-blue-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                            >
                               {attLoadingId === s.id ? '...' : 'Presente'}
                            </button>
                          )}
                          <button 
                             onClick={() => navigate(`/students/${s.id}`)}
                             className="flex-1 md:flex-none px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-gray-100"
                          >
                             Perfil
                          </button>
                       </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {(!data.students || data.students.length === 0) && (
             <div className="py-20 text-center text-gray-400 font-bold italic px-4">
                No hay alumnos inscritos en este curso todavía.
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
