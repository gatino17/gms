import { useEffect, useState, useMemo, useRef } from 'react'
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
  HiOutlinePaperAirplane,
  HiOutlinePlus,
  HiOutlineSwitchHorizontal,
  HiOutlineCheckCircle,
  HiOutlinePhotograph
} from 'react-icons/hi'
import { IoMale, IoFemale } from 'react-icons/io5'
import { useTenant } from '../lib/tenant'
import RenewModal from '../components/RenewModal'

type CourseRow = {
  course: {
    id: number;
    name: string;
    level?: string;
    start_date?: string | null;
    price?: number | null;
    classes_per_week?: number | null;
    day_of_week?: number | null;
    day_of_week_2?: number | null;
    day_of_week_3?: number | null;
    day_of_week_4?: number | null;
    day_of_week_5?: number | null;
    start_time?: string | null;
    start_time_2?: string | null;
    start_time_3?: string | null;
    start_time_4?: string | null;
    start_time_5?: string | null;
    course_type?: string | null;
    total_classes?: number | null;
  }
  teacher?: { id: number | null; name?: string | null } | null
  counts?: { total: number; female: number; male: number }
  students: {
    id: number;
    enrollment_id?: number;
    photo_url?: string | null;
    first_name: string;
    last_name: string;
    gender?: string | null;
    email?: string | null;
    phone?: string | null;
    renewal_date?: string | null;
    payment_status?: 'activo' | 'pendiente' | 'inactivo';
    enrollment_mode?: 'regular' | 'single_class';
    single_class_date?: string | null;
    attendance_count?: number;
    expected_count?: number;
    extra_count?: number;
    birthday_today?: boolean;
  }[]
}

const DAY_NAMES = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']
const fmtCLP = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(n)
const normalizeGender = (g?: string | null) => (g || '').trim().toLowerCase()
const minusOneDayYMD = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() - 1)
  return dt.toISOString().slice(0, 10)
}

const isPaidStatus = (status?: string | null) => status === 'activo'
const isPendingStatus = (status?: string | null) => status === 'pendiente'
const isInactiveStatus = (status?: string | null) => status === 'inactivo'
const isSingleClassMode = (mode?: string | null) => mode === 'single_class'

