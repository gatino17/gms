import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'

type PortalData = {
  student: { id:number; first_name:string; last_name:string; email?:string|null }
  enrollments: {
    id:number; is_active:boolean; payment_status?: string | null;
    start_date?:string|null; end_date?:string|null;
    course:{ id:number; name:string; day_of_week?:number|null; start_time?:string|null; end_time?:string|null }
  }[]
  classes_active: number
  payments: {
    total_last_90:number
    recent?: {
      id:number
      amount:number
      payment_date?:string|null
      method:string
      type:string
      reference?:string|null
    }[]
  }
}

type CalDay = { date:string; expected:boolean; attended:boolean; expected_course_ids?: number[]; attended_course_ids?: number[] }

const CL_TZ = 'America/Santiago'
const DAY_NAMES_MON_FIRST = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'] as const

function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(d)
    .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function ymdToCL(ymd?: string | null): string { if (!ymd) return ''; const [y,m,d] = ymd.split('-').map(Number); const dt = new Date(y, (m||1)-1, d||1); return dt.toLocaleDateString('es-CL') }
function ymdBetween(target?: string|null, start?: string|null, end?: string|null): boolean {
  if (!target || !start) return false
  if (end) return target >= start && target <= end
  return target >= start
}
function buildPaymentPeriod(p: any, enrollments?: PortalData['enrollments']): string {
  if (!enrollments || enrollments.length === 0) {
    return p?.type === 'single_class' ? (p?.payment_date ? ymdToCL(p.payment_date) : '-') : '-'
  }
  const byEnroll = enrollments.find(e => e.id === p.enrollment_id)
  if (byEnroll && p.type !== 'single_class') {
    const sd = ymdToCL(byEnroll.start_date) || '-'
    const ed = ymdToCL(byEnroll.end_date)   || '-'
    return `${sd} a ${ed}`
  }
  const byCourse = enrollments.find(e => e.course.id === p.course_id)
  if (byCourse && p.type !== 'single_class') {
    const sd = ymdToCL(byCourse.start_date) || '-'
    const ed = ymdToCL(byCourse.end_date)   || '-'
    return `${sd} a ${ed}`
  }
  const payYmd = p.payment_date ?? ''
  if (payYmd && p.type !== 'single_class') {
    const match = enrollments.find(e => ymdBetween(payYmd, e.start_date, e.end_date))
    if (match) {
      const sd = ymdToCL(match.start_date) || '-'
      const ed = ymdToCL(match.end_date)   || '-'
      return `${sd} a ${ed}`
    }
  }
  if (p.type === 'single_class') {
    return p.payment_date ? ymdToCL(p.payment_date) : '-'
  }
  return '-'
}

function resolvePaymentCourseInfo(
  p: any,
  enrollments?: PortalData['enrollments'],
  teacherMap?: Record<number, string>,
  courseCatalog?: Record<number, { name?: string; teacher?: string; image?: string }>
): { course?: string; teacher?: string; image?: string } {
  const directCourse = (p.course && (p.course.name || (p.course as any).title)) || p.course_name
  const directTeacher = (p.course && (p.course as any).teacher_name) || p.teacher_name
  const directImage = (p.course && (p.course as any).image_url) || p.course_image

  const fromCatalog = (id?: number) => {
    if (id == null) return { name: undefined, teacher: undefined }
    const c = courseCatalog?.[id]
    return { name: c?.name, teacher: c?.teacher || teacherMap?.[id], image: c?.image }
  }

  // 1) Por enrollment
  if (enrollments && enrollments.length > 0) {
    const byEnroll = enrollments.find(e => e.id === p.enrollment_id)
    if (byEnroll) {
      const cat = fromCatalog(byEnroll.course.id)
      return {
        course: byEnroll.course.name || cat.name,
        teacher: (byEnroll.course as any).teacher_name || cat.teacher,
        image: (byEnroll.course as any).image_url || cat.image,
      }
    }
    const byCourse = enrollments.find(e => e.course.id === p.course_id)
    if (byCourse) {
      const cat = fromCatalog(byCourse.course.id)
      return {
        course: byCourse.course.name || cat.name,
        teacher: (byCourse.course as any).teacher_name || cat.teacher,
        image: (byCourse.course as any).image_url || cat.image,
      }
    }
  }

  // 2) Catálogo
  if (p.course_id != null) {
    const cat = fromCatalog(p.course_id)
    if (cat.name || cat.teacher || cat.image) return { course: cat.name || directCourse, teacher: cat.teacher || directTeacher, image: cat.image || directImage }
  }

  // 3) Datos directos del pago
  return { course: directCourse, teacher: directTeacher || (p.course_id != null ? teacherMap?.[p.course_id] : undefined), image: directImage }
}

function buildPaymentConcept(p: any, enrollments?: PortalData['enrollments']): string {
  const base = (p.type === 'monthly' ? 'Mensualidad' : (p.type === 'single_class' ? 'Clase suelta' : (p.type || 'Pago')))
  const { course, teacher } = resolvePaymentCourseInfo(p, enrollments)
  if (course && teacher) return `${base} - ${course} (Prof. ${teacher})`
  if (course) return `${base} - ${course}`
  if (p.reference) return `${base} - ${p.reference}`
  return base
}

// Helpers para contar ocurrencias y asistencia por curso en un periodo
function monthsInRange(startYMD: string, endYMD: string) {
  const out: {year:number; month:number}[] = []
  const [sy, sm] = startYMD.split('-').map(Number)
  const [ey, em] = endYMD.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

function countWeekdayOccurrencesInRange(mon0Day: number, startYMD: string, endYMD: string) {
  const start = new Date(`${startYMD}T00:00:00`)
  const end   = new Date(`${endYMD}T00:00:00`)
  let count = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const w = (d.getDay() + 6) % 7 // 0=Lun..6=Dom
    if (w === mon0Day) count++
  }
  return count
}

