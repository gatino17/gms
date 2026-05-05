import { useEffect, useState, useMemo } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineSearch, 
  HiOutlineFilter, 
  HiOutlineRefresh, 
  HiOutlineChevronRight, 
  HiOutlineCake, 
  HiOutlineViewGrid, 
  HiOutlineViewList,
  HiOutlineChartBar,
  HiOutlineExclamationCircle 
} from 'react-icons/hi'
import { useTenant } from '../lib/tenant'
import RenewModal from '../components/RenewModal'

type CourseRow = {
  course: { id: number; name: string; level?: string; start_date?: string | null; price?: number | null; classes_per_week?: number | null; day_of_week?: number | null }
  teacher?: { id: number | null; name?: string | null } | null
  counts?: { total: number; female: number; male: number }
  students: {
    id: number;
    enrollment_id?: number;
    photo_url?: string | null;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    renewal_date?: string | null;
    payment_status?: 'activo' | 'pendiente';
    attendance_count?: number;
    expected_count?: number;
    birthday_today?: boolean;
  }[]
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const fmtCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

export default function CourseStatusPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const [data, setData] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [renewModalData, setRenewModalData] = useState<{ studentId: number; courseId: number; enrollmentId: number } | null>(null)
  
  // View state: 'detailed' | 'compact' | 'summary'
  const [viewMode, setViewMode] = useState<'detailed' | 'compact' | 'summary'>('detailed')
  
  // Filters
  const [courseQ, setCourseQ] = useState('')
  const [studentQ, setStudentQ] = useState('')
  const [selectedDay, setSelectedDay] = useState<string>('')
  
  const load = async () => {
    if (tenantId == null) return
    setLoading(true)
    try {
      const params: any = { course_q: courseQ, student_q: studentQ }
      if (selectedDay !== '') params.day_of_week = Number(selectedDay)
      
      const [res, tenantRes] = await Promise.all([
        api.get('/api/pms/course_status', { params }),
        api.get('/api/pms/tenants/me')
      ])
      
      setData(res.data || [])
      setTenantInfo(tenantRes.data)
    } catch (e: any) {
      setError('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId])
  useEffect(() => {
    const id = setTimeout(() => load(), 400)
    return () => clearTimeout(id)
  }, [courseQ, studentQ, selectedDay])

  const filteredData = useMemo(() => {
    if (!studentQ) return data
    return data.map(row => ({
      ...row,
      students: row.students.filter(s => 
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(studentQ.toLowerCase())
      )
    })).filter(row => row.students.length > 0 || !studentQ)
  }, [data, studentQ])

  const groupedByDay = useMemo(() => {
    const groups: Record<string, CourseRow[]> = {}
    filteredData.forEach(row => {
      const d = row.course.day_of_week ?? 0
      const dayName = DAY_NAMES[d] || 'Sin día'
      if (!groups[dayName]) groups[dayName] = []
      groups[dayName].push(row)
    })
    return groups
  }, [filteredData])

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
           <h1 className="text-4xl font-black text-gray-900 tracking-tight">Estado de Cursos</h1>
           <div className="flex items-center gap-4 mt-2">
              <p className="text-gray-500 font-medium">Control de inscripciones y pagos.</p>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex bg-gray-100 p-1 rounded-xl">
                 <button onClick={() => setViewMode('detailed')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='detailed' ? 'bg-white shadow-sm text-fuchsia-600' : 'text-gray-400 hover:text-gray-600'}`}>Detallada</button>
                 <button onClick={() => setViewMode('compact')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='compact' ? 'bg-white shadow-sm text-fuchsia-600' : 'text-gray-400 hover:text-gray-600'}`}>Compacta</button>
                 <button onClick={() => setViewMode('summary')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='summary' ? 'bg-white shadow-sm text-fuchsia-600' : 'text-gray-400 hover:text-gray-600'}`}>Resumen</button>
              </div>
           </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[28px] border border-gray-100 shadow-lg shadow-gray-100/50">
           <div className="relative group">
              <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={courseQ} onChange={e=>setCourseQ(e.target.value)} placeholder="Curso..." className="pl-10 pr-4 py-2.5 bg-gray-50 border-transparent border-2 focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none w-40" />
           </div>
           <div className="relative group">
              <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={studentQ} onChange={e=>setStudentQ(e.target.value)} placeholder="Alumno..." className="pl-10 pr-4 py-2.5 bg-gray-50 border-transparent border-2 focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none w-40" />
           </div>
           <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="px-4 py-2.5 bg-gray-50 border-transparent border-2 focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none appearance-none">
              <option value="">Día...</option>
              {DAY_NAMES.map((d,i)=><option key={i} value={i}>{d}</option>)}
           </select>
           <button onClick={load} className="p-2.5 bg-fuchsia-50 text-fuchsia-600 rounded-xl hover:bg-fuchsia-100 transition-all">
              <HiOutlineRefresh size={20} className={loading?'animate-spin':''} />
           </button>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="py-40 text-center space-y-4">
           <div className="w-10 h-10 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin mx-auto" />
           <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest">Sincronizando...</span>
        </div>
      ) : (
        <div className="space-y-12">
           {Object.entries(groupedByDay).map(([dayName, courses]) => (
              <div key={dayName} className="space-y-6">
                 <div className="flex items-center gap-4 px-2">
                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">{dayName}</h2>
                    <div className="h-px flex-1 bg-gray-100" />
                 </div>

                 <div className={`grid gap-6 ${viewMode === 'summary' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                    {courses.map((row) => (
                       <div key={row.course.id} className={`bg-white border border-gray-100 shadow-sm transition-all duration-300 ${viewMode === 'summary' ? 'rounded-[32px] p-6' : 'rounded-[40px] overflow-hidden'}`}>
                          {/* Card Header / Summary Header */}
                          <div className={`flex items-start justify-between ${viewMode === 'summary' ? 'mb-6' : 'px-8 py-6 bg-gray-50/50 border-b border-gray-100'}`}>
                             <div className="flex items-center gap-4">
                                <div className={`flex items-center justify-center bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white font-black shadow-lg shadow-fuchsia-100 ${viewMode === 'summary' ? 'w-12 h-12 rounded-2xl text-lg' : 'w-14 h-14 rounded-[20px] text-xl'}`}>
                                   {row.course.name[0]}
                                </div>
                                <div>
                                   <h3 className={`font-black text-gray-900 leading-tight ${viewMode === 'summary' ? 'text-base' : 'text-xl'}`}>{row.course.name}</h3>
                                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{row.teacher?.name || 'Academia'}</p>
                                </div>
                             </div>
                             {viewMode === 'summary' ? (
                                <span className="px-3 py-1 bg-fuchsia-50 text-fuchsia-600 text-[10px] font-black rounded-lg">{row.students.length}</span>
                             ) : (
                                <button onClick={() => navigate(`/courses/${row.course.id}`)} className="p-3 bg-white border border-gray-100 rounded-xl hover:text-fuchsia-600 transition-all"><HiOutlineChevronRight size={20} /></button>
                             )}
                          </div>

                          {/* Detailed/Compact Table */}
                          {viewMode !== 'summary' && (
                             <div className="overflow-x-auto">
                                <table className="w-full">
                                   <thead>
                                      <tr className="text-left text-[9px] font-black text-gray-300 uppercase tracking-widest">
                                         <th className="pl-10 pr-6 py-4">Alumno</th>
                                         <th className="px-6 py-4 text-center">Asistencia</th>
                                         <th className="px-6 py-4 text-center">Estado</th>
                                         <th className="pr-10 pl-6 py-4 text-right">Contacto</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-50">
                                      {row.students.map((s) => {
                                         const isPaid = s.payment_status === 'activo'
                                         const progress = s.expected_count && s.expected_count > 0 ? Math.min(100, (s.attendance_count || 0) / s.expected_count * 100) : 0
                                         
                                         return (
                                            <tr key={s.id} className="hover:bg-fuchsia-50/10 transition-colors group">
                                               <td className="pl-10 pr-6 py-4">
                                                  <div className="flex items-center gap-3">
                                                     {viewMode === 'detailed' && (
                                                        <div className="w-10 h-10 rounded-xl bg-fuchsia-100 overflow-hidden flex items-center justify-center text-fuchsia-600 font-black shrink-0">
                                                           {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                                                        </div>
                                                     )}
                                                     <div className="min-w-0">
                                                        <div className="text-sm font-black text-gray-800 truncate group-hover:text-fuchsia-600 transition-colors">{s.first_name} {s.last_name}</div>
                                                        {s.birthday_today && <div className="text-[8px] font-black text-pink-500 uppercase flex items-center gap-1"><HiOutlineCake /> Cumple hoy</div>}
                                                     </div>
                                                  </div>
                                               </td>
                                               <td className="px-6 py-4">
                                                  <div className="w-24 mx-auto">
                                                     <div className="flex justify-between text-[8px] font-black text-gray-400 uppercase mb-1">
                                                        <span>{s.attendance_count}/{s.expected_count}</span>
                                                        <span>{Math.round(progress)}%</span>
                                                     </div>
                                                     <div className="h-1.5 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                                                        <div className={`h-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : 'bg-fuchsia-500'}`} style={{ width: `${progress}%` }} />
                                                     </div>
                                                  </div>
                                               </td>
                                               <td className="px-6 py-4 text-center">
                                                  {isPaid ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
                                                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                       OK
                                                    </div>
                                                  ) : (
                                                    <button 
                                                      onClick={() => {
                                                        if (s.enrollment_id) setRenewModalData({ studentId: s.id, courseId: row.course.id, enrollmentId: s.enrollment_id })
                                                        else navigate(`/students/${s.id}`)
                                                      }} 
                                                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors" 
                                                      title="Renovar o Pagar"
                                                    >
                                                       <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                                       Renovar
                                                    </button>
                                                  )}
                                               </td>
                                               <td className="pr-10 pl-6 py-4 text-right">
                                                  <div className="flex items-center justify-end gap-2">
                                                     {(() => {
                                                        const waMsgTemplate = tenantInfo?.whatsapp_message || "Hola {nombre}, te escribimos de {academia}. Tienes un pago pendiente para el curso {curso}."
                                                        const msg = waMsgTemplate
                                                          .replace('{nombre}', s.first_name)
                                                          .replace('{curso}', row.course.name)
                                                          .replace('{academia}', tenantInfo?.name || 'la academia')
                                                        const cleanPhone = s.phone?.replace(/\D/g, '') || ''
                                                        return (
                                                          <a href={cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : '#'} onClick={e => !cleanPhone && e.preventDefault()} target={cleanPhone ? "_blank" : undefined} className={`p-2 rounded-lg transition-all ${cleanPhone ? 'bg-gray-50 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50' : 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-50'}`} title={cleanPhone ? "Enviar WhatsApp" : "Sin número de teléfono"}><HiOutlinePhone size={14} /></a>
                                                        )
                                                     })()}
                                                     <button onClick={() => navigate(`/students/${s.id}`)} className="p-2 bg-gray-50 text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 rounded-lg transition-all"><HiOutlineChevronRight size={14} /></button>
                                                  </div>
                                               </td>
                                            </tr>
                                         )
                                      })}
                                   </tbody>
                                </table>
                             </div>
                          )}

                          {/* Summary View Content */}
                          {viewMode === 'summary' && (
                             <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-gray-50 p-4 rounded-2xl">
                                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Alumnos</div>
                                      <div className="text-xl font-black text-gray-900">{row.students.length}</div>
                                   </div>
                                   <div className="bg-gray-50 p-4 rounded-2xl">
                                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Asistencia Avg</div>
                                      <div className="text-xl font-black text-fuchsia-600">
                                         {Math.round(row.students.reduce((acc, s) => acc + (s.expected_count ? ((s.attendance_count||0)/s.expected_count*100) : 0), 0) / (row.students.length || 1))}%
                                      </div>
                                   </div>
                                </div>
                                <div className="space-y-1.5">
                                   <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">
                                      <span>Estado de Pagos</span>
                                      <span>{row.students.filter(s=>s.payment_status==='activo').length}/{row.students.length}</span>
                                   </div>
                                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(row.students.filter(s=>s.payment_status==='activo').length / (row.students.length || 1)) * 100}%` }} />
                                   </div>
                                </div>
                                <button onClick={() => navigate(`/courses/${row.course.id}`)} className="w-full py-3 bg-fuchsia-50 text-fuchsia-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-fuchsia-600 hover:text-white transition-all flex items-center justify-center gap-2">
                                   Ver Detalles <HiOutlineChevronRight size={14} />
                                </button>
                             </div>
                          )}
                       </div>
                    ))}
                 </div>
              </div>
           ))}
        </div>
      )}

      {/* Modal de Renovación */}
      {renewModalData && (
        <RenewModal
          isOpen={true}
          onClose={() => setRenewModalData(null)}
          onSuccess={() => {
            setRenewModalData(null)
            load() // Recargar los datos para reflejar el pago
          }}
          studentId={renewModalData.studentId}
          courseId={renewModalData.courseId}
          enrollmentId={renewModalData.enrollmentId}
        />
      )}
    </div>
  )
}