const paymentBadgeClass = (status?: string | null) => {
  if (isPaidStatus(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  if (isInactiveStatus(status)) return 'bg-slate-100 text-slate-600 border-slate-200'
  return 'bg-rose-50 text-rose-600 border-rose-100'
}

const paymentDotClass = (status?: string | null) => {
  if (isPaidStatus(status)) return 'bg-emerald-500'
  if (isInactiveStatus(status)) return 'bg-slate-400'
  return 'bg-rose-500'
}

const paymentLabel = (status?: string | null) => {
  if (isPaidStatus(status)) return 'Pagado'
  if (isInactiveStatus(status)) return 'Inactivo'
  return 'Pendiente'
}

const formatScheduleTime = (raw?: string | null) => {
  if (!raw) return ''
  return raw.slice(0, 5)
}

const courseScheduleSummary = (course: CourseRow['course']) => {
  const slots = [
    { day: course.day_of_week, time: course.start_time },
    { day: course.day_of_week_2, time: course.start_time_2 },
    { day: course.day_of_week_3, time: course.start_time_3 },
    { day: course.day_of_week_4, time: course.start_time_4 },
    { day: course.day_of_week_5, time: course.start_time_5 },
  ]

  return slots
    .filter((slot) => slot.day != null)
    .map((slot) => {
      const dayName = DAY_NAMES[slot.day ?? 0] || 'Sin dia'
      const time = formatScheduleTime(slot.time)
      return time ? `${dayName} ${time}hrs` : dayName
    })
    .join(', ')
}

export default function CourseStatusPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const [data, setData] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tenantInfo, setTenantInfo] = useState<any>(null)
  const [renewModalData, setRenewModalData] = useState<{ studentId: number; courseId: number; enrollmentId: number } | null>(null)

  // View state: 'detailed' | 'pending' | 'summary' | 'gender'
  const [viewMode, setViewMode] = useState<'detailed' | 'pending' | 'summary' | 'gender'>('detailed')

  // Filters
  const [courseQ, setCourseQ] = useState('')
  const [studentQ, setStudentQ] = useState('')
  const [selectedDay, setSelectedDay] = useState<string>('')

  // Enrollment Modal States
  const [enrollModalCourseId, setEnrollModalCourseId] = useState<number | null>(null)
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [enrollSearchQ, setEnrollSearchQ] = useState('')
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [transferSourceRow, setTransferSourceRow] = useState<CourseRow | null>(null)
  const [transferTargetCourseId, setTransferTargetCourseId] = useState<number | ''>('')
  const [transferEffectiveDate, setTransferEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [transferring, setTransferring] = useState(false)
  const [transferResult, setTransferResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null)
  const [transferSelectedIds, setTransferSelectedIds] = useState<number[]>([])
  const [allCoursesCatalog, setAllCoursesCatalog] = useState<Array<{ id: number; name: string }>>([])
  const [waTestLoadingByStudent, setWaTestLoadingByStudent] = useState<Record<string, boolean>>({})
  const [waTestResultByStudent, setWaTestResultByStudent] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [waBulkLoadingByCourse, setWaBulkLoadingByCourse] = useState<Record<number, boolean>>({})
  const [waBulkResultByCourse, setWaBulkResultByCourse] = useState<Record<number, string>>({})
  const [waBulkConfirmCourse, setWaBulkConfirmCourse] = useState<CourseRow | null>(null)

  // Quick Create Student States
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [newStudent, setNewStudent] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
    birthdate: '',
    notes: '',
    joined_at: new Date().toISOString().slice(0, 10),
    is_active: true
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      try {
        const coursesRes = await api.get('/api/pms/courses', { params: { limit: 500 } })
        setAllCoursesCatalog((coursesRes.data?.items || coursesRes.data || []).map((c: any) => ({ id: c.id, name: c.name })))
      } catch {
        // Mantener ?ltimo cat?logo cargado para no vaciar el selector destino
      }
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

    // Check if already enrolled in this course
    const courseRow = data.find(r => r.course.id === enrollModalCourseId)
    if (courseRow?.students.some(s => s.id === studentId)) {
       alert("Este alumno ya se encuentra inscrito en este curso.")
       return
    }

    setIsEnrolling(true)
    try {
      const { data } = await api.post('/api/pms/enrollments/', {
        student_id: studentId,
        course_id: enrollModalCourseId,
        start_date: new Date().toISOString().split('T')[0]
      })
      const enrollmentId = data.id
      const cid = enrollModalCourseId

      setEnrollModalCourseId(null)
      setEnrollSearchQ('')

      // Open Payment Modal (initial payment)
      setRenewModalData({ studentId, courseId: cid, enrollmentId })

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

      // Upload Photo if exists
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        await api.post(`/api/pms/students/${student.id}/photo`, formData)
      }

      // 2. Enroll Student
      const { data: enrollment } = await api.post('/api/pms/enrollments/', {
        student_id: student.id,
        course_id: enrollModalCourseId,
        start_date: new Date().toISOString().split('T')[0]
      })

      const cid = enrollModalCourseId
      const sid = student.id
      const eid = enrollment.id

      setEnrollModalCourseId(null)
      setShowQuickCreate(false)
      setNewStudent({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        gender: '',
        birthdate: '',
        notes: '',
        joined_at: new Date().toISOString().slice(0, 10),
        is_active: true
      })
      setEnrollSearchQ('')
      setImageFile(null)
      setImagePreview(null)

      // Open Payment Modal (initial payment)
      setRenewModalData({ studentId: sid, courseId: cid, enrollmentId: eid })

      load()
    } catch (e: any) {
      alert('Error: ' + (e.response?.data?.detail || e.message))
    } finally {
      setIsEnrolling(false)
    }
  }


  const waStatusColorClass = (message?: string) => {
    if (!message) return 'text-gray-500'
    const m = message.toLowerCase()
    if (m.includes('entregado')) return 'text-emerald-600'
    if (m.includes('enviado')) return 'text-amber-600'
    if (m.includes('no entregado')) return 'text-rose-600'
    return 'text-gray-500'
  }
  const filteredData = useMemo(() => {
    return data.map(row => ({
      ...row,
      students: row.students.filter(s => {
        const matchesStudent = !studentQ || (s.first_name + ' ' + s.last_name).toLowerCase().includes(studentQ.toLowerCase())
        const matchesPending = viewMode !== 'pending' || isPendingStatus(s.payment_status)
        return matchesStudent && matchesPending
      })
    })).filter(row => row.students.length > 0 || (!studentQ && viewMode !== 'pending'))
  }, [data, studentQ, viewMode])

  const groupedByDay = useMemo(() => {
    const groups: Record<string, CourseRow[]> = {}
    filteredData.forEach(row => {
      const d = row.course.day_of_week ?? 0
      const dayName = DAY_NAMES[d] || 'Sin dia'
      if (!groups[dayName]) groups[dayName] = []
      groups[dayName].push(row)
    })
    return groups
  }, [filteredData])

  const orderedGroupedByDay = useMemo(() => {
    const todayIndex = (new Date().getDay() + 6) % 7
    const orderedDayNames = [
      ...DAY_NAMES.slice(todayIndex),
      ...DAY_NAMES.slice(0, todayIndex),
    ]
    return orderedDayNames
      .filter((dayName) => groupedByDay[dayName]?.length)
      .map((dayName) => [dayName, groupedByDay[dayName]] as const)
  }, [groupedByDay])


  const courseGenderCounts = useMemo(() => {
    const countsByCourse: Record<number, { total: number; female: number; male: number }> = {}
    for (const row of filteredData) {
      const female = row.students.filter((s) => {
        const g = normalizeGender(s.gender)
        return g.startsWith('f') || g.startsWith('muj') || g === 'female' || g === 'femenino' || g === 'mujer'
      }).length
      const male = row.students.filter((s) => {
        const g = normalizeGender(s.gender)
        return (g.startsWith('m') && !g.startsWith('muj')) || g === 'male' || g === 'masculino' || g === 'hombre'
      }).length
      countsByCourse[row.course.id] = { total: row.students.length, female, male }
    }
    return countsByCourse
  }, [filteredData])


  const allCourseOptions = useMemo(() => {
    const map = new Map<number, string>()
    allCoursesCatalog.forEach((c) => map.set(c.id, c.name))
    data.forEach((r) => map.set(r.course.id, r.course.name))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allCoursesCatalog, data])

  const openTransferModal = (row: CourseRow) => {
    setTransferSourceRow(row)
    setTransferTargetCourseId('')
    setTransferEffectiveDate(new Date().toISOString().slice(0, 10))
    setTransferResult(null)
    setTransferSelectedIds(row.students.filter((s) => !!s.enrollment_id).map((s) => s.id))
  }

  const executeTransfer = async () => {
    if (!transferSourceRow || !transferTargetCourseId || !transferEffectiveDate) return
    if (Number(transferTargetCourseId) === Number(transferSourceRow.course.id)) {
      alert('Debes seleccionar un curso destino distinto al curso actual.')
      return
    }
    const movableStudents = transferSourceRow.students.filter((s) => !!s.enrollment_id && transferSelectedIds.includes(s.id))
    if (movableStudents.length === 0) {
      alert('Debes seleccionar al menos un alumno para trasladar.')
      return
    }

    setTransferring(true)
    const closeDate = minusOneDayYMD(transferEffectiveDate)
    const targetCourseId = Number(transferTargetCourseId)
    const targetRow = data.find((r) => r.course.id === targetCourseId)
    let ok = 0
    let fail = 0
    const errors: string[] = []
    try {
      for (const s of movableStudents) {
        if (targetRow?.students.some((st) => st.id === s.id)) {
          fail += 1
          errors.push(`${s.first_name} ${s.last_name}: ya esta inscrito en el curso destino`)
          continue
        }
        try {
          await api.put(`/api/pms/enrollments/${s.enrollment_id}`, { end_date: closeDate, is_active: false })
          await api.post('/api/pms/enrollments/', { student_id: s.id, course_id: targetCourseId, start_date: transferEffectiveDate })
          ok += 1
        } catch (e: any) {
          fail += 1
          errors.push(`${s.first_name} ${s.last_name}: ${e?.response?.data?.detail || e?.message || 'Error'}`)
        }
      }
      await load()
      if (fail === 0) {
        setTransferResult(null)
        setTransferSourceRow(null)
        alert(`Traslado completado: ${ok} alumno(s) movido(s).`)
      } else {
        setTransferResult({ ok, fail, errors })
      }
    } finally {
      setTransferring(false)
    }
  }
  const waKey = (courseId: number, studentId: number) => `${courseId}-${studentId}`
  const pollWhatsAppDeliveryStatus = (sid: string, stateKey: string) => {
    const delays = [4000, 10000, 20000, 35000]
    for (const delay of delays) {
      setTimeout(async () => {
        try {
          const st = await api.get(`/api/pms/whatsapp/status/${sid}`)
          const status = String(st?.data?.status || '').toLowerCase()
          if (status === 'delivered' || status === 'read') {
            setWaTestResultByStudent((prev) => ({ ...prev, [stateKey]: { ok: true, message: 'Entregado' } }))
            return
          }
          if (status === 'failed' || status === 'undelivered') {
            setWaTestResultByStudent((prev) => ({ ...prev, [stateKey]: { ok: false, message: 'No entregado' } }))
          }
        } catch {
          // no-op
        }
      }, delay)
    }
  }
  const handleWhatsAppTest = async (studentId: number, courseId: number) => {
    const stateKey = waKey(courseId, studentId)
    setWaTestLoadingByStudent((prev) => ({ ...prev, [stateKey]: true }))
    setWaTestResultByStudent((prev) => ({ ...prev, [stateKey]: { ok: false, message: '' } }))
    try {
      const res = await api.post('/api/pms/whatsapp/test', { student_id: studentId, course_id: courseId })
      const sid = String(res?.data?.sid || '')
      setWaTestResultByStudent((prev) => ({ ...prev, [stateKey]: { ok: true, message: 'Mensaje enviado' } }))
      if (sid) pollWhatsAppDeliveryStatus(sid, stateKey)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'No se pudo enviar.'
      setWaTestResultByStudent((prev) => ({ ...prev, [stateKey]: { ok: false, message: String(msg) } }))
    } finally {
      setWaTestLoadingByStudent((prev) => ({ ...prev, [stateKey]: false }))
    }
  }
  const openBulkWhatsAppModal = (row: CourseRow) => {
    const pendingStudents = row.students.filter((s) => isPendingStatus(s.payment_status))
    if (pendingStudents.length === 0) {
      setWaBulkResultByCourse((prev) => ({ ...prev, [row.course.id]: 'Sin alumnos pendientes' }))
      return
    }
    setWaBulkConfirmCourse(row)
  }
  const handleWhatsAppBulkByCourse = async (row: CourseRow) => {
    const courseId = row.course.id
    const pendingStudents = row.students.filter((s) => isPendingStatus(s.payment_status))
    if (pendingStudents.length === 0) {
      setWaBulkResultByCourse((prev) => ({ ...prev, [courseId]: 'Sin alumnos pendientes' }))
      return
    }
    setWaBulkConfirmCourse(null)
    setWaBulkLoadingByCourse((prev) => ({ ...prev, [courseId]: true }))
    setWaBulkResultByCourse((prev) => ({ ...prev, [courseId]: '' }))
    let ok = 0
    let fail = 0
    try {
      for (const s of pendingStudents) {
        try {
          const res = await api.post('/api/pms/whatsapp/test', { student_id: s.id, course_id: courseId })
          const sid = String(res?.data?.sid || '')
          const stateKey = waKey(courseId, s.id)
          setWaTestResultByStudent((prev) => ({ ...prev, [stateKey]: { ok: true, message: 'Mensaje enviado' } }))
          if (sid) pollWhatsAppDeliveryStatus(sid, stateKey)
          ok += 1
        } catch {
          fail += 1
        }
      }
      const summary = fail > 0 ? ('Envios: ' + ok + ' ok | ' + fail + ' con problema') : ('Envios completados: ' + ok)
      setWaBulkResultByCourse((prev) => ({ ...prev, [courseId]: summary }))
    } finally {
      setWaBulkLoadingByCourse((prev) => ({ ...prev, [courseId]: false }))
    }
  }
  return (
    <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8 pb-20 px-4 md:px-0">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pt-4">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Gestion Academica</span>
           <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-none">Estado de Cursos</h1>
           <div className="flex flex-col sm:flex-row sm:flex-wrap items-center justify-center sm:justify-start gap-4 mt-4">
              <p className="text-gray-500 font-medium text-sm md:text-lg max-w-[20rem]">Control de inscripciones y pagos en tiempo real.</p>
              <div className="hidden sm:block h-4 w-px bg-gray-200" />
               <div className="grid grid-cols-2 sm:flex w-full sm:w-auto bg-gray-50 p-1.5 rounded-2xl border border-gray-100 gap-1.5">
                 <button onClick={() => setViewMode('detailed')} className={`px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='detailed' ? 'bg-white shadow-sm text-fuchsia-600' : 'text-gray-400 hover:text-gray-600'}`}>Todos</button>
                 <button onClick={() => setViewMode('pending')} className={`px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='pending' ? 'bg-white shadow-sm text-rose-600' : 'text-rose-400/60 hover:text-rose-600'}`}>Pendientes</button>
                 <button onClick={() => setViewMode('gender')} className={`px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='gender' ? 'bg-white shadow-sm text-sky-600' : 'text-gray-400 hover:text-gray-600'}`}>Por genero</button>
                 <button onClick={() => setViewMode('summary')} className={`px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode==='summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>Resumen</button>
               </div>
           </div>
        </div>

        <div className="w-full xl:w-auto flex flex-col gap-3 bg-white p-3 rounded-[24px] border border-gray-100 shadow-xl shadow-gray-100/50">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div className="relative group min-w-0">
                 <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={16} />
                 <input value={courseQ} onChange={e=>setCourseQ(e.target.value)} placeholder="Curso..." className="w-full pl-10 pr-5 py-2.5 bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all" />
              </div>
              <div className="relative group min-w-0">
                 <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={16} />
                 <input value={studentQ} onChange={e=>setStudentQ(e.target.value)} placeholder="Alumno..." className="w-full pl-10 pr-5 py-2.5 bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all" />
              </div>
           </div>
           <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                 <select value={selectedDay} onChange={e=>setSelectedDay(e.target.value)} className="w-full pl-5 pr-10 py-2.5 bg-gray-50 border-2 border-transparent focus:border-fuchsia-100 focus:bg-white rounded-xl text-sm font-bold outline-none appearance-none transition-all">
                    <option value="">Cualquier dia</option>
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
           {orderedGroupedByDay.map(([dayName, courses]) => (
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
                          <div className={`flex flex-col gap-4 ${viewMode === 'summary' ? 'mb-6' : 'px-5 md:px-8 py-5 md:py-6 bg-gray-50/50 border-b border-gray-100'}`}>
                             <div className="flex items-center gap-4 min-w-0">
                                <div className={`flex items-center justify-center bg-gradient-to-br from-fuchsia-600 to-purple-700 text-white font-black shadow-xl shadow-fuchsia-100 transition-transform duration-500 group-hover:scale-110 ${viewMode === 'summary' ? 'w-12 h-12 rounded-[20px] text-lg' : 'w-14 h-14 rounded-[22px] text-xl'}`}>
                                   {row.course.name[0]}
                                </div>
                                <div className="min-w-0">
                                   <h3 className={`font-black text-gray-900 leading-tight truncate ${viewMode === 'summary' ? 'text-base' : 'text-xl'}`}>{row.course.name}</h3>
                                   <div className="flex items-start gap-2 mt-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
                                      <div className="min-w-0">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                          {row.teacher?.name || 'Por Asignar'}
                                        </p>
                                        {!!courseScheduleSummary(row.course) && (
                                          <p className="text-[10px] font-bold text-gray-500 mt-1 leading-relaxed break-words">
                                            {courseScheduleSummary(row.course)}
                                          </p>
                                        )}
                                      </div>
                                   </div>
                                   {(() => {
                                      const counts = courseGenderCounts[row.course.id] || { total: row.students.length, female: 0, male: 0 }
                                      return (
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                          <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-[9px] font-black uppercase tracking-widest text-gray-700">{counts.total} Alumnos</span>
                                          {counts.female > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 text-[9px] font-black uppercase tracking-widest text-pink-700">
                                              <IoFemale size={12} />
                                              {counts.female}
                                            </span>
                                          )}
                                          {counts.male > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-[9px] font-black uppercase tracking-widest text-sky-700">
                                              <IoMale size={12} />
                                              {counts.male}
                                            </span>
                                          )}
                                        </div>
                                      )
                                   })()}
                                </div>
                             </div>
                             <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
                                <button
                                   onClick={() => openTransferModal(row)}
                                   className={`${viewMode === 'summary' ? 'hidden sm:flex' : 'hidden md:flex'} items-center justify-center gap-2 ${viewMode === 'summary' ? 'w-10 h-10 p-0 rounded-xl' : 'px-4 py-2.5 rounded-xl'} bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all`} title="Trasladar alumnos"
                                >{viewMode === 'summary' ? <HiOutlineSwitchHorizontal size={16} /> : 'Trasladar'}</button>
                                <button
                                   onClick={() => openBulkWhatsAppModal(row)}
                                   disabled={!!waBulkLoadingByCourse[row.course.id]}
                                   className={`${viewMode === 'summary' ? 'hidden sm:flex' : 'hidden md:flex'} items-center justify-center gap-2 ${viewMode === 'summary' ? 'w-10 h-10 p-0 rounded-xl' : 'px-4 py-2.5 rounded-xl'} bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all disabled:opacity-60`} title="Enviar mensaje"
                                >
                                  <HiOutlineMail size={14} />{viewMode === 'summary' ? null : (waBulkLoadingByCourse[row.course.id] ? 'Enviando...' : 'Pendientes')}
                                </button>
                                <button
                                   onClick={() => { setEnrollModalCourseId(row.course.id); loadAllStudents(); }}
                                   className={`flex items-center justify-center gap-2 w-full sm:w-auto ${viewMode === 'summary' ? 'sm:w-10 sm:h-10 p-3 sm:p-0 rounded-xl' : 'px-4 py-2.5 rounded-xl'} bg-fuchsia-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-200 transition-all active:scale-95`} title="Inscribir alumno"
                                >
                                   <HiOutlinePlus size={14} />
                                   <span className={viewMode === 'summary' ? 'sm:hidden' : ''}>Inscribir</span>
                                </button>
                                {(viewMode === 'detailed' || viewMode === 'pending' || viewMode === 'gender') && (
                                   <button onClick={() => navigate(`/courses/${row.course.id}`)} className="hidden sm:flex p-4 bg-white border border-gray-100 rounded-2xl hover:text-fuchsia-600 hover:shadow-lg transition-all group/btn">
                                      <HiOutlineChevronRight size={24} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                   </button>
                                )}
                             </div>
                          </div>
                          {!!waBulkResultByCourse[row.course.id] && (
                             <div className={`px-6 md:px-8 pb-3 text-[10px] font-black uppercase tracking-widest ${waBulkResultByCourse[row.course.id].includes('problema') ? 'text-amber-600' : 'text-emerald-600'}`}>
                               {waBulkResultByCourse[row.course.id]}
                             </div>
                          )}
                          {/* Detailed/Compact Table */}
                          {(viewMode === 'detailed' || viewMode === 'pending') && (
                             <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full">
                                   <thead className="hidden md:table-header-group">
                                      <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30">
                                         <th className="pl-12 pr-6 py-5">Informacion Alumno</th>
                                         <th className="px-6 py-5 text-center">Progreso de Asistencia</th>
                                         <th className="px-6 py-5 text-center">Cobro</th>
                                         <th className="px-6 py-5 text-center">Estatus Financiero</th>
                                         <th className="pr-12 pl-6 py-5 text-right">Contacto</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-50 block md:table-row-group">
                                       {row.students.map((s) => {
                                          const isPaid = isPaidStatus(s.payment_status)
                                          const isInactive = isInactiveStatus(s.payment_status)
                                          const isSingleClass = isSingleClassMode(s.enrollment_mode)
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
                                                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Socio #{s.id}</div>
                                                       </div>
                                                      </div>
                                                </td>
                                               <td className="block md:table-cell px-8 md:px-6 py-4 md:py-6">
                                                  <div className="w-full md:w-32 max-w-[220px] md:max-w-none mx-auto">
                                                     <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase mb-2">
                                                        <span className="md:hidden">Asistencia: </span>
                                                        <span className="text-gray-900">{s.attendance_count}/{s.expected_count}</span>
                                                        <span className={progress >= 80 ? 'text-emerald-600' : 'text-fuchsia-600'}>{Math.round(progress)}%</span>
                                                     </div>
                                                     <div className="h-1.5 md:h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner relative">
                                                        <div className={`h-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-fuchsia-500' : 'bg-rose-400'}`} style={{ width: `${progress}%` }} />
                                                     </div>
                                                      {!isSingleClass && !!s.extra_count && s.extra_count > 0 && (
                                                         <div className="mt-2 flex justify-center">
                                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-black uppercase tracking-widest rounded-md cursor-help transition-colors hover:bg-amber-100" title="Asistencia registrada fuera de las fechas de su plan original (ej. Clase suelta)">
                                                               +{s.extra_count} Extra{s.extra_count > 1 ? 's' : ''}
                                                            </span>
                                                         </div>
                                                     )}
                                                  </div>
                                               </td>
                                               <td className="block md:table-cell px-8 md:px-6 py-4 md:py-6 text-left md:text-center">
                                                   <span className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Cobro</span>
                                                   <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isSingleClass ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-sky-50 text-sky-700 border-sky-100'}`}>
                                                      <div className={`w-2 h-2 rounded-full ${isSingleClass ? 'bg-amber-500' : 'bg-sky-500'}`} />
                                                      {isSingleClass ? 'Clase suelta' : 'Mensualidad'}
                                                   </span>
                                               </td>
                                               <td className="block md:table-cell px-8 md:px-6 py-4 md:py-6 text-left md:text-center">
                                                   <span className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Estado de Pago</span>
                                                   {isPaid ? (
                                                     <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                                                        PAGADO
                                                     </div>
                                                   ) : isInactive ? (
                                                     <button
                                                       onClick={() => {
                                                         if (s.enrollment_id) setRenewModalData({ studentId: s.id, courseId: row.course.id, enrollmentId: s.enrollment_id })
                                                         else navigate(`/students/${s.id}`)
                                                       }}
                                                       className="inline-flex items-center gap-2 px-6 py-3 md:px-4 md:py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-700 hover:text-white transition-all w-full md:w-auto justify-center shadow-sm active:scale-95"
                                                     >
                                                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                        INACTIVO
                                                     </button>
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
                                                      <button
                                                        onClick={() => handleWhatsAppTest(s.id, row.course.id)}
                                                        disabled={!!waTestLoadingByStudent[waKey(row.course.id, s.id)]}
                                                        className="flex items-center justify-center px-3 py-3 md:p-3 rounded-2xl transition-all w-12 md:w-12 md:flex-none border bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:shadow-lg hover:shadow-emerald-100 disabled:opacity-60 shrink-0"
                                                        title="Enviar WhatsApp"
                                                      >
                                                        <HiOutlinePhone size={18} />
                                                      </button>
                                                      {waTestResultByStudent[waKey(row.course.id, s.id)]?.message && (
                                                        <span className={`hidden md:inline text-[10px] font-bold ${waStatusColorClass(waTestResultByStudent[waKey(row.course.id, s.id)]?.message)}`}>{waTestResultByStudent[waKey(row.course.id, s.id)].message}</span>
                                                      )}
                                                     <button onClick={() => navigate(`/students/${s.id}`)} className="flex items-center justify-center gap-3 px-5 py-3 md:p-3 bg-gray-50 text-gray-400 border border-gray-100 hover:text-fuchsia-600 hover:bg-white hover:border-fuchsia-100 hover:shadow-lg hover:shadow-fuchsia-100 rounded-2xl transition-all flex-1 md:flex-none">
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

                          {viewMode === 'gender' && (
                             <div className="p-6 md:p-8">
                                {(() => {
                                   const maleStudents = row.students.filter((s) => {
                                     const g = normalizeGender(s.gender)
                                     return (g.startsWith('m') && !g.startsWith('muj')) || g === 'male' || g === 'masculino' || g === 'hombre'
                                   })
                                   const femaleStudents = row.students.filter((s) => {
                                     const g = normalizeGender(s.gender)
                                     return g.startsWith('f') || g.startsWith('muj') || g === 'female' || g === 'femenino' || g === 'mujer'
                                   })
                                   return (
                                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                       {maleStudents.length > 0 && (
                                       <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
                                         <div className="flex items-center justify-between mb-3">
                                           <div className="inline-flex items-center gap-2 text-sky-700 font-black text-[11px] uppercase tracking-widest">
                                             <IoMale size={14} />
                                             Hombres
                                           </div>
                                           <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-700 text-[10px] font-black">{maleStudents.length}</span>
                                         </div>
                                         <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                           {maleStudents.length === 0 ? (
                                             <div className="text-[11px] text-sky-700/70 font-bold">Sin alumnos</div>
                                           ) : maleStudents.map((s) => (
                                             <div key={`m-${s.id}`} className="bg-white border border-sky-100 rounded-xl p-3">
                                               <div className="flex items-start gap-3">
                                                 <div className="w-10 h-10 rounded-xl bg-sky-50 overflow-hidden flex items-center justify-center text-sky-600 font-black shrink-0 border border-sky-100">
                                                   {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                                                 </div>
                                                 <div className="min-w-0 flex-1 space-y-2">
                                                   <div className="font-black text-sm text-gray-800 truncate">{s.first_name} {s.last_name}</div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Socio #{s.id}</div>
                                                      {isSingleClassMode(s.enrollment_mode) && (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[8px] font-black uppercase tracking-widest rounded-md">
                                                          Clase suelta
                                                        </span>
                                                      )}
                                                    </div>
                                                   <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
                                                     <span className="text-[11px] font-black text-gray-600 uppercase shrink-0">{s.attendance_count || 0}/{s.expected_count || 0} asist.</span>
                                                     {(() => {
                                                       const progress = s.expected_count && s.expected_count > 0 ? Math.min(100, ((s.attendance_count || 0) / s.expected_count) * 100) : 0
                                                       return (
                                                         <div className="flex items-center gap-1.5 min-w-0">
                                                           <div className="flex-1 sm:flex-none sm:w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                             <div className={`h-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-fuchsia-500' : 'bg-rose-400'}`} style={{ width: `${progress}%` }} />
                                                           </div>
                                                           <span className="text-[10px] font-black text-gray-600 shrink-0">{Math.round(progress)}%</span>
                                                         </div>
                                                       )
                                                     })()}
                                                   </div>
                                                   <div className="flex flex-wrap items-center gap-2">
                                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${paymentBadgeClass(s.payment_status)}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${paymentDotClass(s.payment_status)}`} />
                                                        {paymentLabel(s.payment_status)}
                                                      </span>
                                                     {waTestResultByStudent[waKey(row.course.id, s.id)]?.message && (
                                                       <span className={`hidden md:inline text-[10px] font-bold ${waStatusColorClass(waTestResultByStudent[waKey(row.course.id, s.id)]?.message)}`}>{waTestResultByStudent[waKey(row.course.id, s.id)].message}</span>
                                                     )}
                                                     <button
                                                       onClick={() => handleWhatsAppTest(s.id, row.course.id)}
                                                       disabled={!!waTestLoadingByStudent[waKey(row.course.id, s.id)]}
                                                       className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all shrink-0 bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white disabled:opacity-60"
                                                       title="Enviar WhatsApp"
                                                     >
                                                       <HiOutlinePhone size={14} />
                                                     </button>
                                                   </div>
                                                 </div>
                                               </div>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                       )}

                                       {femaleStudents.length > 0 && (
                                       <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
                                         <div className="flex items-center justify-between mb-3">
                                           <div className="inline-flex items-center gap-2 text-pink-700 font-black text-[11px] uppercase tracking-widest">
                                             <IoFemale size={14} />
                                             Mujeres
                                           </div>
                                           <span className="px-2.5 py-1 rounded-lg bg-pink-100 text-pink-700 text-[10px] font-black">{femaleStudents.length}</span>
                                         </div>
                                         <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                                           {femaleStudents.length === 0 ? (
                                             <div className="text-[11px] text-pink-700/70 font-bold">Sin alumnas</div>
                                           ) : femaleStudents.map((s) => (
                                             <div key={`f-${s.id}`} className="bg-white border border-pink-100 rounded-xl p-3">
                                               <div className="flex items-start gap-3">
                                                 <div className="w-10 h-10 rounded-xl bg-pink-50 overflow-hidden flex items-center justify-center text-pink-600 font-black shrink-0 border border-pink-100">
                                                   {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                                                 </div>
                                                 <div className="min-w-0 flex-1 space-y-2">
                                                   <div className="font-black text-sm text-gray-800 truncate">{s.first_name} {s.last_name}</div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Socio #{s.id}</div>
                                                      {isSingleClassMode(s.enrollment_mode) && (
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[8px] font-black uppercase tracking-widest rounded-md">
                                                          Clase suelta
                                                        </span>
                                                      )}
                                                    </div>
                                                   <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
                                                     <span className="text-[11px] font-black text-gray-600 uppercase shrink-0">{s.attendance_count || 0}/{s.expected_count || 0} asist.</span>
                                                     {(() => {
                                                       const progress = s.expected_count && s.expected_count > 0 ? Math.min(100, ((s.attendance_count || 0) / s.expected_count) * 100) : 0
                                                       return (
                                                         <div className="flex items-center gap-1.5 min-w-0">
                                                           <div className="flex-1 sm:flex-none sm:w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                             <div className={`h-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-fuchsia-500' : 'bg-rose-400'}`} style={{ width: `${progress}%` }} />
                                                           </div>
                                                           <span className="text-[10px] font-black text-gray-600 shrink-0">{Math.round(progress)}%</span>
                                                         </div>
                                                       )
                                                     })()}
                                                   </div>
                                                   <div className="flex flex-wrap items-center gap-2">
                                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 ${paymentBadgeClass(s.payment_status)}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${paymentDotClass(s.payment_status)}`} />
                                                        {paymentLabel(s.payment_status)}
                                                      </span>
                                                     {waTestResultByStudent[waKey(row.course.id, s.id)]?.message && (
                                                       <span className={`hidden md:inline text-[10px] font-bold ${waStatusColorClass(waTestResultByStudent[waKey(row.course.id, s.id)]?.message)}`}>{waTestResultByStudent[waKey(row.course.id, s.id)].message}</span>
                                                     )}
                                                     <button
                                                       onClick={() => handleWhatsAppTest(s.id, row.course.id)}
                                                       disabled={!!waTestLoadingByStudent[waKey(row.course.id, s.id)]}
                                                       className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all shrink-0 bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white disabled:opacity-60"
                                                       title="Enviar WhatsApp"
                                                     >
                                                       <HiOutlinePhone size={14} />
                                                     </button>
                                                   </div>
                                                 </div>
                                               </div>
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                       )}
                                     </div>
                                   )
                                })()}
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
                                      <span className="text-emerald-600">{row.students.filter(s => isPaidStatus(s.payment_status)).length} / {row.students.length}</span>
                                    </div>
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner p-0.5">
                                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${(row.students.filter(s => isPaidStatus(s.payment_status)).length / (row.students.length || 1)) * 100}%` }} />
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

      {transferSourceRow && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !transferring && setTransferSourceRow(null)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
            <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/40">
              <h2 className="text-xl font-black text-gray-900">Trasladar alumnos</h2>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                {transferSourceRow.course.name} | nuevo curso
              </p>
            </div>
            <div className="p-6 md:p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Curso origen</label>
                  <input value={transferSourceRow.course.name} readOnly className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 font-black text-gray-700" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Curso destino</label>
                  <select
                    value={transferTargetCourseId}
                    onChange={(e) => setTransferTargetCourseId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white font-black text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Seleccionar...</option>
                    {allCourseOptions
                      .filter((c) => c.id !== transferSourceRow.course.id)
                      .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">Fecha efectiva</label>
                  <input
                    type="date"
                    value={transferEffectiveDate}
                    onChange={(e) => setTransferEffectiveDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white font-black text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 text-[11px] font-bold text-indigo-700">
                  Se trasladaran <span className="font-black">{transferSelectedIds.length}</span> alumno(s). El curso origen se cerrara el dia anterior.
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="inline-flex items-center gap-2 text-xs font-black text-gray-700">
                    <input
                      type="checkbox"
                      checked={transferSourceRow.students.filter((s) => !!s.enrollment_id).length > 0 && transferSelectedIds.length === transferSourceRow.students.filter((s) => !!s.enrollment_id).length}
                      onChange={(e) => {
                        const allIds = transferSourceRow.students.filter((s) => !!s.enrollment_id).map((s) => s.id)
                        setTransferSelectedIds(e.target.checked ? allIds : [])
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    Seleccionar todos
                  </label>
                  <span className="text-[11px] font-bold text-gray-500">{transferSelectedIds.length} seleccionado(s)</span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {transferSourceRow.students.filter((s) => !!s.enrollment_id).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={transferSelectedIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setTransferSelectedIds((prev) => [...prev, s.id])
                          else setTransferSelectedIds((prev) => prev.filter((id) => id !== s.id))
                        }}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                      <span className="text-sm font-bold text-gray-700">{s.first_name} {s.last_name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {transferResult && (
                <div className={`rounded-xl border p-3 ${transferResult.fail > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                  <div className="text-xs font-black uppercase tracking-widest">
                    {transferResult.ok === 0 && transferResult.fail > 0
                      ? `No se movio ningun alumno | ${transferResult.fail} ya inscritos`
                      : `Traslado parcial: ${transferResult.ok} movido(s) | ${transferResult.fail} ya inscritos`}
                  </div>
                  {transferResult.errors.length > 0 && (
                    <div className="mt-2 max-h-28 overflow-y-auto text-[11px] font-bold space-y-1">
                      {transferResult.errors.map((err, idx) => <div key={idx}>- {err}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 bg-white flex gap-3">
              <button
                onClick={() => setTransferSourceRow(null)}
                disabled={transferring}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-black text-xs uppercase tracking-widest hover:bg-gray-200 disabled:opacity-50"
              >
                Cerrar
              </button>
              <button
                onClick={executeTransfer}
                disabled={transferring || !transferTargetCourseId || !transferEffectiveDate || transferSelectedIds.length === 0}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50"
              >
                {transferring ? 'Trasladando...' : 'Confirmar traslado'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Enrollment Modal */}
      {enrollModalCourseId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEnrollModalCourseId(null)} />
           <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100 transition-all duration-500">
              <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                 <h2 className="text-xl font-black text-gray-900">{showQuickCreate ? 'Registrar Nuevo Alumno' : 'Inscribir Alumno'}</h2>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{showQuickCreate ? 'Completa los datos del perfil oficial' : 'Busca y selecciona un alumno'}</p>

                 {!showQuickCreate && (
                    <div className="mt-6 relative animate-in fade-in zoom-in duration-300">
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
                 )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                 {showQuickCreate ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex flex-col md:flex-row gap-6">
                           {/* Photo Upload Area */}
                           <div className="w-full md:w-40 shrink-0">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Foto Alumno</label>
                              <div
                                 onClick={() => fileInputRef.current?.click()}
                                 className="aspect-square rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden hover:border-fuchsia-300 hover:bg-fuchsia-50/30 transition-all cursor-pointer group relative"
                              >
                                 {imagePreview ? (
                                    <img src={imagePreview} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="flex flex-col items-center text-gray-300 group-hover:text-fuchsia-400 transition-colors">
                                       <HiOutlinePhotograph size={32} />
                                       <span className="text-[8px] font-black uppercase mt-2">Subir</span>
                                    </div>
                                 )}
                                 <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                       const file = e.target.files?.[0]
                                       if (file) {
                                          setImageFile(file)
                                          const reader = new FileReader()
                                          reader.onload = (ev) => setImagePreview(ev.target?.result as string)
                                          reader.readAsDataURL(file)
                                       }
                                    }}
                                 />
                              </div>
                           </div>

                           <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombres</label>
                                 <input
                                    type="text"
                                    value={newStudent.first_name}
                                    onChange={(e) => setNewStudent({...newStudent, first_name: e.target.value})}
                                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                    placeholder="Ej: Juan"
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Apellidos</label>
                                 <input
                                    type="text"
                                    value={newStudent.last_name}
                                    onChange={(e) => setNewStudent({...newStudent, last_name: e.target.value})}
                                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                    placeholder="Ej: Perez"
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                                 <input
                                    type="email"
                                    value={newStudent.email}
                                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                    placeholder="ejemplo@correo.com"
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Telefono / WhatsApp</label>
                                 <input
                                    type="text"
                                    value={newStudent.phone}
                                    onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                    placeholder="+56 9 ..."
                                 />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Genero</label>
                                 <select
                                    value={newStudent.gender}
                                    onChange={(e) => setNewStudent({...newStudent, gender: e.target.value})}
                                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all appearance-none"
                                 >
                                    <option value="">Seleccionar...</option>
                                    <option value="Femenino">Femenino</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Otro">Otro</option>
                                 </select>
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fecha Nacimiento</label>
                                 <input
                                    type="date"
                                    value={newStudent.birthdate}
                                    onChange={(e) => setNewStudent({...newStudent, birthdate: e.target.value})}
                                    className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all"
                                 />
                              </div>
                           </div>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notas / Observaciones</label>
                           <textarea
                              value={newStudent.notes}
                              onChange={(e) => setNewStudent({...newStudent, notes: e.target.value})}
                              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-fuchsia-300 focus:bg-white outline-none font-bold text-sm transition-all resize-none"
                              placeholder="Nivel de danza, lesiones, etc..."
                              rows={2}
                           />
                        </div>

                        <div className="pt-2">
                           <button
                              onClick={handleQuickCreateAndEnroll}
                              disabled={isEnrolling || !newStudent.first_name || !newStudent.last_name}
                              className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-fuchsia-200 hover:shadow-fuchsia-300 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                           >
                              {isEnrolling ? 'Procesando...' : (
                                 <>
                                    <HiOutlinePlus size={18} />
                                    Registrar e Inscribir
                                 </>
                              )}
                           </button>
                           <button
                              onClick={() => setShowQuickCreate(false)}
                              className="w-full py-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-gray-600 transition-colors"
                           >
                              Volver a la busqueda
                           </button>
                        </div>
                     </div>
                 ) : (
                    <div className="space-y-2">
                      {allStudents
                          .filter(s => {
                             const q = enrollSearchQ.toLowerCase()
                             return !q || (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
                          })
                          .slice(0, 50)
                          .map(s => {
                             const isAlreadyIn = data.find(r => r.course.id === enrollModalCourseId)?.students.some(st => st.id === s.id)
                             return (
                                <button
                                   key={s.id}
                                   disabled={isEnrolling || isAlreadyIn}
                                   onClick={() => handleEnroll(s.id)}
                                   className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left border border-transparent ${isAlreadyIn ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-fuchsia-50 hover:border-fuchsia-100 group'}`}
                                >
                                   <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xs overflow-hidden shrink-0 border border-gray-50">
                                         {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                                      </div>
                                      <div>
                                         <div className="text-sm font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors">
                                            {s.first_name} {s.last_name}
                                            {isAlreadyIn && <span className="ml-2 text-[8px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Ya inscrito</span>}
                                         </div>
                                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.email || 'Sin correo'}</div>
                                      </div>
                                   </div>
                                   <div className={`p-2 rounded-lg transition-all ${isAlreadyIn ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-50 text-gray-400 group-hover:bg-fuchsia-600 group-hover:text-white'}`}>
                                      {isAlreadyIn ? <HiOutlineCheckCircle size={16} /> : <HiOutlinePlus size={16} />}
                                   </div>
                                </button>
                             )
                          })
                        }

                       <div className="pt-4 border-t border-gray-50">
                          <button
                             onClick={() => setShowQuickCreate(true)}
                             className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gray-50 text-gray-600 hover:bg-gray-100 border border-dashed border-gray-200 transition-all group"
                          >
                             <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-gray-400 group-hover:text-fuchsia-600 transition-colors shadow-sm">
                                <HiOutlinePlus size={16} />
                             </div>
                             <span className="text-xs font-black uppercase tracking-widest">Alumno nuevo? Crear aqui</span>
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

      {waBulkConfirmCourse && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setWaBulkConfirmCourse(null)} />
          <div className="relative w-full max-w-xl">
            <div className="w-full max-w-xl rounded-[28px] border border-gray-100 bg-white shadow-2xl shadow-gray-900/20 overflow-hidden">
              <div className="px-6 md:px-8 py-6 border-b border-gray-100 bg-rose-50/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-500">Confirmar envio</div>
                  <h3 className="mt-2 text-xl font-black text-gray-900">Cobro por curso</h3>
                  <p className="mt-2 text-sm font-medium text-gray-500">
                    Se enviara WhatsApp a los alumnos pendientes del curso <span className="font-black text-gray-800">{waBulkConfirmCourse.course.name}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaBulkConfirmCourse(null)}
                  className="w-10 h-10 rounded-2xl bg-white border border-gray-100 text-gray-400 hover:text-gray-700 hover:border-gray-200 transition-all"
                >
                  X
                </button>
              </div>
            </div>
            <div className="px-6 md:px-8 py-6 space-y-4">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-rose-500">Resumen</div>
                <div className="mt-2 text-sm font-bold text-gray-700">
                  Alumnos pendientes: {waBulkConfirmCourse.students.filter((s) => isPendingStatus(s.payment_status)).length}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Los mensajes se enviaran en cola, uno por uno, usando la plantilla aprobada de WhatsApp.
                </div>
              </div>
            </div>
            <div className="px-6 md:px-8 py-5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setWaBulkConfirmCourse(null)}
                className="px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleWhatsAppBulkByCourse(waBulkConfirmCourse)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200"
              >
                <HiOutlineMail size={14} />
                Enviar pendientes
              </button>
            </div>
          </div>
        </div>
        </div>
      )}
      {/* Modal de Renovacion */}
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