export default function StudentDetailPage(){
  const { id } = useParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

  // calendario
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1)
  const [calDays, setCalDays] = useState<CalDay[]>([])
  const [calLoading, setCalLoading] = useState(false)
  const [courseTeacherMap, setCourseTeacherMap] = useState<Record<number, string>>({})
  const [courseCatalog, setCourseCatalog] = useState<Record<number, { name?: string; teacher?: string; image?: string }>>({})
  const todayYMD = useMemo(() => toYMDInTZ(new Date(), CL_TZ), [])

  // modal asistencia simple
  const [showAttend, setShowAttend] = useState(false)
  const [attendDate, setAttendDate] = useState<string>('')
  const [attendCourseId, setAttendCourseId] = useState<string>('')
  const [attendSaving, setAttendSaving] = useState(false)
  const [attendError, setAttendError] = useState<string|null>(null)
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<number|null>(null)
  // editar periodo de matrícula
  const [showEdit, setShowEdit] = useState(false)
  const [editEnrollmentId, setEditEnrollmentId] = useState<number|null>(null)
  const [editStartDate, setEditStartDate] = useState<string>('')
  const [editEndDate, setEditEndDate] = useState<string>('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string|null>(null)
  const [editMethod, setEditMethod] = useState<string>('')
  const [editAmount, setEditAmount] = useState<string>('')
  const [editPaymentId, setEditPaymentId] = useState<number|null>(null)
  const [editMode, setEditMode] = useState<'edit' | 'renew'>('edit')
  const [editCourseDay, setEditCourseDay] = useState<number|null>(null) // 0=Lun..6=Dom
  const [editOccurrences, setEditOccurrences] = useState<number>(4)

  // cargar portal
  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true); setError(null)
      try{
        const portalRes = await api.get(`/api/pms/students/${id}/portal`)
        setData(portalRes.data)
        // Enriquecer con profesores desde cursos
        try{
          const cres = await api.get('/api/pms/courses', { params: { limit: 500, offset: 0 } })
          const items = cres.data?.items ?? (Array.isArray(cres.data) ? cres.data : [])
          const tMap: Record<number, string> = {}
          const cMap: Record<number, { name?: string; teacher?: string; image?: string }> = {}
          for (const c of items) {
            if (c.id != null) {
              if (c.teacher_name) tMap[c.id] = c.teacher_name
              cMap[c.id] = { name: c.name, teacher: c.teacher_name, image: c.image_url }
            }
          }
          setCourseTeacherMap(tMap)
          setCourseCatalog(cMap)
        }catch{}
      }catch(e:any){ setError(e?.message || 'No se pudo cargar alumno') }
      finally{ setLoading(false) }
    }
    load()
  }, [id])

  // calendario
  const fetchCalendar = async () => {
    if (!id) return
    setCalLoading(true)
    try{
      const res = await api.get(`/api/pms/students/${id}/attendance_calendar`, { params: { year: calYear, month: calMonth } })
      setCalDays(res.data?.days ?? [])
    } finally{ setCalLoading(false) }
  }
  useEffect(() => { fetchCalendar() }, [id, calYear, calMonth])
  const attendedThisMonth = useMemo(() => (calDays || []).filter(d => d.attended).length, [calDays])
  const expectedThisMonth = useMemo(() => (calDays || []).filter(d => d.expected).length, [calDays])
  const fmtCLP = useMemo(() => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }), [])
  const joinedAt = data?.student?.joined_at ? new Date(data.student.joined_at) : null
  const joinedAtLabel = data?.student?.joined_at ? ymdToCL(data.student.joined_at) : '-'
  const yearsSinceJoin = useMemo(() => {
    if (!joinedAt) return 0
    const now = new Date()
    let years = now.getFullYear() - joinedAt.getFullYear()
    const hasNotReached = (now.getMonth() < joinedAt.getMonth()) || (now.getMonth() === joinedAt.getMonth() && now.getDate() < joinedAt.getDate())
    if (hasNotReached) years -= 1
    return Math.max(0, years)
  }, [joinedAt])
  const daysToOneYear = useMemo(() => {
    if (!joinedAt) return null
    const oneYear = new Date(joinedAt)
    oneYear.setFullYear(oneYear.getFullYear() + 1)
    const todayMid = new Date()
    todayMid.setHours(0,0,0,0)
    const diffMs = oneYear.getTime() - todayMid.getTime()
    return Math.ceil(diffMs / (1000*60*60*24))
  }, [joinedAt])

  // Dedup: quedarnos con la matrícula más reciente por curso
  const uniqueEnrollments = useMemo(() => {
    const list = data?.enrollments || []
    const byCourse = new Map<number, typeof list>()
    list.forEach(e => {
      const arr = byCourse.get(e.course.id) || []
      arr.push(e)
      byCourse.set(e.course.id, arr)
    })
    const dedup: typeof list = []
    for (const arr of byCourse.values()) {
      arr.sort((a,b) => {
        const aEnd = a.end_date || a.start_date || ''
        const bEnd = b.end_date || b.start_date || ''
        if (aEnd !== bEnd) return bEnd.localeCompare(aEnd) // más reciente primero
        return (b.start_date || '').localeCompare(a.start_date || '')
      })
      dedup.push(arr[0])
    }
    return dedup
  }, [data?.enrollments])

  // horario semanal (0=Lun..6=Dom)
  const schedule = useMemo(() => {
    const map = new Map<number, any[]>()
    for (let i = 0; i < 7; i++) map.set(i, [])
    for (const e of uniqueEnrollments) {
      const idx = (e.course.day_of_week ?? 0)
      if (idx >= 0 && idx <= 6) map.get(idx)!.push(e)
    }
    return map
  }, [uniqueEnrollments])

  // Stats de asistencia por curso (enrollment)
  const [courseStats, setCourseStats] = useState<Record<number, { expected:number; attended:number; extraOutside:number }>>({})
  const [payPage, setPayPage] = useState(1)
  const [payPageSize, setPayPageSize] = useState(10)
  useEffect(() => {
    (async () => {
      try{
        if(!id || !(uniqueEnrollments.length)) return
        const next: Record<number, { expected:number; attended:number; extraOutside:number }> = {}
        const maxYMD = (...dates: string[]) => dates.filter(Boolean).sort().slice(-1)[0] || ''
        const futureHorizon = toYMDInTZ(new Date(new Date().setMonth(new Date().getMonth() + 6)), CL_TZ)
        for (const e of uniqueEnrollments) {
          const start = e.start_date || ''
          const end   = e.end_date   || ''
          if (!start || !end) continue
          const courseId = e.course.id
          let attended = 0
          let expected = 0
          let extraOutside = 0
          const endOfShownMonth = toYMDInTZ(new Date(calYear, calMonth, 0), CL_TZ)
          const latest = maxYMD(todayYMD, end, endOfShownMonth, futureHorizon)
          const months = monthsInRange(start.slice(0,7) + '-01', latest.slice(0,7) + '-01')
          const monthRequests = months.map(mm =>
            api.get(`/api/pms/students/${id}/attendance_calendar`, { params: { year: mm.year, month: mm.month } })
              .then(res => res.data?.days || [])
              .catch(() => [])
          )
          const monthsDays = await Promise.all(monthRequests)
          for (const days of monthsDays) {
              for (const d of days as { date: string; attended_course_ids?: number[]; expected_course_ids?: number[] }[]) {
                if (d.date >= start && d.date <= latest) {
                  const attendedHere = (d.attended_course_ids || []).includes(courseId)
                  if (attendedHere) attended++
                  if (d.date <= end && (d.expected_course_ids || []).includes(courseId)) expected++
                  if (attendedHere && d.date > end) extraOutside++
                }
              }
            }
          next[e.id] = { expected, attended, extraOutside }
        }
        setCourseStats(next)
      }catch{}
    })()
  }, [id, uniqueEnrollments, todayYMD])

  const courseNameById = useMemo(() => {
    const m = new Map<number, string>()
    ;(data?.enrollments || []).forEach(e => m.set(e.course.id, e.course.name))
    return m
  }, [data?.enrollments])
  const currentEnrollment = useMemo(() => {
    if (!editEnrollmentId) return null
    return (data?.enrollments || []).find(e => e.id === editEnrollmentId) || null
  }, [data?.enrollments, editEnrollmentId])
  const currentDayOfWeek = useMemo(() => {
    return editCourseDay ?? currentEnrollment?.course.day_of_week ?? null
  }, [editCourseDay, currentEnrollment])

  const addDays = (ymd: string, days: number) => {
    const [y,m,d] = ymd.split('-').map(Number)
    const dt = new Date(y, (m||1)-1, d||1)
    dt.setDate(dt.getDate() + days)
    return toYMDInTZ(dt, CL_TZ)
  }
  const diffDays = (start?: string|null, end?: string|null) => {
    if (!start || !end) return 0
    const [sy,sm,sd] = start.split('-').map(Number)
    const [ey,em,ed] = end.split('-').map(Number)
    const a = new Date(sy, (sm||1)-1, sd||1)
    const b = new Date(ey, (em||1)-1, ed||1)
    const ms = b.getTime() - a.getTime()
    return Math.max(0, Math.round(ms / (1000*60*60*24)))
  }
  const alignToWeekday = (startYMD: string, mon0?: number|null) => {
    if (mon0 == null) return startYMD
    const [y,m,d] = startYMD.split('-').map(Number)
    const dt = new Date(y, (m||1)-1, d||1)
    const cur = (dt.getDay() + 6) % 7 // 0=Lun..6=Dom
    const delta = (mon0 - cur + 7) % 7
    if (delta === 0) return startYMD
    return addDays(startYMD, delta)
  }
  const computeEndByOccurrences = (startYMD: string, mon0: number|null, occurrences: number) => {
    if (!mon0 || occurrences <= 1) return startYMD
    let count = 1
    const [sy, sm, sd] = startYMD.split('-').map(Number)
    let dt = new Date(sy, (sm||1)-1, sd||1)
    while (count < occurrences) {
      dt.setDate(dt.getDate() + 1)
      const cur = (dt.getDay() + 6) % 7
      if (cur === mon0) count++
    }
    return toYMDInTZ(dt, CL_TZ)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
                {data ? `${data.student.first_name} ${data.student.last_name}` : 'Alumno'}
              </h1>
              <div className="text-sm/relaxed opacity-90">{data?.student.email ?? '-'}</div>
              <div className="text-sm flex items-center gap-2 opacity-90">
                <span className="inline-flex items-center gap-1">
                  <span>📅</span>
                  <span>Ingreso: {joinedAtLabel}</span>
                </span>
                {yearsSinceJoin >= 1 && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold shadow-sm border border-amber-200">
                    🎉 ¡{yearsSinceJoin} año{yearsSinceJoin>1?'s':''} con nosotros!
                  </span>
                )}
                {yearsSinceJoin === 0 && daysToOneYear !== null && daysToOneYear > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 text-white text-xs">
                    ⏳ Te faltan {daysToOneYear} día{daysToOneYear>1?'s':''} para 1 año
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-white/10 hover:bg-white/20" onClick={() => { if(id){ api.get(`/api/pms/students/${id}/portal`).then(r=>setData(r.data)).finally(()=>fetchCalendar()) } }} title="Actualizar datos">Actualizar</button>
              <Link to="/students" className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-white/10 hover:bg-white/20">Volver</Link>
            </div>
          </div>
        </div>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Métricas generales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-lg">✅</span>
                <span>Asistencia (mes actual)</span>
              </div>
              <div className="text-3xl font-semibold text-gray-900">{attendedThisMonth} / {expectedThisMonth || 0}</div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded overflow-hidden">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.min(100, (attendedThisMonth/Math.max(1, expectedThisMonth))*100)}%` }} />
              </div>
            </div>
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-sky-50 text-sky-700 text-lg">📚</span>
                <span>Clases activas</span>
              </div>
              <div className="text-3xl font-semibold text-gray-900">{data.classes_active}</div>
              <div className="text-xs text-gray-500 mt-1">Clases semanales</div>
            </div>
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-amber-50 text-amber-700 text-lg">💰</span>
                <span>Total pagado (90 días)</span>
              </div>
              <div className="text-3xl font-semibold text-gray-900">{new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }).format(Number(data.payments.total_last_90 || 0))}</div>
              <div className="text-xs text-gray-500 mt-1">Últimos pagos</div>
            </div>
          </div>

          {/* Mis cursos */}
          <div className="grid grid-cols-1 gap-4">

            <div className="rounded-2xl border p-4 bg-gradient-to-b from-gray-50 to-white">
              <div className="text-lg font-medium mb-3">Mis cursos</div>
              <div className="space-y-3">
                  {(uniqueEnrollments ?? []).map((e)=> {
                    const attended = (courseStats[e.id]?.attended ?? 0)
                    const expected = (courseStats[e.id]?.expected ?? 0)
                    const extraOutside = (courseStats[e.id]?.extraOutside ?? 0)
                    const over = attended > expected
                    const extra = over ? attended - expected : extraOutside
                    const completed = expected > 0 && attended >= expected
                    const progress = expected > 0 ? Math.min(100, (attended / expected) * 100) : 0
                    const payStatus = (e as any).payment_status?.toString().toLowerCase?.() || ''
                    const hasPaymentsForEnroll = (data?.payments?.recent || []).some(p => p.enrollment_id === e.id)
                    const hasPaymentsForCourse = (data?.payments?.recent || []).some(p => p.course_id === e.course.id)
                    const isPending = payStatus ? payStatus !== 'activo' : !(hasPaymentsForEnroll || hasPaymentsForCourse)
                    const endYMD = e.end_date || ''
                    const isPastPeriod = endYMD ? todayYMD > endYMD : false
                    let statusLabel = 'Inscrito'
                    let statusClass = 'bg-sky-50 text-sky-700 border-sky-200'
                    if (isPending) {
                      statusLabel = 'Pendiente de pago'
                      statusClass = 'bg-rose-50 text-rose-700 border-rose-200'
                    } else if (isPastPeriod) {
                      statusLabel = 'Pendiente de renovación'
                      statusClass = 'bg-amber-50 text-amber-700 border-amber-200'
                    } else if (completed) {
                      statusLabel = 'Completado'
                      statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    } else if (!e.is_active) {
                      statusLabel = 'Inactivo'
                      statusClass = 'bg-gray-100 text-gray-600 border-gray-200'
                    }
                    return (
                    <div key={e.id} className="p-3 rounded-xl border bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-lg font-semibold text-gray-900">{e.course.name}</div>
                        <div className="shrink-0 flex items-center gap-2">
                        <button
                          className="px-2 py-1 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 text-xs"
                          title="Renovar periodo"
                          onClick={() => {
                            setEditMode('renew')
                            setEditEnrollmentId(e.id)
                            setEditCourseDay(e.course.day_of_week ?? null)
                            // ocurrencias del periodo anterior para replicar plan (clases/semana)
                            let occ = 4
                            if (e.start_date && e.end_date) {
                              const c = countWeekdayOccurrencesInRange(e.course.day_of_week ?? 0, e.start_date, e.end_date)
                              occ = Math.max(1, c)
                            }
                            setEditOccurrences(occ)
                            const baseStart = e.end_date ? addDays(e.end_date, 1) : toYMDInTZ(new Date(), CL_TZ)
                            const alignedStart = alignToWeekday(baseStart, e.course.day_of_week ?? null)
                            const baseEnd = computeEndByOccurrences(alignedStart, e.course.day_of_week ?? null, occ)
                            setEditStartDate(alignedStart)
                            setEditEndDate(baseEnd)
                            setEditError(null)
                            const all = (data?.payments?.recent || []) as any[]
                            const byEnroll = all.find(p => p.type === 'monthly' && (p.enrollment_id === e.id))
                            const byCourse = all.find(p => p.type === 'monthly' && (p.course_id === e.course.id))
                            const byDate = all.find(p => p.type === 'monthly' && p.payment_date && (
                              (!e.start_date || p.payment_date >= e.start_date) && (!e.end_date || p.payment_date <= e.end_date)
                            ))
                            const target = byEnroll || byCourse || byDate || null
                            setEditPaymentId(null) // en renovación siempre crear nuevo pago
                            setEditAmount(target?.amount != null ? String(target.amount) : '')
                            setEditMethod(target?.method || '')
                            setShowEdit(true)
                        }}
                      >
                          Renovar
                        </button>
                        <button
                          className="px-2 py-1 rounded-md text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-xs"
                          title="Editar periodo"
                          onClick={() => {
                            setEditMode('edit')
                            setEditEnrollmentId(e.id)
                            setEditCourseDay(e.course.day_of_week ?? null)
                            let occ = 4
                            if (e.start_date && e.end_date) {
                              const c = countWeekdayOccurrencesInRange(e.course.day_of_week ?? 0, e.start_date, e.end_date)
                              occ = Math.max(1, c)
                            }
                            setEditOccurrences(occ)
                            setEditStartDate(e.start_date || '')
                            setEditEndDate(e.end_date || '')
                            setEditError(null)
                            // detectar pago mensual asociado para prefijar monto/método
                            const all = (data?.payments?.recent || []) as any[]
                            const byEnroll = all.find(p => p.type === 'monthly' && (p.enrollment_id === e.id))
                            const byCourse = all.find(p => p.type === 'monthly' && (p.course_id === e.course.id))
                            const byDate = all.find(p => p.type === 'monthly' && p.payment_date && (
                              (!e.start_date || p.payment_date >= e.start_date) && (!e.end_date || p.payment_date <= e.end_date)
                            ))
                            const target = byEnroll || byCourse || byDate || null
                            setEditPaymentId(target?.id ?? null)
                            setEditAmount(target?.amount != null ? String(target.amount) : '')
                            setEditMethod(target?.method || '')
                            setShowEdit(true)
                          }}
                        >Editar</button>
                        <button
                          className="px-2 py-1 rounded-md text-white bg-rose-600 hover:bg-rose-700 text-xs disabled:opacity-60"
                          title="Eliminar curso"
                          disabled={deletingEnrollmentId === e.id}
                          onClick={async ()=>{
                            if(!confirm('¿Eliminar este curso? Esta acción no se puede deshacer.')) return
                            try{
                              setDeletingEnrollmentId(e.id)
                              await api.delete(`/api/pms/enrollments/${e.id}`)
                              // refrescar datos
                              if(id){ const res = await api.get(`/api/pms/students/${id}/portal`); setData(res.data) }
                              await fetchCalendar()
                            }catch(err:any){ alert(err?.message || 'No se pudo eliminar el curso') }
                            finally{ setDeletingEnrollmentId(null) }
                          }}
                        >Eliminar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-700 mt-2">
                      <div>
                        <div className="text-gray-500 text-xs">Horario</div>
                        <div>
                          {[
                            DAY_NAMES_MON_FIRST[(e.course.day_of_week ?? 0)],
                            (e.course.start_time||'').slice(0,5),
                            e.course.end_time ? ` - ${(e.course.end_time||'').slice(0,5)}` : ''
                          ].filter(Boolean).join(' ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Estado</div>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${statusClass}`}>
                              {statusLabel}
                            </span>
                            {completed && <span className="text-xs text-emerald-700 font-semibold">({attended}/{expected})</span>}
                          </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Periodo</div>
                        <div>{e.start_date ? ymdToCL(e.start_date) : '-'} {e.end_date ? `a ${ymdToCL(e.end_date)}` : ''}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Asistencias</div>
                        <div className={over ? 'text-rose-600 font-semibold' : 'text-gray-800'}>
                          {attended} / {expected}
                        </div>
                        {over && extra > 0 && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[11px] mt-0.5">
                            <span className="font-semibold">{extra}</span>
                            <span>clase{extra > 1 ? 's' : ''} extra fuera del plan</span>
                          </div>
                        )}
                        <div className="mt-1 h-1.5 bg-gray-100 rounded overflow-hidden">
                          <div
                            className={`h-1.5 ${completed ? 'bg-emerald-500' : over ? 'bg-amber-500' : 'bg-indigo-400'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-amber-300 border border-amber-500 rounded"></span> Extra (no esperado)
              </div>
            </div>
          </div>

          {/* Modal: Editar periodo de matrícula */}
          {showEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={()=>setShowEdit(false)} />
              <div className="relative z-10 bg-white rounded-2xl shadow-xl w-[95%] max-w-lg p-4">
                <div className="text-lg font-semibold">{editMode === 'renew' ? 'Renovar curso' : 'Editar periodo'}</div>
                <div className="text-sm text-gray-700">
                  {editMode === 'renew'
                    ? 'Confirma las nuevas fechas sugeridas y el pago para renovar este curso.'
                    : 'Actualiza fechas de inicio y fin.'}
                </div>

                {currentEnrollment && (
                  <div className="mt-3 p-3 rounded-xl border bg-gradient-to-r from-indigo-50 via-white to-sky-50 text-sm text-gray-800 shadow-sm">
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-white border border-indigo-100 text-indigo-600 text-sm">📘</span>
                      <span>{currentEnrollment.course.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-700">
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 shadow-inner">
                        <span className="text-amber-600">📅</span>
                        <span className="text-gray-500">Anterior:</span>
                        <span className="font-semibold text-gray-900">
                          {currentEnrollment.start_date ? ymdToCL(currentEnrollment.start_date) : '-'}
                          {currentEnrollment.end_date ? ` a ${ymdToCL(currentEnrollment.end_date)}` : ''}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 shadow-inner">
                        <span className="text-blue-600">📆</span>
                        <span className="text-gray-500">Día:</span>
                        <span className="font-semibold text-gray-900">
                          {DAY_NAMES_MON_FIRST[(currentEnrollment.course.day_of_week ?? 0)]}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 shadow-inner">
                        <span className="text-emerald-600">⏰</span>
                        <span className="text-gray-500">Horario:</span>
                        <span className="font-semibold text-gray-900">
                          {(currentEnrollment.course.start_time || '').slice(0,5)}
                          {currentEnrollment.course.end_time ? ` - ${(currentEnrollment.course.end_time||'').slice(0,5)}` : ''}
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100"
                    onClick={() => {
                      const day = currentDayOfWeek ?? 0
                      const occ = editOccurrences || (currentEnrollment && currentEnrollment.start_date && currentEnrollment.end_date
                        ? Math.max(1, countWeekdayOccurrencesInRange(day, currentEnrollment.start_date, currentEnrollment.end_date))
                        : 4)
                      const rawStart = editStartDate || toYMDInTZ(new Date(), CL_TZ)
                      const start = alignToWeekday(rawStart, day)
                      setEditStartDate(start)
                      const end = computeEndByOccurrences(start, day, occ)
                      setEditEndDate(end)
                      if (!editMethod) setEditMethod('transfer')
                      // Mantener monto previo si existe; de lo contrario se respeta el que viene precargado del pago
                    }}
                  >
                    Atajo: 1 mes
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border bg-gray-50 hover:bg-gray-100"
                    onClick={() => {
                      const day = currentDayOfWeek ?? 0
                      const rawStart = editStartDate || toYMDInTZ(new Date(), CL_TZ)
                      const start = alignToWeekday(rawStart, day)
                      setEditStartDate(start)
                      setEditEndDate(start)
                      if (!editMethod) setEditMethod('cash')
                      setEditAmount('7000')
                    }}
                  >
                    Atajo: Clase suelta
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Inicio</div>
                    <input type="date" className="w-full border rounded px-3 py-2" value={editStartDate} onChange={e=>setEditStartDate(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Fin</div>
                    <input type="date" className="w-full border rounded px-3 py-2" value={editEndDate} onChange={e=>setEditEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Método de pago</div>
                    <select
                      className="w-full border rounded px-3 py-2 bg-white"
                      value={editMethod}
                      onChange={e=>setEditMethod(e.target.value)}
                    >
                      <option value="">Selecciona método</option>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta/Débito</option>
                      <option value="transfer">Transferencia</option>
                      <option value="agreement">Convenio</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Monto</div>
                    <input type="number" className="w-full border rounded px-3 py-2" placeholder="25000" value={editAmount} onChange={e=>setEditAmount(e.target.value)} />
                  </div>
                </div>

                {editError && <div className="mt-2 text-sm text-rose-700">{editError}</div>}

                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-2 rounded-lg border" onClick={()=>setShowEdit(false)} disabled={editSaving}>Cancelar</button>
                  <button
                    className="px-3 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                    disabled={editSaving || !editEnrollmentId}
                    onClick={async()=>{
                      try{
                        if(!editEnrollmentId) return
                        setEditSaving(true); setEditError(null)
                        await api.put(`/api/pms/enrollments/${editEnrollmentId}`, {
                          start_date: editStartDate || null,
                          end_date: editEndDate || null,
                        })
                        const paymentsRecent = (data?.payments?.recent || []) as any[]
                        const todayYMD = toYMDInTZ(new Date(), CL_TZ)
                        const periodLabel = `${editStartDate ? ymdToCL(editStartDate) : ''}${editEndDate ? ` a ${ymdToCL(editEndDate)}` : ''}`
                        if (editPaymentId) {
                          const existing = paymentsRecent.find(p => p.id === editPaymentId)
                          await api.put(`/api/pms/payments/${editPaymentId}`, {
                            student_id: id ? Number(id) : undefined,
                            course_id: existing?.course_id ?? currentEnrollment?.course?.id,
                            enrollment_id: existing?.enrollment_id ?? editEnrollmentId,
                            amount: Number(editAmount || 0),
                            method: editMethod || existing?.method || 'transfer',
                            type: existing?.type || 'monthly',
                            payment_date: existing?.payment_date || todayYMD,
                            reference: existing?.reference || periodLabel || undefined,
                          })
                        } else if (editMode === 'renew') {
                          // Crear pago de renovación si no existía
                          await api.post('/api/pms/payments', {
                            student_id: id ? Number(id) : undefined,
                            course_id: currentEnrollment?.course?.id,
                            enrollment_id: editEnrollmentId,
                            amount: Number(editAmount || 0),
                            method: editMethod || 'transfer',
                            type: 'monthly',
                            payment_date: todayYMD,
                            reference: periodLabel || undefined,
                          })
                        }
                        // refrescar portal e historial (periodo
                        if(id){ const res = await api.get(`/api/pms/students/${id}/portal`); setData(res.data) }
                        await fetchCalendar()
                        setShowEdit(false)
                      }catch(e:any){ setEditError(e?.message || 'No se pudo guardar') } finally { setEditSaving(false) }
                    }}
                  >Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* Calendario de asistencia */}
          <div className="rounded-2xl border p-4 bg-gradient-to-b from-purple-50 to-white">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-medium">Asistencia por mes</div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 rounded-lg text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700" onClick={()=>{ const m = calMonth-1; if(m<1){ setCalMonth(12); setCalYear(y=>y-1) } else { setCalMonth(m) } }} aria-label="Mes anterior">&lt;</button>
                <div className="text-sm text-gray-700 w-28 text-center">{new Date(calYear, calMonth-1, 1).toLocaleDateString('es-CL', { month:'long', year:'numeric' })}</div>
                <button className="px-2 py-1 rounded-lg text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700" onClick={()=>{ const m = calMonth+1; if(m>12){ setCalMonth(1); setCalYear(y=>y+1) } else { setCalMonth(m) } }} aria-label="Mes siguiente">&gt;</button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs text-gray-600 mb-1">
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
                <div key={d} className="text-center py-1">{d}</div>
              ))}
            </div>

            {calLoading ? (
              <div className="text-sm text-gray-500">Cargando calendario...</div>
            ) : (
              (() => {
                const first = new Date(calYear, calMonth-1, 1)
                const offset = first.getDay()
                const boxes:any[] = []
                for(let i=0;i<offset;i++) boxes.push(<div key={'b'+i} className="p-3" />)

                const daysInMonth = new Date(calYear, calMonth, 0).getDate()
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = toYMDInTZ(new Date(calYear, calMonth - 1, d), CL_TZ)
                  const rec = calDays.find(x => x.date === dateStr)
                  const expected = !!rec?.expected
                  const attended = !!rec?.attended
                  const expectedIds = (rec?.expected_course_ids ?? []) as number[]
                  const attendedIds = (rec?.attended_course_ids ?? []) as number[]
                  const extraIds = attendedIds.filter(id => !expectedIds.includes(id))
                  const hasExtra = attended && (extraIds.length > 0 || (expectedIds.length === 0 && attendedIds.length > 0))
                  const dayName = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(dateStr).getDay()]
                  const courseIdsForDay = expectedIds.length ? expectedIds : attendedIds
                  const uniqueCourseIds = Array.from(new Set(courseIdsForDay))
                  const courseNames = uniqueCourseIds.map(id => courseNameById.get(id)).filter(Boolean)
                  const mainCourse = courseNames[0]
                  const extraCourses = Math.max(0, courseNames.length - 1)

                  let cls = 'border bg-white'
                  if (hasExtra) cls = 'bg-amber-100 border border-amber-300'
                  else if (attended) cls = 'bg-green-100 border border-green-300'
                  else if (expected && !attended) cls = 'bg-red-100 border border-red-300'

                  boxes.push(
                    <button
                      key={dateStr}
                      type="button"
                      className={`p-2 rounded relative text-left ${cls} ${expected ? 'hover:ring-2 hover:ring-emerald-200' : ''}`}
                      onClick={async () => {
                        try {
                          if (!id || !data) return
                          const rec = calDays.find(x => x.date === dateStr)
                          const expectedIds = (rec?.expected_course_ids ?? []) as number[]
                          const attendedIds = (rec?.attended_course_ids ?? []) as number[]

                          if ((attendedIds?.length || 0) === 1) {
                            const cid = attendedIds[0]
                            setAttendError(null)
                            setAttendDate(dateStr)
                            setAttendCourseId(String(cid))
                            setShowAttend(true)
                            return
                          }
                          if ((expectedIds?.length || 0) === 1 && !attended) {
                            const cid = expectedIds[0]
                            await api.post('/api/pms/attendance', { student_id: Number(id), course_id: cid, date: dateStr })
                            await fetchCalendar()
                            return
                          }

                          setAttendError(null)
                          setAttendDate(dateStr)
                          const dt = new Date(dateStr)
                          const mon0 = (dt.getDay() + 6) % 7 // 0=Lun..6=Dom
                          let candidates = (data.enrollments||[]).filter(e => {
                            const within = (!e.start_date || dateStr >= e.start_date) && (!e.end_date || dateStr <= e.end_date)
                            return (e.course.day_of_week ?? -1) === mon0 && within
                          })
                          if (candidates.length === 0) candidates = (data.enrollments||[])
                          const firstId = candidates[0]?.course?.id
                          setAttendCourseId(firstId ? String(firstId) : '')
                          setShowAttend(true)
                        } catch (e:any) {
                          alert(e?.message || 'No se pudo actualizar asistencia')
                        }
                      }}
                      title={(function(){
                        const base = attended ? 'Click para ajustar asistencia' : (expected ? 'Click para marcar asistencia' : 'Click para gestionar asistencia')
                        if (extraIds.length > 0) {
                          const idToName = new Map((data?.enrollments||[]).map((e:any)=>[e.course.id, e.course.name]))
                          const names = extraIds.map(id => idToName.get(id) || `Curso ${id}`)
                          return `${base} — Extra: ${names.join(', ')}`
                        }
                        return base
                      })()}
                      >
                      <div className="flex items-center justify-between text-[11px] text-gray-700">
                        <span className="font-semibold">{d}</span>
                        <span className="text-[10px] text-gray-500">{dayName}</span>
                      </div>
                      {mainCourse && (
                        <div className="mt-1 text-[10px] text-gray-600 truncate flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-indigo-400"></span>
                          <span className="font-semibold text-gray-800 truncate">{mainCourse}</span>
                          {extraCourses > 0 && <span className="text-gray-400">+{extraCourses}</span>}
                        </div>
                      )}
                      {attended && (
                        <div className={`absolute bottom-1 right-1 text-[10px] leading-none font-bold ${hasExtra ? 'text-amber-700' : 'text-green-800'}`}>V</div>
                      )}
                    </button>
                  )
                }
                return <div className="grid grid-cols-7 gap-1">{boxes}</div>
              })()
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-green-300 border border-green-500 rounded"></span> Asistió <span className="ml-1 text-[10px] font-bold text-green-800">V</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-red-300 border border-red-500 rounded"></span> No asistió
              </div>
            </div>
          </div>

          {/* Historial de pagos (agrupado) */}
          {(data.payments?.recent?.length ?? 0) > 0 && (
            <div className="rounded-2xl border p-4 bg-white">
              <div className="text-lg font-medium mb-2">Historial de pagos (agrupado)</div>
              {(() => {
                const all = [...(data.payments?.recent || [])]
                const sortFn = (a:any,b:any) => (b.payment_date||'').localeCompare(a.payment_date||'')
                const monthly = all.filter(p => p.type === 'monthly').sort(sortFn)
                const single  = all.filter(p => p.type === 'single_class').sort(sortFn)
                const others  = all.filter(p => p.type !== 'monthly' && p.type !== 'single_class').sort(sortFn)
                const Badge = ({ text, color }:{text:string; color:'emerald'|'sky'|'amber'|'indigo'|'gray'}) => {
                  const map:any = {
                    emerald:'bg-emerald-50 text-emerald-600 border-emerald-100',
                    sky:'bg-sky-50 text-sky-600 border-sky-100',
                    amber:'bg-amber-50 text-amber-600 border-amber-100',
                    indigo:'bg-indigo-50 text-indigo-600 border-indigo-100',
                    gray:'bg-gray-50 text-gray-700 border-gray-100',
                  }
                  return <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${map[color] || map.gray}`}>{text}</span>
                }
                const MethodBadge = (m?:string) => {
                  if (m === 'cash') return <Badge text="Efectivo" color="emerald" />
                  if (m === 'card') return <Badge text="Tarjeta" color="sky" />
                  if (m === 'transfer') return <Badge text="Transferencia" color="amber" />
                  if (m === 'agreement') return <Badge text="Convenio" color="indigo" />
                  return <Badge text={m || '-'} color="gray" />
                }

                const Table = ({rows, getRowClass}:{rows:any[], getRowClass?:(p:any)=>string}) => (
                  <div className="overflow-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-white to-gray-50 text-left border-b border-gray-100">
                        <tr className="text-gray-700">
                          <th className="px-3 py-3 font-semibold">Fecha</th>
                          <th className="px-3 py-3 font-semibold">Curso</th>
                          <th className="px-3 py-3 font-semibold">Profesor</th>
                          <th className="px-3 py-3 font-semibold">Periodo</th>
                          <th className="px-3 py-3 font-semibold">Tipo</th>
                          <th className="px-3 py-3 font-semibold">Método</th>
                          <th className="px-3 py-3 font-semibold text-right">Monto</th>
                          <th className="px-3 py-3 font-semibold">Referencia</th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:nth-child(even)]:bg-gray-50">
                        {rows.map((p:any) => {
                          const info = resolvePaymentCourseInfo(p, data?.enrollments, courseTeacherMap, courseCatalog)
                          return (
                            <tr key={p.id} className={`border-t ${getRowClass ? getRowClass(p) : ''}`}>
                              <td className="px-3 py-3 text-gray-800">{p.payment_date ? ymdToCL(p.payment_date) : '-'}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2 text-gray-800 font-medium">
                                  {info.image ? (
                                    <img src={toAbsoluteUrl(info.image)} alt={info.course || 'Curso'} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                                  ) : (
                                    <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-700 text-sm shadow-inner">📘</span>
                                  )}
                                  <span className="truncate">{info.course || '-'}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-gray-700">{info.teacher || '-'}</td>
                              <td className="px-3 py-3 text-gray-700">{buildPaymentPeriod(p, data?.enrollments)}</td>
                              <td className="px-3 py-3 text-gray-700">
                                {p.type === 'monthly'
                                  ? <Badge text="Mensualidad" color="indigo" />
                                  : p.type === 'single_class'
                                    ? <Badge text="Clase suelta" color="sky" />
                                    : <Badge text={p.type || '-'} color="gray" />}
                              </td>
                              <td className="px-3 py-3 text-gray-700">{MethodBadge(p.method)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-900">{fmtCLP.format(Number(p.amount||0))}</td>
                              <td className="px-3 py-3 text-gray-700">{p.reference || '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
                return (
                  <div className="space-y-3">
                    {monthly.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 my-1">
                          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Mensualidad</div>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Table rows={monthly} getRowClass={() => ''} />
                      </div>
                    )}
                    {single.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 my-1">
                          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Clases sueltas</div>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Table rows={single} getRowClass={() => 'bg-yellow-50'} />
                      </div>
                    )}
                    {others.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 my-1">
                          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Otros</div>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Table rows={others} getRowClass={(p:any) => (p.type === 'normal' || p.type === 'coreografia') ? 'bg-gradient-to-r from-fuchsia-50 to-purple-50' : ''} />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          

          {/* Modal asistencia */}
          {showAttend && data && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={()=>setShowAttend(false)} />
              <div className="relative z-10 bg-white rounded-2xl shadow-xl w-[95%] max-w-lg p-4">
                <div className="text-lg font-semibold">Ajustar asistencia</div>
                <div className="text-sm text-gray-700">Fecha: {ymdToCL(attendDate)}</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Curso</div>
                    <select className="w-full border rounded px-3 py-2" value={attendCourseId} onChange={e=>setAttendCourseId(e.target.value)}>
                      <option value="">Seleccione curso</option>
                      {(() => {
                        const base = (data.enrollments||[]).filter(e=>{
                          if(!attendDate) return true
                          const dt = new Date(attendDate)
                          const mon0 = (dt.getDay() + 6) % 7
                          const within = (!e.start_date || attendDate >= e.start_date) && (!e.end_date || attendDate <= e.end_date)
                          return (e.course.day_of_week ?? -1) === mon0 && within
                        })
                        const list = base.length ? base : (data.enrollments||[])
                        const uniqueByCourse = Array.from(new Map(list.map(e => [e.course.id, e])).values())
                        return uniqueByCourse.map(e => (
                          <option key={e.id} value={String(e.course.id)}>{e.course.name}</option>
                        ))
                      })()}
                    </select>
                  </div>
                  <div className="text-xs text-gray-600">Seleccione un curso para esta fecha y use las acciones para marcar o quitar la asistencia.</div>
                </div>

                {attendError && <div className="mt-2 text-sm text-rose-700">{attendError}</div>}

                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-2 rounded-lg border" onClick={()=>setShowAttend(false)} disabled={attendSaving}>Cerrar</button>
                  <button className="px-3 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60" disabled={attendSaving || !attendCourseId}
                    onClick={async()=>{
                      try{
                        setAttendSaving(true); setAttendError(null)
                        if(!id) throw new Error('Sin alumno')
                        await api.post('/api/pms/attendance', { student_id: Number(id), course_id: Number(attendCourseId), date: attendDate })
                        await fetchCalendar(); setShowAttend(false)
                      }catch(e:any){ setAttendError(e?.message||'No se pudo marcar') } finally { setAttendSaving(false) }
                    }}
                  >Marcar presente</button>
                  <button className="px-3 py-2 rounded-lg text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60" disabled={attendSaving || !attendCourseId}
                    onClick={async()=>{
                      try{
                        setAttendSaving(true); setAttendError(null)
                        if(!id) throw new Error('Sin alumno')
                        await api.delete('/api/pms/attendance', { params: { student_id: Number(id), course_id: Number(attendCourseId), attended_date: attendDate } })
                        await fetchCalendar(); setShowAttend(false)
                      }catch(e:any){ setAttendError(e?.message||'No se pudo quitar') } finally { setAttendSaving(false) }
                    }}
                  >Quitar asistencia</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
