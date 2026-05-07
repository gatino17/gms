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
  HiOutlineExclamationCircle,
  HiOutlinePlus
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
  
  // View state: 'detailed' | 'pending' | 'summary'
  const [viewMode, setViewMode] = useState<'detailed' | 'pending' | 'summary'>('detailed')
  
  // Filters
  const [courseQ, setCourseQ] = useState('')
  const [studentQ, setStudentQ] = useState('')
  const [selectedDay, setSelectedDay] = useState<string>('')
  
  // Enrollment Modal States
  const [enrollModalCourseId, setEnrollModalCourseId] = useState<number | null>(null)
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [enrollSearchQ, setEnrollSearchQ] = useState('')
  const [isEnrolling, setIsEnrolling] = useState(false)
  
  // Quick Create Student States
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [newStudent, setNewStudent] = useState({ first_name: '', last_name: '', email: '' })
  
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

  const loadAllStudents = async () => {
    try {
      const { data } = await api.get('/api/pms/students', { params: { limit: 1000 } })
      setAllStudents(data.items || [])
    } catch (e) {
      console.error('Error al cargar alumnos', e)
    }
  }

  const handleEnroll = async (studentId: number) => {
    if (!enrollModalCourseId) return
    setIsEnrolling(true)
    try {
      await api.post('/api/pms/enrollments/', {
        student_id: studentId,
        course_id: enrollModalCourseId,
        start_date: new Date().toISOString().split('T')[0]
      })
      setEnrollModalCourseId(null)
      setEnrollSearchQ('')
      load() // Refresh data
    } catch (e: any) {
      alert('Error al inscribir: ' + (e.response?.data?.detail || e.message))
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleQuickCreateAndEnroll = async () => {
    if (!enrollModalCourseId) return
    if (!newStudent.first_name || !newStudent.last_name) {
      alert('Nombre y Apellido son obligatorios')
      return
    }
    setIsEnrolling(true)
    try {
      // 1. Create Student
      const { data: student } = await api.post('/api/pms/students/', {
        ...newStudent,
        is_active: true
      })
      
      // 2. Enroll Student
      await api.post('/api/pms/enrollments/', {
        student_id: student.id,
        course_id: enrollModalCourseId,
        start_date: new Date().toISOString().split('T')[0]
      })
      
      setEnrollModalCourseId(null)
      setShowQuickCreate(false)
      setNewStudent({ first_name: '', last_name: '', email: '' })
      setEnrollSearchQ('')
      load()
    } catch (e: any) {
      alert('Error: ' + (e.response?.data?.detail || e.message))
    } finally {
      setIsEnrolling(false)
    }
  }

  const filteredData = useMemo(() => {
    return data.map(row => ({
      ...row,
      students: row.students.filter(s => {
        const matchesStudent = !studentQ || (s.first_name + ' ' + s.last_name).toLowerCase().includes(studentQ.toLowerCase())
        const matchesPending = viewMode !== 'pending' || s.payment_status !== 'activo'
        return matchesStudent && matchesPending
      })
    })).filter(row => row.students.length > 0 || (!studentQ && viewMode !== 'pending'))
  }, [data, studentQ, viewMode])

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
    <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8 pb-20 px-4 md:px-0">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pt-4">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Gestión Académica</span>
           <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">Estado de Cursos</h1>
           <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4">
              <p className="text-gray-500 font-medium text-sm md:text-lg">Control de inscripciones y pagos en tiempo real.</p>
              <div className="hidden sm:block h-4 w-px bg-gray-200" />
               <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                 <button onClick={() => setViewMode('detailed')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='detailed' ? 'bg-white shadow-sm text-fuchsia-600' : 'text-gray-400 hover:text-gray-600'}`}>Todos</button>
                 <button onClick={() => setViewMode('pending')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='pending' ? 'bg-white shadow-sm text-rose-600' : 'text-rose-400/60 hover:text-rose-600'}`}>Pendientes</button>
                 <button onClick={() => setViewMode('summary')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Resumen</button>
               </div>
           </div>
        </div>

        <div className="w-full xl:w-auto flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-[24px] border border-gray-100 shadow-xl shadow-gray-100/50">
           <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative group flex-1">
                 <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={16} />
                 <input value={courseQ} onChange={e=>setCourseQ(e.target.value)} placeholder="Curso..." className="w-full pl-10 pr-5 py-2.5 bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all" />
              </div>
              <div className="relative group flex-1">
                 <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={16} />
                 <input value={studentQ} onChange={e=>setStudentQ(e.target.value)} placeholder="Alumno..." className="w-full pl-10 pr-5 py-2.5 bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all" />
              </div>
           </div>
           <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-36">
                 <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="w-full pl-5 pr-10 py-2.5 bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none appearance-none transition-all">
                    <option value="">Cualquier día</option>
                    {DAY_NAMES.map((d,i)=><option key={i} value={i}>{d}</option>)}
                 </select>
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                 </div>
              </div>
              <button onClick={load} className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl hover:bg-fuchsia-600 hover:text-white transition-all shadow-sm shadow-fuchsia-100">
                 <HiOutlineRefresh size={20} className={loading?'animate-spin':''} />
              </button>
           </div>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="py-60 flex flex-col items-center gap-6">
           <div className="w-16 h-16 border-4 border-fuchsia-50 border-t-fuchsia-600 rounded-full animate-spin" />
           <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-[0.4em] animate-pulse">Sincronizando academia...</span>
        </div>
      ) : (
        <div className="space-y-12 md:space-y-16">
           {Object.entries(groupedByDay).map(([dayName, courses]) => (
              <div key={dayName} className="space-y-6 md:space-y-8">
                 <div className="flex items-center gap-4 px-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-100 to-fuchsia-100" />
                    <h2 className="text-[10px] font-black text-fuchsia-600 uppercase tracking-[0.4em] whitespace-nowrap bg-fuchsia-50 px-6 py-2 rounded-full border border-fuchsia-100 shadow-sm">{dayName}</h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-fuchsia-100 to-fuchsia-100" />
                 </div>

                 <div className={`grid gap-6 md:gap-8 ${viewMode === 'summary' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                    {courses.map((row) => (
                       <div key={row.course.id} className={`bg-white border border-gray-100 transition-all duration-500 hover:shadow-2xl hover:shadow-gray-200/50 ${viewMode === 'summary' ? 'rounded-[32px] p-6 md:p-8' : 'rounded-[32px] overflow-hidden'}`}>
                          {/* Card Header / Summary Header */}
                          <div className={`flex items-start justify-between ${viewMode === 'summary' ? 'mb-6' : 'px-6 md:px-8 py-5 md:py-6 bg-gray-50/50 border-b border-gray-100'}`}>
                             <div className="flex items-center gap-4">
                                <div className={`flex items-center justify-center bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white font-black shadow-xl shadow-fuchsia-100 transition-transform duration-500 group-hover:scale-110 ${viewMode === 'summary' ? 'w-12 h-12 rounded-[20px] text-lg' : 'w-14 h-14 rounded-[22px] text-xl'}`}>
                                   {row.course.name[0]}
                                </div>
                                <div className="min-w-0">
                                   <h3 className={`font-black text-gray-900 leading-tight truncate ${viewMode === 'summary' ? 'text-base' : 'text-xl'}`}>{row.course.name}</h3>
                                   <div className="flex items-center gap-2 mt-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">{row.teacher?.name || 'Por Asignar'}</p>
                                   </div>
                                </div>
                             </div>
                             <div className="flex items-center gap-2">
                                <button 
                                   onClick={() => { setEnrollModalCourseId(row.course.id); loadAllStudents(); }} 
                                   className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-200 transition-all active:scale-95"
                                >
                                   <HiOutlinePlus size={14} />
                                   Inscribir
                                </button>
                                {viewMode !== 'summary' && (
                                   <button onClick={() => navigate(`/courses/${row.course.id}`)} className="p-4 bg-white border border-gray-100 rounded-2xl hover:text-fuchsia-600 hover:shadow-lg transition-all group/btn">
                                      <HiOutlineChevronRight size={24} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                   </button>
                                )}
                             </div>
                          </div>

                          {/* Detailed/Compact Table */}
                          {viewMode !== 'summary' && (
                             <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full">
                                   <thead className="hidden md:table-header-group">
                                      <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30">
                                         <th className="pl-12 pr-6 py-5">Información Alumno</th>
                                         <th className="px-6 py-5 text-center">Progreso de Asistencia</th>
                                         <th className="px-6 py-5 text-center">Estatus Financiero</th>
                                         <th className="pr-12 pl-6 py-5 text-right">Gestión de Contacto</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-50 block md:table-row-group">
                                      {row.students.map((s) => {
                                         const isPaid = s.payment_status === 'activo'
                                         const progress = s.expected_count && s.expected_count > 0 ? Math.min(100, (s.attendance_count || 0) / s.expected_count * 100) : 0
                                         
                                         return (
                                            <tr key={s.id} className="block md:table-row hover:bg-gray-50/80 transition-all group">
                                               <td className="block md:table-cell pl-8 md:pl-12 pr-6 py-6">
                                                  <div className="flex items-center gap-4">
                                                     <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 overflow-hidden flex items-center justify-center text-fuchsia-600 font-black shrink-0 border border-fuchsia-100 shadow-sm">
                                                        {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                                                     </div>
                                                     <div className="min-w-0">
                                                        <div className="text-base font-black text-gray-900 truncate group-hover:text-fuchsia-600 transition-colors flex items-center gap-2">
                                                           {s.first_name} {s.last_name}
                                                           {s.birthday_today && <HiOutlineCake className="text-pink-500 shrink-0" size={16} />}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Socio #{s.id}</div>
                                                     </div>
                                                  </div>
                                               </td>
                                               <td className="block md:table-cell px-8 md:px-6 py-4 md:py-6">
                                                  <div className="w-full md:w-32 mx-auto">
                                                     <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase mb-2">
                                                        <span className="md:hidden">Asistencia: </span>
                                                        <span className="text-gray-900">{s.attendance_count}/{s.expected_count}</span>
                                                        <span className={progress >= 80 ? 'text-emerald-600' : 'text-fuchsia-600'}>{Math.round(progress)}%</span>
                                                     </div>
                                                     <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                                        <div className={`h-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-fuchsia-500' : 'bg-rose-400'}`} style={{ width: `${progress}%` }} />
                                                     </div>
                                                  </div>
                                               </td>
                                               <td className="block md:table-cell px-8 md:px-6 py-4 md:py-6 text-left md:text-center">
                                                  <span className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Estado de Pago</span>
                                                  {isPaid ? (
                                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                       <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                                                       PAGADO
                                                    </div>
                                                  ) : (
                                                    <button 
                                                      onClick={() => {
                                                        if (s.enrollment_id) setRenewModalData({ studentId: s.id, courseId: row.course.id, enrollmentId: s.enrollment_id })
                                                        else navigate(`/students/${s.id}`)
                                                      }} 
                                                      className="inline-flex items-center gap-2 px-6 py-3 md:px-4 md:py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-600 hover:text-white transition-all w-full md:w-auto justify-center shadow-sm shadow-rose-50 active:scale-95" 
                                                    >
                                                       <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                       PENDIENTE
                                                    </button>
                                                  )}
                                               </td>
                                               <td className="block md:table-cell pr-8 md:pr-12 pl-8 py-4 md:py-6 text-right">
                                                  <div className="flex items-center justify-start md:justify-end gap-3">
                                                     {(() => {
                                                        const customPart = tenantInfo?.whatsapp_message || `Te saludamos de ${tenantInfo?.name || 'la academia'}.`
                                                        const msg = `Hola ${s.first_name}, ${customPart} Esperamos que estés disfrutando mucho tus clases. Te recordamos que tienes un pago pendiente para el curso ${row.course.name}. Nos vemos pronto.`
                                                        const cleanPhone = s.phone?.replace(/\D/g, '') || ''
                                                        return (
                                                          <a href={cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : '#'} onClick={e => !cleanPhone && e.preventDefault()} target={cleanPhone ? "_blank" : undefined} className={`flex items-center justify-center gap-3 px-5 py-3 md:p-3 rounded-2xl transition-all flex-1 md:flex-none border ${cleanPhone ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:shadow-lg hover:shadow-emerald-100' : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-50'}`} title={cleanPhone ? "Enviar WhatsApp" : "Sin número de teléfono"}>
                                                            <HiOutlinePhone size={18} />
                                                            <span className="md:hidden text-[11px] font-black uppercase tracking-widest">WhatsApp</span>
                                                          </a>
                                                        )
                                                     })()}
                                                     <button onClick={() => navigate(`/students/${s.id}`)} className="flex items-center justify-center gap-3 px-5 py-3 md:p-3 bg-gray-50 text-gray-400 border border-gray-100 hover:text-fuchsia-600 hover:bg-white hover:border-fuchsia-100 hover:shadow-lg hover:shadow-fuchsia-100 rounded-2xl transition-all flex-1 md:flex-none">
                                                       <span className="md:hidden text-[11px] font-black uppercase tracking-widest">Perfil</span>
                                                       <HiOutlineChevronRight size={18} />
                                                     </button>
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
                             <div className="space-y-8">
                                <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-gray-50/50 p-5 rounded-[24px] border border-gray-100">
                                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Cupos</div>
                                      <div className="text-2xl font-black text-gray-900">{row.students.length}</div>
                                   </div>
                                   <div className="bg-gray-50/50 p-5 rounded-[24px] border border-gray-100">
                                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Asistencia</div>
                                      <div className="text-2xl font-black text-fuchsia-600">
                                         {Math.round(row.students.reduce((acc, s) => acc + (s.expected_count ? ((s.attendance_count||0)/s.expected_count*100) : 0), 0) / (row.students.length || 1))}%
                                      </div>
                                   </div>
                                </div>
                                <div className="space-y-3 px-1">
                                   <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                      <span>Salud Financiera</span>
                                      <span className="text-emerald-600">{row.students.filter(s=>s.payment_status==='activo').length} / {row.students.length}</span>
                                   </div>
                                   <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner p-0.5">
                                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${(row.students.filter(s=>s.payment_status==='activo').length / (row.students.length || 1)) * 100}%` }} />
                                   </div>
                                </div>
                                <button onClick={() => navigate(`/courses/${row.course.id}`)} className="w-full py-4 bg-gray-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-fuchsia-600 hover:shadow-xl hover:shadow-fuchsia-100 transition-all flex items-center justify-center gap-3 group/nav">
                                   Explorar Detalles <HiOutlineChevronRight size={16} className="group-hover/nav:translate-x-1 transition-transform" />
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

      {/* Enrollment Modal */}
      {enrollModalCourseId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEnrollModalCourseId(null)} />
           <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] border border-gray-100">
              <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                 <h2 className="text-xl font-black text-gray-900">Inscribir Alumno</h2>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Busca y selecciona un alumno</p>
                 
                 <div className="mt-6 relative">
                    <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                       type="text" 
                       placeholder="Nombre, apellido o correo..." 
                       value={enrollSearchQ}
                       onChange={(e) => setEnrollSearchQ(e.target.value)}
                       autoFocus
                       className="w-full pl-12 pr-6 py-4 bg-white rounded-[24px] border-2 border-transparent focus:border-fuchsia-100 shadow-sm font-bold text-gray-700 transition-all outline-none"
                    />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                 {showQuickCreate ? (
                    <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                             <input 
                                type="text" 
                                value={newStudent.first_name}
                                onChange={(e) => setNewStudent({...newStudent, first_name: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                placeholder="Ej: Juan"
                             />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellido</label>
                             <input 
                                type="text" 
                                value={newStudent.last_name}
                                onChange={(e) => setNewStudent({...newStudent, last_name: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                placeholder="Ej: Pérez"
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Correo Electrónico (Opcional)</label>
                          <input 
                             type="email" 
                             value={newStudent.email}
                             onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                             className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                             placeholder="ejemplo@correo.com"
                          />
                       </div>
                       <button 
                          onClick={handleQuickCreateAndEnroll}
                          disabled={isEnrolling}
                          className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-fuchsia-200 hover:shadow-fuchsia-300 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                       >
                          {isEnrolling ? 'Procesando...' : 'Crear e Inscribir Ahora'}
                       </button>
                       <button 
                          onClick={() => setShowQuickCreate(false)}
                          className="w-full py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                       >
                          Volver a la búsqueda
                       </button>
                    </div>
                 ) : (
                    <div className="space-y-2">
                       {allStudents
                          .filter(s => {
                             const q = enrollSearchQ.toLowerCase()
                             return !q || (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
                          })
                          .slice(0, 50)
                          .map(s => (
                             <button 
                                key={s.id}
                                disabled={isEnrolling}
                                onClick={() => handleEnroll(s.id)}
                                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-fuchsia-50 group transition-all text-left border border-transparent hover:border-fuchsia-100"
                             >
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xs overflow-hidden shrink-0 border border-gray-50">
                                      {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                                   </div>
                                   <div>
                                      <div className="text-sm font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors">{s.first_name} {s.last_name}</div>
                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.email || 'Sin correo'}</div>
                                   </div>
                                </div>
                                <div className="p-2 rounded-lg bg-gray-50 text-gray-400 group-hover:bg-fuchsia-600 group-hover:text-white transition-all">
                                   <HiOutlinePlus size={16} />
                                </div>
                             </button>
                          ))
                       }
                       
                       <div className="pt-4 border-t border-gray-50">
                          <button 
                             onClick={() => setShowQuickCreate(true)}
                             className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gray-50 text-gray-600 hover:bg-gray-100 border border-dashed border-gray-200 transition-all group"
                          >
                             <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-gray-400 group-hover:text-fuchsia-600 transition-colors shadow-sm">
                                <HiOutlinePlus size={16} />
                             </div>
                             <span className="text-xs font-black uppercase tracking-widest">¿Alumno nuevo? Crear aquí</span>
                          </button>
                       </div>
                    </div>
                 )}
              </div>

              <div className="p-6 bg-gray-50/50 border-t border-gray-100 text-center">
                 <button onClick={() => setEnrollModalCourseId(null)} className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-gray-600 transition-colors">Cerrar</button>
              </div>
           </div>
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
