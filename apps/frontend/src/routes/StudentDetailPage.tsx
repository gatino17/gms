import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import RenewModal from '../components/RenewModal'
import EditEnrollmentModal from '../components/EditEnrollmentModal'
import { 
  HiOutlineChevronLeft, 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineCalendar, 
  HiOutlineUser, 
  HiOutlinePencil,
  HiOutlineCurrencyDollar,
  HiOutlineLightningBolt,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineChevronRight,
  HiOutlineBadgeCheck,
  HiOutlineShieldCheck,
  HiOutlineExternalLink
} from 'react-icons/hi'

type PortalData = {
  student: { 
    id:number; first_name:string; last_name:string; email?:string|null; 
    joined_at?:string|null; photo_url?:string|null; is_active?:boolean; 
    tenant_id?:number; phone?:string|null; gender?:string|null; 
    birthdate?:string|null; notes?:string|null; 
    emergency_contact?:string|null; emergency_phone?:string|null 
  }
  enrollments: {
    id:number; is_active:boolean; payment_status?: string | null;
    start_date?:string|null; end_date?:string|null;
    course:{ 
      id:number; name:string; 
      day_of_week?:number|null; start_time?:string|null; end_time?:string|null; 
      day_of_week_2?:number|null; start_time_2?:string|null; end_time_2?:string|null;
      day_of_week_3?:number|null; start_time_3?:string|null; end_time_3?:string|null;
      day_of_week_4?:number|null; start_time_4?:string|null; end_time_4?:string|null;
      day_of_week_5?:number|null; start_time_5?:string|null; end_time_5?:string|null;
      teacher_name?:string|null; image_url?:string|null 
    }
  }[]
  classes_active: number
  payments: {
    total_last_90:number
    recent?: {
      id:number; amount:number; payment_date?:string|null; 
      method:string; type:string; reference?:string|null; 
      enrollment_id?:number; course_id?:number;
      course_name?: string | null;
      teacher_name?: string | null;
      period_start?: string | null;
      period_end?: string | null;
      course?: { name?: string; teacher_name?: string; image_url?: string }
    }[]
  }
}

type TenantFeeSettings = {
  enrollment_fee_enabled?: boolean
  enrollment_fee_amount?: number | null
  enrollment_fee_kind?: 'incorporation' | 'annual' | string | null
}

type CalDay = { date:string; expected:boolean; attended:boolean; is_recovery?: boolean; is_extra?: boolean; expected_course_ids?: number[]; attended_course_ids?: number[] }

const CL_TZ = 'America/Santiago'
const DAY_NAMES_MON_FIRST = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'] as const
const fmtCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)

function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(d)
    .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function ymdToCL(ymd?: string | null): string { 
  if (!ymd) return ''; 
  const [y,m,d] = ymd.split('-').map(Number); 
  const dt = new Date(y, (m||1)-1, d||1); 
  return dt.toLocaleDateString('es-CL', { day:'2-digit', month:'short' }) 
}

export default function StudentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { tenantId } = useTenant()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [calendar, setCalendar] = useState<CalDay[]>([])
  const [courseStats, setCourseStats] = useState<Record<number, { attended:number; expected:number; extraOutside:number }>>({})
  
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1)
  const [calLoading, setCalLoading] = useState(false)
  const [deleteAttendanceModal, setDeleteAttendanceModal] = useState<{ date: string; courseIds: number[] } | null>(null)
  const [deletingAttendance, setDeletingAttendance] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [feeSettings, setFeeSettings] = useState<TenantFeeSettings | null>(null)
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [feePayMethod, setFeePayMethod] = useState('efectivo')
  const [feeReference, setFeeReference] = useState('')
  const [savingFee, setSavingFee] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editMode, setEditMode] = useState<'edit' | 'renew' | 'profile'>('edit')
  const [renewModalData, setRenewModalData] = useState<{ studentId: number; courseId: number; enrollmentId: number } | null>(null)
  const [editEnrollmentData, setEditEnrollmentData] = useState<any>(null)

  const todayYMD = useMemo(() => toYMDInTZ(new Date(), CL_TZ), [])

  const loadData = async (showLoader = true) => {
    if(!id) return
    if (showLoader) setLoading(true)
    try {
      const [pRes, sRes] = await Promise.all([
        api.get(`/api/pms/students/${id}/portal`),
        api.get(`/api/pms/students/${id}/full_stats`)
      ])
      setData(pRes.data)
      setCourseStats(sRes.data || {})
      try {
        const tRes = await api.get('/api/pms/tenants/me')
        setFeeSettings((tRes.data || {}) as TenantFeeSettings)
      } catch {
        setFeeSettings(null)
      }
    } finally { if (showLoader) setLoading(false) }
  }

  const loadCalendar = async () => {
    if(!id) return
    setCalLoading(true)
    try {
      const res = await api.get(`/api/pms/students/${id}/attendance_calendar`, { params: { year: calYear, month: calMonth } })
      setCalendar(res.data?.days || [])
    } finally { setCalLoading(false) }
  }

  useEffect(() => { loadData() }, [id, tenantId])
  useEffect(() => { loadCalendar() }, [id, calYear, calMonth, tenantId])

  useEffect(() => {
    if (!id || !tenantId) return
    const silentRefresh = () => {
      loadCalendar()
      loadData(false)
    }
    const intervalId = setInterval(silentRefresh, 10000)
    const onFocus = () => silentRefresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') silentRefresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [id, tenantId, calYear, calMonth])

  const handleDayClick = async (day: CalDay) => {
    if (!day.attended || !day.attended_course_ids || day.attended_course_ids.length === 0) return
    setDeleteAttendanceModal({ date: day.date, courseIds: day.attended_course_ids })
  }

  const getCourseNameById = (courseId: number) => {
    const enrollment = data?.enrollments.find((e) => e.course.id === courseId)
    return enrollment?.course?.name || `Curso #${courseId}`
  }

  const deleteAttendanceForCourses = async (courseIds: number[], attendedDate: string) => {
    if (!id || courseIds.length === 0) return
    setDeletingAttendance(true)
    try {
      for (const courseId of courseIds) {
        await api.delete('/api/pms/attendance', {
          params: {
            student_id: id,
            course_id: courseId,
            attended_date: attendedDate
          }
        })
      }
      await loadCalendar()
      await loadData(false)
      setDeleteAttendanceModal(null)
    } catch (e: any) {
      alert('Error al eliminar: ' + (e.response?.data?.detail || e.message))
    } finally {
      setDeletingAttendance(false)
    }
  }

  const openStudentPdfReport = async () => {
    if (!id) return
    setLoadingReport(true)
    try {
      const res = await api.get(`/api/pms/reports/student/${id}`, { responseType: 'blob' })
      const fileUrl = URL.createObjectURL(res.data)
      window.open(fileUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000)
    } catch (e: any) {
      alert('No se pudo generar el reporte PDF: ' + (e?.message || 'Error'))
    } finally {
      setLoadingReport(false)
    }
  }

  const handlePayEnrollmentFee = async () => {
    if (!id) return
    const amount = Number(feeSettings?.enrollment_fee_amount || 0)
    if (amount <= 0) {
      alert('No hay monto de matrícula configurado en Settings.')
      return
    }
    setSavingFee(true)
    try {
      await api.post('/api/pms/payments', {
        student_id: Number(id),
        course_id: null,
        amount,
        payment_date: toYMDInTZ(new Date()),
        method: feePayMethod,
        type: 'registration',
        reference: feeReference || `Matrícula ${feeSettings?.enrollment_fee_kind === 'annual' ? 'anual' : 'incorporación'}`,
        notes: 'Cobro de matrícula manual desde perfil de alumno',
      })
      setShowFeeModal(false)
      await loadData(false)
    } catch (e: any) {
      alert('No se pudo registrar la matrícula: ' + (e?.response?.data?.detail || e?.message || 'Error'))
    } finally {
      setSavingFee(false)
    }
  }

  const handleDeleteEnrollment = async (enrollmentId: number, courseName: string) => {
    const ok = window.confirm(`Â¿Eliminar el curso "${courseName}" de este alumno?`)
    if (!ok) return
    try {
      await api.delete(`/api/pms/enrollments/${enrollmentId}`)
      await loadData(false)
      await loadCalendar()
    } catch (e: any) {
      alert('Error al eliminar curso: ' + (e.response?.data?.detail || e.message))
    }
  }

  if (loading && !data) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <div className="w-16 h-16 relative">
         <div className="absolute inset-0 border-4 border-fuchsia-100 rounded-2xl" />
         <div className="absolute inset-0 border-4 border-fuchsia-600 rounded-2xl animate-spin border-t-transparent" />
      </div>
      <span className="text-fuchsia-600 font-black tracking-widest text-[10px] uppercase animate-pulse">Sincronizando Experiencia Pro...</span>
    </div>
  )

  if (!data) return null

  const { student, enrollments, payments } = data
  const enrollmentPayments = (payments.recent || []).filter((p) => {
    const t = String(p.type || '').toLowerCase()
    const ref = String(p.reference || '').toLowerCase()
    return t === 'registration' || ref.includes('matricula')
  })
  const latestEnrollmentPayment = enrollmentPayments
    .slice()
    .sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || '')))[0]
  const hasEnrollmentFee = !!latestEnrollmentPayment
  const canPayEnrollmentFee =
    !hasEnrollmentFee &&
    !!feeSettings?.enrollment_fee_enabled &&
    Number(feeSettings?.enrollment_fee_amount || 0) > 0
  const enrollmentKind = latestEnrollmentPayment
    ? (String(latestEnrollmentPayment.reference || '').toLowerCase().includes('anual')
      ? 'Anual'
      : String(latestEnrollmentPayment.reference || '').toLowerCase().includes('incorporacion')
        ? 'Incorporacion'
        : 'Matricula')
    : null
  const getRegistrationKindLabel = (reference?: string | null) => {
    const ref = String(reference || '').toLowerCase()
    if (ref.includes('anual')) return 'Matrícula anual'
    if (ref.includes('incorporacion') || ref.includes('incorporación')) return 'Matrícula incorporación'
    return 'Matrícula'
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button onClick={() => navigate('/students')} className="w-full sm:w-auto group flex items-center justify-center sm:justify-start gap-2 text-gray-400 hover:text-fuchsia-600 transition-all duration-300">
           <div className="p-3 rounded-2xl bg-white shadow-sm group-hover:bg-fuchsia-50 group-hover:scale-110 transition-all"><HiOutlineChevronLeft size={20} /></div>
           <span className="font-black uppercase tracking-widest text-[10px] group-hover:translate-x-1 transition-transform">Volver</span>
        </button>
        <div className="flex w-full sm:w-auto gap-3">
           <button
             onClick={openStudentPdfReport}
             disabled={loadingReport}
             className="flex-1 sm:flex-none px-6 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm font-black text-gray-600 text-[10px] uppercase tracking-widest hover:bg-gray-50 hover:text-fuchsia-600 transition-all flex items-center justify-center gap-2"
           >
              <HiOutlineExternalLink size={16} /> {loadingReport ? 'Generando...' : 'Reporte PDF'}
           </button>
           <button onClick={() => { setEditMode('profile'); setShowEdit(true) }} className="flex-[2] sm:flex-none px-6 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm font-black text-gray-600 text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
              <HiOutlinePencil size={16} /> Perfil
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column (4/12) */}
        <div className="lg:col-span-4 space-y-8">
           {/* Profile Card */}
           <div className="bg-white rounded-[40px] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden relative">
              <div className="h-32 bg-gradient-to-br from-fuchsia-600 to-purple-600" />
              <div className="px-8 pb-10 -mt-16 text-center">
                 <div className="relative inline-block">
                    <div className="w-32 h-32 rounded-[40px] bg-white p-1 shadow-2xl relative z-10">
                       <div className="w-full h-full rounded-[36px] bg-gradient-to-br from-fuchsia-100 to-purple-100 flex items-center justify-center text-fuchsia-600 text-4xl font-black overflow-hidden">
                          {student.photo_url ? <img src={toAbsoluteUrl(student.photo_url)} className="w-full h-full object-cover" /> : `${student.first_name[0]}${student.last_name[0]}`}
                       </div>
                    </div>
                    <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl border-4 border-white flex items-center justify-center z-20 ${student.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                       {student.is_active ? <HiOutlineBadgeCheck className="text-white" size={20} /> : <HiOutlineShieldCheck className="text-white" size={20} />}
                    </div>
                 </div>

                 <div className="mt-6">
                    <h1 className="text-3xl font-black text-gray-900 leading-tight">{student.first_name} {student.last_name}</h1>
                    <div className="flex items-center justify-center gap-2 mt-2">
                       <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-full">Alumno Pro</span>
                       <span className="text-gray-300">|</span>
                       <span className="text-gray-400 font-bold text-xs">#{student.id}</span>
                    </div>
                 </div>

                 <div className="mt-10 space-y-3 text-left">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100/50 hover:bg-white hover:shadow-lg transition-all group cursor-pointer">
                       <div className="p-3 bg-white rounded-2xl text-fuchsia-600 group-hover:scale-110 transition-all"><HiOutlineMail size={20} /></div>
                       <div className="min-w-0">
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Canal de Contacto</div>
                          <div className="text-sm font-bold text-gray-700 truncate">{student.email || 'Sin Email'}</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100/50 hover:bg-white hover:shadow-lg transition-all group cursor-pointer">
                       <div className="p-3 bg-white rounded-2xl text-fuchsia-600 group-hover:scale-110 transition-all"><HiOutlinePhone size={20} /></div>
                       <div className="min-w-0">
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Teléfono Directo</div>
                          <div className="text-sm font-bold text-gray-700">{student.phone || 'Sin Teléfono'}</div>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100/50">
                       <div className="p-3 bg-white rounded-2xl text-fuchsia-600"><HiOutlineCalendar size={20} /></div>
                       <div>
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Matricula</div>
                          <div className={`text-sm font-black ${hasEnrollmentFee ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {hasEnrollmentFee ? 'Con matricula' : 'Sin matricula'}
                          </div>
                          <div className="text-[10px] font-bold text-gray-500 mt-0.5">
                            {hasEnrollmentFee
                              ? `${enrollmentKind} | Ultimo cobro: ${ymdToCL(latestEnrollmentPayment?.payment_date)}`
                              : 'No registra cobro de matricula'}
                          </div>
                          {canPayEnrollmentFee && (
                            <button
                              onClick={() => {
                                setFeeReference(`Matrícula ${feeSettings?.enrollment_fee_kind === 'annual' ? 'anual' : 'incorporación'}`)
                                setShowFeeModal(true)
                              }}
                              className="mt-2 inline-flex items-center px-3 py-1.5 rounded-xl bg-fuchsia-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-700 transition-colors"
                            >
                              Pagar matrícula
                            </button>
                          )}
                        </div>
                    </div>
                    {student.joined_at && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100/50">
                        <div className="p-3 bg-white rounded-2xl text-fuchsia-600"><HiOutlineCalendar size={20} /></div>
                        <div>
                          <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Miembro desde</div>
                          <div className="text-sm font-bold text-gray-700">{ymdToCL(student.joined_at)}</div>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>

           {/* Quick Stats Grid */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-100/50 group hover:bg-fuchsia-600 transition-all duration-500">
                 <div className="p-3 w-12 h-12 bg-fuchsia-50 text-fuchsia-600 rounded-2xl mb-4 group-hover:bg-white/20 group-hover:text-white transition-colors"><HiOutlineLightningBolt size={24} /></div>
                 <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white/60 transition-colors">Programas</div>
                 <div className="text-3xl font-black text-gray-900 group-hover:text-white transition-colors">{data.classes_active}</div>
              </div>
              <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xl shadow-gray-100/50 group hover:bg-emerald-600 transition-all duration-500">
                 <div className="p-3 w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl mb-4 group-hover:bg-white/20 group-hover:text-white transition-colors"><HiOutlineCurrencyDollar size={24} /></div>
                 <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white/60 transition-colors">Inversión 90d</div>
                 <div className="text-2xl font-black text-gray-900 group-hover:text-white transition-colors">{fmtCLP(payments.total_last_90)}</div>
              </div>
           </div>
        </div>

        {/* Right Column (8/12) */}
        <div className="lg:col-span-8 space-y-10">
           {/* Active Enrollments */}
           <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h2 className="text-2xl font-black text-gray-900 tracking-tight">Programas Activos</h2>
                 <span className="px-4 py-2 bg-fuchsia-50 text-fuchsia-600 text-[10px] font-black uppercase tracking-widest rounded-2xl">Gestión de Periodos</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                 {enrollments.map((e) => {
                    const stats = courseStats[e.id] || { attended:0, expected:0 }
                    const isPaid = e.payment_status === 'activo'
                    const progress = stats.expected > 0 ? Math.min(100, (stats.attended / stats.expected) * 100) : 0

                    return (
                       <div key={e.id} className="bg-white rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-lg shadow-gray-100/30 p-6 md:p-8 space-y-6 md:space-y-8 group hover:-translate-y-2 transition-all duration-500">
                          <div className="flex items-start justify-between">
                             <div className="space-y-1">
                                <h3 className="font-black text-gray-900 text-lg md:text-xl leading-tight group-hover:text-fuchsia-600 transition-colors">{e.course.name}</h3>
                                <div className="flex items-center gap-2">
                                   <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
                                   <p className="text-[9px] md:text-[10px] text-gray-400 font-black uppercase tracking-widest">{e.course.teacher_name || 'Sin Instructor'}</p>
                                </div>
                             </div>
                             <div className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm ${isPaid ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-rose-500 text-white shadow-rose-100'}`}>
                                {isPaid ? 'Al día' : 'Pendiente'}
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 md:gap-6 p-4 md:p-5 bg-gray-50 rounded-2xl md:rounded-3xl border border-gray-100">
                              <div>
                                 <div className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><HiOutlineClock /> Horario</div>
                                 <div className="flex flex-col gap-0.5">
                                   {[
                                     { d: e.course.day_of_week, t: e.course.start_time },
                                     { d: e.course.day_of_week_2, t: e.course.start_time_2 },
                                     { d: e.course.day_of_week_3, t: e.course.start_time_3 },
                                     { d: e.course.day_of_week_4, t: e.course.start_time_4 },
                                     { d: e.course.day_of_week_5, t: e.course.start_time_5 },
                                   ].filter(s => s.d !== null && s.d !== undefined).map((s, idx) => (
                                     <div key={idx} className="text-[11px] md:text-sm font-black text-gray-700">
                                       {DAY_NAMES_MON_FIRST[s.d! % 7]} | {(s.t || '').slice(0, 5)}
                                     </div>
                                   ))}
                                 </div>
                              </div>
                             <div>
                                <div className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><HiOutlineCalendar /> Próxima Renovación</div>
                                <div className="text-[12px] md:text-sm font-black text-gray-700">{ymdToCL(e.end_date)}</div>
                             </div>
                          </div>

                          <div className="space-y-3">
                             <div className="flex justify-between items-end">
                                <div className="flex items-center gap-2">
                                   <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Asistencia</span>
                                   {progress >= 100 && <span className="hidden sm:inline px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-lg">Logrado</span>}
                                </div>
                                <span className="text-base md:text-lg font-black text-gray-900">{stats.attended}<span className="text-gray-300 text-xs mx-1">/</span>{stats.expected}</span>
                             </div>
                             <div className="h-3 md:h-4 bg-gray-100 rounded-full overflow-hidden p-0.5 md:p-1">
                                <div className={`h-full transition-all duration-1000 rounded-full ${progress >= 100 ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-gradient-to-r from-fuchsia-500 to-purple-600'}`} style={{ width: `${progress}%` }} />
                             </div>
                             {!!stats.extraOutside && stats.extraOutside > 0 && (
                                <div className="mt-2 flex justify-start">
                                   <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase tracking-widest rounded-md cursor-help transition-colors hover:bg-amber-100" title="Clases sueltas o asistencias registradas fuera del plan">
                                      +{stats.extraOutside} Clase{stats.extraOutside > 1 ? 's' : ''} Suelta{stats.extraOutside > 1 ? 's' : ''}
                                   </span>
                                </div>
                             )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                             <button onClick={() => setRenewModalData({ studentId: student.id, courseId: e.course.id, enrollmentId: e.id })} className="flex-1 py-3.5 bg-gray-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl md:rounded-2xl hover:bg-fuchsia-600 hover:scale-[1.02] transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-2">
                                <HiOutlineRefresh size={18} /> Renovar Plan
                             </button>
                             <button onClick={() => setEditEnrollmentData(e)} className="p-3.5 bg-gray-50 text-gray-400 rounded-xl md:rounded-2xl hover:text-fuchsia-600 hover:bg-white hover:shadow-lg transition-all flex items-center justify-center">
                                <HiOutlinePencil size={20} />
                             </button>
                             <button
                                onClick={() => handleDeleteEnrollment(e.id, e.course.name)}
                                className="p-3.5 bg-rose-50 text-rose-400 rounded-xl md:rounded-2xl hover:text-rose-600 hover:bg-rose-100 transition-all flex items-center justify-center"
                                title="Eliminar curso"
                             >
                                <HiOutlineTrash size={20} />
                             </button>
                          </div>
                       </div>
                    )
                 })}
              </div>
           </div>

           {/* High-Performance Calendar Heatmap */}
           <div className="bg-white rounded-[32px] md:rounded-[50px] shadow-xl shadow-gray-100/50 border border-gray-100 p-6 md:p-10 space-y-6 md:space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div>
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Frecuencia de Asistencia</h2>
                    <p className="text-gray-400 font-medium text-xs md:text-sm mt-1">Monitoreo de actividad mensual.</p>
                 </div>
                 <div className="flex items-center justify-between md:justify-start gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                    <button onClick={() => { const m = calMonth-1; if(m<1){ setCalMonth(12); setCalYear(y=>y-1) } else setCalMonth(m) }} className="p-2 md:p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-fuchsia-600"><HiOutlineChevronLeft size={20} /></button>
                    <span className="text-[10px] md:text-sm font-black text-gray-700 w-32 md:w-36 text-center uppercase tracking-widest">{new Date(calYear, calMonth-1).toLocaleDateString('es-CL', { month:'long', year: 'numeric' })}</span>
                    <button onClick={() => { const m = calMonth+1; if(m>12){ setCalMonth(1); setCalYear(y=>y+1) } else setCalMonth(m) }} className="p-2 md:p-3 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-fuchsia-600"><HiOutlineChevronRight size={20} /></button>
                 </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 md:gap-3">
                 {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=><div key={d} className="text-[8px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest text-center mb-2">{d}</div>)}
                 {(() => {
                    const first = new Date(calYear, calMonth-1, 1)
                    const offset = (first.getDay() + 6) % 7
                    const res = []
                    for(let i=0; i<offset; i++) res.push(<div key={`empty-${i}`} />)
                    calendar.forEach((d, i) => {
                       const isToday = d.date === todayYMD
                       const dayNum = new Date(d.date + "T00:00:00").getDate()
                       res.push(
                          <div 
                             key={i} 
                             onClick={() => handleDayClick(d)}
                             className={`aspect-square rounded-lg md:rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 hover:scale-110 cursor-pointer relative group ${
                                d.attended ? (d.is_extra ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-100' : d.is_recovery ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-100' : 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-100') : 
                                d.expected ? 'bg-rose-50 border-rose-100 text-rose-400 hover:bg-rose-100' : 
                                'bg-white border-gray-50 text-gray-300 hover:border-fuchsia-100'
                             } ${isToday ? 'ring-2 md:ring-4 ring-fuchsia-100 border-fuchsia-500 !text-fuchsia-600' : ''}`}
                          >
                             <span className="text-[10px] md:text-sm font-black">{dayNum}</span>
                             {d.attended && <div className="absolute top-1 md:top-1.5 right-1 md:right-1.5 w-1 md:h-1.5 md:w-1.5 h-1 bg-white rounded-full animate-pulse" />}
                          </div>
                       )
                    })
                    return res
                 })()}
              </div>
              
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-gray-50">
                 <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-emerald-500 shadow-md" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Asistido</span></div>
                 <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-amber-500 shadow-md" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Extra / Suelta</span></div>
                  <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-blue-500 shadow-md" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recuperación</span></div>
                 <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-rose-50 border border-rose-100" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ausencia</span></div>
                 <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-lg bg-white border border-gray-50" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sin Sesión</span></div>
              </div>
           </div>

           {/* Payment History */}
           <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <h2 className="text-2xl font-black text-gray-900 tracking-tight">Movimientos Financieros</h2>
                 <button className="text-xs font-black text-fuchsia-600 uppercase tracking-widest hover:underline">Ver Todo el Historial</button>
              </div>
              <div className="bg-white rounded-[32px] md:rounded-[50px] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] md:min-w-0">
                       <thead>
                          <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                             <th className="px-6 md:px-10 py-4 md:py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Concepto</th>
                             <th className="px-4 py-4 md:py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Periodo</th>
                             <th className="px-4 py-4 md:py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pago</th>
                             <th className="px-4 py-4 md:py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Medio</th>
                             <th className="px-6 md:px-10 py-4 md:py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                          {(payments.recent || []).map((p) => (
                             <tr key={p.id} className="hover:bg-fuchsia-50/10 transition-colors group">
                                <td className="px-6 md:px-10 py-5 md:py-7">
                                   <div className="font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors text-sm">{p.type === 'registration' ? 'Matrícula' : (p.course_name || 'Inscripción General')}</div>
                                   <div className="flex items-center gap-2 mt-1">
                                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-lg ${p.type === 'monthly' ? 'bg-fuchsia-50 text-fuchsia-600' : p.type === 'single_class' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>{p.type === 'monthly' ? 'Mensualidad' : p.type === 'single_class' ? 'Clase Suelta' : p.type === 'registration' ? getRegistrationKindLabel(p.reference) : 'Pago'}</span>
                                       {p.teacher_name && p.type !== 'registration' && (
                                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter shrink-0">
                                             | Prof: {p.teacher_name}
                                          </span>
                                       )}
                                   </div>
                                </td>
                                 <td className="px-4 py-5 md:py-7 text-center">
                                    {p.type === 'single_class' ? (
                                       <div className="flex flex-col items-center">
                                          <span className="text-[10px] font-black text-gray-900 leading-none">{ymdToCL(p.payment_date)}</span>
                                          <span className="text-[8px] font-black text-amber-500 uppercase mt-1">Día Extra</span>
                                       </div>
                                    ) : p.period_start && p.period_end ? (
                                       <div className="flex flex-col items-center">
                                          <span className="text-[10px] font-black text-gray-900 leading-none">{ymdToCL(p.period_start)}</span>
                                          <span className="text-[8px] font-black text-gray-300 uppercase my-0.5">al</span>
                                          <span className="text-[10px] font-black text-gray-900 leading-none">{ymdToCL(p.period_end)}</span>
                                       </div>
                                    ) : (
                                       <span className="text-gray-300">---</span>
                                    )}
                                 </td>
                                <td className="px-4 py-5 md:py-7 text-center font-bold text-xs text-gray-600">
                                   {ymdToCL(p.payment_date)}
                                </td>
                                <td className="px-4 py-5 md:py-7 text-center">
                                   <span className="px-3 py-1 bg-white border border-gray-100 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-500">
                                      {p.method}
                                   </span>
                                </td>
                                <td className="px-6 md:px-10 py-5 md:py-7 text-right font-black text-base md:text-xl text-emerald-600">
                                   {fmtCLP(p.amount)}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
                 {(!payments.recent || payments.recent.length === 0) && (
                    <div className="py-20 text-center text-gray-300 font-bold italic">No se registran movimientos financieros.</div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* Modal de Renovación */}
      {renewModalData && (
        <RenewModal
          isOpen={true}
          onClose={() => setRenewModalData(null)}
          onSuccess={() => {
            setRenewModalData(null)
            loadData() // Recargar datos financieros y de inscripción
          }}
          studentId={renewModalData.studentId}
          courseId={renewModalData.courseId}
          enrollmentId={renewModalData.enrollmentId}
        />
      )}

      {/* Modal de Edición de inscripción */}
      {editEnrollmentData && (
        <EditEnrollmentModal
          isOpen={true}
          onClose={() => setEditEnrollmentData(null)}
          onSuccess={() => {
            setEditEnrollmentData(null)
            loadData() // Recargar para mostrar los cambios
          }}
          enrollment={editEnrollmentData}
        />
      )}

      {deleteAttendanceModal && createPortal(
        <div className="fixed left-0 top-0 z-[999] h-screen w-screen bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-gray-200 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5">
            <div>
              <h3 className="text-lg md:text-xl font-black text-gray-900">Eliminar asistencia por curso</h3>
              <p className="text-sm text-gray-500 mt-1">
                Día {ymdToCL(deleteAttendanceModal.date)}. Selecciona exactamente qué asistencia deseas eliminar.
              </p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {deleteAttendanceModal.courseIds.map((courseId) => (
                <button
                  key={courseId}
                  onClick={() => deleteAttendanceForCourses([courseId], deleteAttendanceModal.date)}
                  disabled={deletingAttendance}
                  className="w-full text-left p-4 rounded-2xl border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-gray-900">{getCourseNameById(courseId)}</div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mt-1">Eliminar solo este curso</div>
                    </div>
                    <HiOutlineTrash className="text-rose-500 shrink-0" size={20} />
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {deleteAttendanceModal.courseIds.length > 1 && (
                <button
                  onClick={() => deleteAttendanceForCourses(deleteAttendanceModal.courseIds, deleteAttendanceModal.date)}
                  disabled={deletingAttendance}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Eliminar todos los cursos del día
                </button>
              )}
              <button
                onClick={() => setDeleteAttendanceModal(null)}
                disabled={deletingAttendance}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {showFeeModal && createPortal(
        <div className="fixed left-0 top-0 z-[999] h-screen w-screen bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl shadow-2xl p-6 md:p-8 space-y-5">
            <div>
              <h3 className="text-xl font-black text-gray-900">Cobrar matrícula</h3>
              <p className="text-sm text-gray-500 mt-1">Se registrará solo el cobro de matrícula para este alumno.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Monto</label>
                <input
                  value={new Intl.NumberFormat('es-CL').format(Number(feeSettings?.enrollment_fee_amount || 0))}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-black"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Método</label>
                <select
                  value={feePayMethod}
                  onChange={(e) => setFeePayMethod(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-black"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="convenio">Convenio</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Referencia</label>
              <input
                value={feeReference}
                onChange={(e) => setFeeReference(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-bold"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowFeeModal(false)}
                disabled={savingFee}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={handlePayEnrollmentFee}
                disabled={savingFee}
                className="flex-1 py-3 rounded-2xl bg-fuchsia-600 text-white font-black text-xs uppercase tracking-widest hover:bg-fuchsia-700 transition-colors disabled:opacity-60"
              >
                {savingFee ? 'Guardando...' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}



