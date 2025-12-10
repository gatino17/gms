import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'

type Payment = {
  id: number
  course_id?: number | null
  student_id?: number | null
  amount: number
  method: 'cash'|'card'|'transfer'|string
  type?: 'monthly'|'single_class'|'rental'|'agreement'|string
  notes?: string | null
  payment_date: string // YYYY-MM-DD
}
type CourseRef = {
  id:number; name:string; teacher_name?: string | null
  classes_per_week?: number|null
  day_of_week?: number|null; start_time?: string|null; end_time?: string|null;
  day_of_week_2?: number|null; start_time_2?: string|null; end_time_2?: string|null;
  day_of_week_3?: number|null; start_time_3?: string|null; end_time_3?: string|null;
  day_of_week_4?: number|null; start_time_4?: string|null; end_time_4?: string|null;
  day_of_week_5?: number|null; start_time_5?: string|null; end_time_5?: string|null;
}
type StudentRef = { id:number; name:string }
type Enrollment = { id:number; student_id:number; course_id:number; start_date:string; end_date?:string|null; is_active:boolean }

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })

// ---------- Utilidades de fecha ----------
function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(d)
    .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function toDDMMYYYY(ymd?: string) {
  return ymd ? `${ymd.split('-')[2]}-${ymd.split('-')[1]}-${ymd.split('-')[0]}` : ''
}
function ymdInCL(d: Date) { return toYMDInTZ(d, CL_TZ) }
function daysInMonth(year:number, month0:number) { return new Date(year, month0 + 1, 0).getDate() }
function monthRangeFor(date = new Date()) {
  const y = date.getFullYear(); const m = date.getMonth()
  const start = new Date(y, m, 1); const end = new Date(y, m + 1, 0)
  return { start: ymdInCL(start), end: ymdInCL(end) }
}
function monthRangeOffset(offsetMonths = 0) {
  const ref = new Date(); ref.setMonth(ref.getMonth() + offsetMonths)
  return monthRangeFor(ref)
}
function nextMonthOf(yyyy_mm: string) {
  const [ys, ms] = yyyy_mm.split('-'); let y = +ys; let m = +ms; m += 1; if (m===13){m=1;y+=1}
  return `${y}-${String(m).padStart(2,'0')}`
}
function cycleFromMonth(yyyy_mm: string, anchorDay: number) {
  const [ys, ms] = yyyy_mm.split('-'); const y = +ys; const m = +ms
  const startDay = Math.min(anchorDay, daysInMonth(y, m-1))
  const start = `${y}-${String(m).padStart(2,'0')}-${String(startDay).padStart(2,'0')}`
  const next = nextMonthOf(yyyy_mm); const [nyS, nmS] = next.split('-'); const ny = +nyS; const nm = +nmS
  const endDay = Math.min(anchorDay-1, daysInMonth(ny, nm-1))
  const end = `${ny}-${String(nm).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`
  return { start, end }
}

// ---------- Helpers de encabezado ----------
function fmtMonthYear(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`)
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(d)
}
function fmtDayMonthYear(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`)
  return new Intl.DateTimeFormat('es-CL', { day:'2-digit', month:'short', year:'numeric' }).format(d)
}

function methodLabel(m:string) {
  return m==='cash'
    ? 'Efectivo'
    : m==='card'
      ? 'Tarjeta/Débito'
      : m==='transfer'
        ? 'Transferencia'
        : m==='agreement'
          ? 'Convenio'
          : m
}

// Detecta pagos que cuentan como "Convenio"
function isAgreementPayment(p: Payment): boolean {
  const notes = String(p.notes || '').toLowerCase()
  const typeStr = String(p.type || '').toLowerCase()
  const methodStr = String(p.method || '').toLowerCase()
  const hasConvenioWord = notes.includes('convenio') || typeStr.includes('convenio') || methodStr.includes('convenio')
  return hasConvenioWord || typeStr === 'agreement' || methodStr === 'agreement'
}

// ---------- Horario de curso ----------
const DN = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo']
function hhmm(t?: string|null) { return t ? String(t).slice(0,5) : '' }
function slotToText(d?: number|null, a?: string|null, b?: string|null) {
  if (d == null || a == null || b == null || a === '' || b === '') return ''
  const di = Math.max(0, Math.min(6, Number(d)))
  return DN[di] + ' ' + hhmm(a) + ' - ' + hhmm(b)
}
function formatCourseSchedule(c?: CourseRef) {
  if (!c) return ''
  const parts: string[] = []
  const s1 = slotToText(c.day_of_week ?? null, c.start_time ?? null, c.end_time ?? null)
  if (s1) parts.push(s1)
  const s2 = slotToText(c.day_of_week_2 ?? null, c.start_time_2 ?? null, c.end_time_2 ?? null)
  if (s2) parts.push(s2)
  const s3 = slotToText(c.day_of_week_3 ?? null, c.start_time_3 ?? null, c.end_time_3 ?? null)
  if (s3) parts.push(s3)
  const s4 = slotToText(c.day_of_week_4 ?? null, c.start_time_4 ?? null, c.end_time_4 ?? null)
  if (s4) parts.push(s4)
  const s5 = slotToText(c.day_of_week_5 ?? null, c.start_time_5 ?? null, c.end_time_5 ?? null)
  if (s5) parts.push(s5)
  return parts.join(', ')
}

// ---------- Mini iconos SVG ----------
const IcCash = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
)
const IcCard = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 9h19" />
  </svg>
)
const IcTransfer = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 7h10l-2-2M20 17H10l2 2" />
    <path d="M4 7v10h16V7z" opacity=".15" />
  </svg>
)
const IcDeal = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M8 12l3 3 5-6" />
    <rect x="3" y="4" width="18" height="16" rx="3" />
  </svg>
)
const IcCalendar = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 11h18" />
  </svg>
)
const IcUser = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.7-4 13.3-4 15 0" />
  </svg>
)
const IcBook = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M5 4h9a3 3 0 013 3v12H8a3 3 0 00-3 3V4z" />
    <path d="M8 4v15a3 3 0 013-3h9" />
  </svg>
)
const IcMoney = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 3v18M7 8c1.5-2 8.5-2 10 0s-1.5 4-5 4-6.5 2-5 4 8.5 2 10 0" />
  </svg>
)

// ---------- Stats pequenas ----------
function StatCard({ title, value, icon, iconBg, iconText }: { title: string; value: string; icon: JSX.Element; iconBg: string; iconText: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3 flex items-center gap-3">
      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${iconBg} ${iconText} text-lg shadow-inner`}>
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{title}</span>
        <span className="text-lg font-semibold text-gray-900">{value}</span>
      </div>
    </div>
  )
}

// ---------- Tarjeta de profesor ----------
function TeacherCard({
  name,
  totals,
  onView,
}: {
  name: string;
  totals: { total:number; cash:number; card:number; transfer:number; agreement:number };
  onView: () => void;
}) {
  return (
    <div className="relative group rounded-2xl">
      <div className="pointer-events-none absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-300 blur-md bg-gradient-to-r from-fuchsia-600 to-purple-600" />
      <div className="relative rounded-2xl bg-white border border-gray-100 shadow-sm transition duration-300 group-hover:shadow-xl">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold">
                {name?.trim()?.[0] || 'P'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{name}</div>
                <div className="text-[11px] text-gray-500">Resumen de pagos</div>
              </div>
            </div>
            <button
              className="px-3 py-1.5 text-xs rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow"
              onClick={onView}
              title="Ver detalle"
            >
              Ver
            </button>
          </div>

          <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/40 px-3 py-2">
            <div className="text-[11px] text-gray-600">Total</div>
            <div className="text-2xl font-semibold">
              {fmtCLP.format(totals.total)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 min-w-0">
                <IcCash />
                <span className="truncate">Efectivo</span>
              </span>
              <span className="font-semibold text-right whitespace-nowrap shrink-0">{fmtCLP.format(totals.cash)}</span>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 min-w-0">
                <IcCard />
                <span className="truncate">Tarjeta/Débito</span>
              </span>
              <span className="font-semibold text-right whitespace-nowrap shrink-0">{fmtCLP.format(totals.card)}</span>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 min-w-0">
                <IcTransfer />
                <span className="truncate">Transferencia</span>
              </span>
              <span className="font-semibold text-right whitespace-nowrap shrink-0">{fmtCLP.format(totals.transfer)}</span>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 min-w-0">
                <IcDeal />
                <span className="truncate">Convenio</span>
              </span>
              <span className="font-semibold text-right whitespace-nowrap shrink-0">{fmtCLP.format(totals.agreement)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentsTeachers() {
  const { tenantId } = useTenant()
  const [payments, setPayments] = useState<Payment[]>([])
  const [courses, setCourses] = useState<Record<number, CourseRef>>({})
  const [students, setStudents] = useState<Record<number, StudentRef>>({})
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [byTeacher, setByTeacher] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)
  const [error, setError] = useState<string|null>(null)

  const [teacher, setTeacher] = useState<string>('')

  const todayYMD = toYMDInTZ(new Date(), CL_TZ)
  const [dateFrom, setDateFrom] = useState<string>(todayYMD)
  const [dateTo, setDateTo] = useState<string>(todayYMD)
  const [quickRange, setQuickRange] = useState<string>('personalizado')
  const [pickMonth, setPickMonth] = useState<string>('')   // YYYY-MM
  const [cycleMonth, setCycleMonth] = useState<string>('') // YYYY-MM

  // --- papaginacion (Listado detallado) ---
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const load = async () => {
      setError(null)
      if (firstLoad) setLoading(true)
      setTableLoading(true)
      try {
        const payParams: any = { limit: 1000, offset: 0 }
        if (dateFrom) payParams.date_from = dateFrom
        if (dateTo) payParams.date_to = dateTo
        const [pres, cres, sres, eres, tres] = await Promise.all([
          api.get('/api/pms/payments', { params: payParams }),
          api.get('/api/pms/courses', { params: { limit: 500, offset: 0 } }),
          api.get('/api/pms/students', { params: { limit: 500, offset: 0 } }),
          api.get('/api/pms/enrollments', { params: { limit: 500, offset: 0 } }),
          api.get('/api/pms/payments/by_teacher', { params: payParams }),
        ])
        const itemsRaw = (pres.data as any)?.items ?? pres.data ?? []
        const items = Array.isArray(itemsRaw) ? itemsRaw : []
        setPayments(items)
        const tItems = (tres.data as any)?.items ?? tres.data ?? []
        setByTeacher(Array.isArray(tItems) ? tItems : [])

        const courseItems = (cres.data as any)?.items ?? cres.data ?? []
        const cArr = Array.isArray(courseItems) ? courseItems : []
        const cMap: Record<number, CourseRef> = {}
        for (const c of cArr) {
          cMap[c.id] = {
            id: c.id, name: c.name, teacher_name: c.teacher_name, classes_per_week: c.classes_per_week ?? null,
            day_of_week: c.day_of_week ?? null,
            start_time: c.start_time ? String(c.start_time).slice(0, 5) : null,
            end_time: c.end_time ? String(c.end_time).slice(0, 5) : null,
            day_of_week_2: c.day_of_week_2 ?? null,
            start_time_2: c.start_time_2 ? String(c.start_time_2).slice(0, 5) : null,
            end_time_2: c.end_time_2 ? String(c.end_time_2).slice(0, 5) : null,
            day_of_week_3: (c as any).day_of_week_3 ?? null,
            start_time_3: (c as any).start_time_3 ? String((c as any).start_time_3).slice(0, 5) : null,
            end_time_3: (c as any).end_time_3 ? String((c as any).end_time_3).slice(0, 5) : null,
            day_of_week_4: (c as any).day_of_week_4 ?? null,
            start_time_4: (c as any).start_time_4 ? String((c as any).start_time_4).slice(0, 5) : null,
            end_time_4: (c as any).end_time_4 ? String((c as any).end_time_4).slice(0, 5) : null,
            day_of_week_5: (c as any).day_of_week_5 ?? null,
            start_time_5: (c as any).start_time_5 ? String((c as any).start_time_5).slice(0, 5) : null,
            end_time_5: (c as any).end_time_5 ? String((c as any).end_time_5).slice(0, 5) : null,
          }
        }
        setCourses(cMap)

        const studentItems = (sres.data as any)?.items ?? sres.data ?? []
        const sArr = Array.isArray(studentItems) ? studentItems : []
        const sMap: Record<number, StudentRef> = {}
        for (const s of sArr) sMap[s.id] = { id: s.id, name: `${s.first_name} ${s.last_name}`.trim() }
        setStudents(sMap)

        setEnrollments((eres.data || []).map((e: any) => ({
          id: e.id, student_id: e.student_id, course_id: e.course_id,
          start_date: e.start_date, end_date: e.end_date, is_active: !!e.is_active,
        })))
      } catch (e: any) {
        setError(e?.message || 'Error cargando datos')
      } finally {
        setLoading(false)
        setTableLoading(false)
        setFirstLoad(false)
      }
    }
    load()
  }, [tenantId, dateFrom, dateTo])



  // Si se cambian filtros relevantes, vuelve a pagina 1

  useEffect(() => {
    if (quickRange !== 'mes_elegir' && quickRange !== 'ciclo_6a5') setQuickRange('personalizado')
  }, [dateFrom, dateTo]) // eslint-disable-line

  const headerSubtitle = useMemo(() => {
    if (!dateFrom && !dateTo) return 'Todos los pagos'
    if (quickRange === 'mes_actual' || quickRange === 'mes_elegir') {
      return fmtMonthYear(dateFrom)
    }
    if (quickRange === 'ciclo_6a5') {
      return `Ciclo 6 a 5: ${fmtDayMonthYear(dateFrom)} a ${fmtDayMonthYear(dateTo)}`
    }
    if (dateFrom === dateTo) return fmtDayMonthYear(dateFrom)
    return `${fmtDayMonthYear(dateFrom)} a ${fmtDayMonthYear(dateTo)}`
  }, [quickRange, dateFrom, dateTo])

  // Pagos dentro del rango seleccionado
  const rangePayments = useMemo(() => {
    const from = dateFrom || '0000-01-01'
    const to = dateTo || '9999-12-31'
    const arr = Array.isArray(payments) ? payments : []
    return arr.filter(p => p.payment_date >= from && p.payment_date <= to)
  }, [payments, dateFrom, dateTo])

  // Enriquecer pagos con nombres de curso / alumno / profesor
  const enriched = useMemo(() => {
    return rangePayments.map(p => {
      const c = p.course_id ? courses[p.course_id] : undefined
      const teacherName = c?.teacher_name || (c as any)?.teacher?.name || 'Sin profesor'
      const courseName = c?.name || '-'
      const studentName = p.student_id ? (students[p.student_id]?.name || '-') : '-'
      return { ...p, teacherName, courseName, studentName, courseId: p.course_id }
    })
  }, [rangePayments, courses, students])

  const teachers = useMemo(() => {
    const set = new Set<string>()
    // incluir profesores desde cursos aunque no haya pagos
    Object.values(courses).forEach(c => {
      const tn = c.teacher_name || (c as any)?.teacher?.name
      if (tn) set.add(tn)
    })
    enriched.forEach(p => set.add(p.teacherName))
    return Array.from(set)
      .filter(t => t && t !== 'Sin profesor')
      .sort((a, b) => a.localeCompare(b, 'es'))
  }, [courses, enriched])

  // Si el profesor seleccionado ya no existe en el rango, limpiar seleccion
  useEffect(() => {
    if (teacher && !teachers.includes(teacher)) setTeacher('')
  }, [teachers])

  function applyQuickRange(val: string) {
    setQuickRange(val)
    if (val === 'dia_hoy') {
      const t = toYMDInTZ(new Date(), CL_TZ); setDateFrom(t); setDateTo(t); setPickMonth(''); setCycleMonth('')
    } else if (val === 'mes_actual') {
      const { start, end } = monthRangeOffset(0); setDateFrom(start); setDateTo(end); setPickMonth(''); setCycleMonth('')
    } else if (val === 'mes_elegir') {
      setCycleMonth('')
    } else if (val === 'ciclo_6a5') {
      setPickMonth('')
    } else if (val === 'personalizado') {
      setDateFrom(''); setDateTo(''); setPickMonth(''); setCycleMonth('')
    }
  }
  function applyPickedMonth(yyyy_mm: string) {
    setPickMonth(yyyy_mm)
    if (!yyyy_mm) return
    const [yStr, mStr] = yyyy_mm.split('-'); const y = +yStr; const m = +mStr
    const start = `${y}-${String(m).padStart(2,'0')}-01`
    const end = monthRangeFor(new Date(y, m-1, 1)).end
    setDateFrom(start); setDateTo(end)
  }
  function applyCycle6to5(yyyy_mm: string) {
    setCycleMonth(yyyy_mm)
    if (!yyyy_mm) return
    const { start, end } = cycleFromMonth(yyyy_mm, 6)
    setDateFrom(start); setDateTo(end)
  }

  function findPeriodForPayment(p: Payment): { start?: string; end?: string } {
    if (!p.student_id || !p.course_id) return {}
    const ymd = p.payment_date
    const matches = enrollments.filter(e => e.student_id === p.student_id && e.course_id === p.course_id)
    let best = matches.find(e => {
      const s = e.start_date
      const eend = e.end_date || e.start_date
      return ymd >= s && ymd <= eend
    })
    if (!best) best = matches.filter(e => e.start_date <= ymd).sort((a,b)=> b.start_date.localeCompare(a.start_date))[0]
    if (!best && matches.length > 0) {
      best = matches.slice().sort((a,b)=> a.start_date.localeCompare(b.start_date))[0]
    }
    return best ? { start: best.start_date, end: best.end_date || best.start_date } : {}
  }

  type Agg = { teacher: string; total:number; cash:number; card:number; transfer:number; agreement:number }
  const computedByTeacher: Agg[] = useMemo(() => {
    if (byTeacher.length) return byTeacher.map((t:any) => ({
      teacher: t.teacher_name || t.teacher || 'Sin profesor',
      total: Number(t.total || 0),
      cash: Number(t.cash || 0),
      card: Number(t.card || 0),
      transfer: Number(t.transfer || 0),
      agreement: Number(t.agreement || 0),
    }))
    const map = new Map<string, Agg>()
    const accFor = (t:string) => map.get(t) || { teacher:t, total:0, cash:0, card:0, transfer:0, agreement:0 }
    teachers.forEach(t => map.set(t, accFor(t)))
    for (const p of enriched) {
      const acc = accFor(p.teacherName)
      const amt = Number(p.amount||0)
      acc.total += amt
      if (p.method==='cash') acc.cash += amt
      else if (p.method==='card') acc.card += amt
      else if (p.method==='transfer') acc.transfer += amt
      if (isAgreementPayment(p)) acc.agreement += amt
      map.set(p.teacherName, acc)
    }
    return Array.from(map.values()).sort((a,b)=> a.teacher.localeCompare(b.teacher,'es'))
  }, [byTeacher, enriched, teachers])

  const selectedAgg = useMemo(() => computedByTeacher.find(r => r.teacher === teacher), [computedByTeacher, teacher])

  const byCourseForTeacher = useMemo(() => {
    if (!teacher) return []
    const list = enriched.filter(p => p.teacherName === teacher)
    const map = new Map<string, { course:string; schedule:string; total:number; cash:number; card:number; transfer:number; agreement:number }>()
    for (const p of list) {
      const key = p.courseId ? String(p.courseId) : (p.courseName || '-')
      if (!map.get(key)) {
        const sched = p.courseId ? formatCourseSchedule(courses[p.courseId!]) : ''
        map.set(key, { course: (p.courseName || '-'), schedule: sched, total:0, cash:0, card:0, transfer:0, agreement:0 })
      }
      const acc = map.get(key)!
      const amt = Number(p.amount||0)
      acc.total += amt
      if (p.method==='cash') acc.cash += amt
      else if (p.method==='card') acc.card += amt
      else if (p.method==='transfer') acc.transfer += amt
      if (isAgreementPayment(p)) acc.agreement += amt
    }
    return Array.from(map.values()).sort((a,b)=> a.course.localeCompare(b.course,'es'))
  }, [enriched, teacher, courses])

  const detailedRowsForTeacher = useMemo(() => {
    if (!teacher) return []
    return enriched
      .filter(p => p.teacherName === teacher)
      .map(p => {
        let periodo = ''
        if (p.type === 'monthly' || isAgreementPayment(p)) {
          const per = findPeriodForPayment(p)
          if (per.start && per.end) periodo = `${toDDMMYYYY(per.start)} a ${toDDMMYYYY(per.end)}`
        } else if (p.type === 'single_class') {
          periodo = toDDMMYYYY(p.payment_date)
        }
        const isAgreement = isAgreementPayment(p)
        return {
          id: p.id,
          fecha: toDDMMYYYY(p.payment_date),
          alumno: p.studentName,
          curso: p.courseName,
          profesor: p.teacherName,
          periodo,
          metodo: methodLabel(p.method),
          methodKey: String(p.method),
          isAgreement,
          monto: fmtCLP.format(Number(p.amount||0)),
          obs: p.notes || ''
        }
      })
      .sort((a,b)=> b.id - a.id)
  }, [enriched, teacher])

  // --- Derivadas de paginacion ---
  const totalPages = Math.max(1, Math.ceil(detailedRowsForTeacher.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return detailedRowsForTeacher.slice(start, start + pageSize)
  }, [detailedRowsForTeacher, safePage, pageSize])

  return (
    <div className="space-y-6">
      {/* Header y filtros */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Pagos por profesor</h1>
          <div className="text-sm text-gray-600">{headerSubtitle}</div>
          <div className="text-xs text-gray-500">Profesores: {teachers.length}</div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-fuchsia-200 bg-gradient-to-r from-fuchsia-100 to-purple-100 text-fuchsia-800 hover:from-fuchsia-200 hover:to-purple-200 shadow-sm"
            title="Volver"
          >
            ← Volver
          </button>
        </div>

        <div className="flex flex-col w-full">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-700 text-lg shadow-inner">📅</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Rango de fechas</div>
                <div className="text-xs text-gray-500">Filtro rápido y personalizado</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">⚡</span>
                  Rango rápido
                </label>
                <select className="border rounded px-3 py-2" value={quickRange} onChange={e => applyQuickRange(e.target.value)}>
                  <option value="dia_hoy">Por día (hoy)</option>
                  <option value="mes_actual">Por mes (mes actual)</option>
                  <option value="mes_elegir">Por mes (elegir)</option>
                  <option value="ciclo_6a5">Ciclo 6 a 5</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              {quickRange === 'mes_elegir' && (
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">🗓️</span>
                    Mes (YYYY-MM)
                  </label>
                  <input type="month" className="border rounded px-3 py-2" value={pickMonth} onChange={(e)=> applyPickedMonth(e.target.value)} />
                </div>
              )}

              {quickRange === 'ciclo_6a5' && (
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">🔄</span>
                    Mes inicio ciclo (YYYY-MM)
                  </label>
                  <input type="month" className="border rounded px-3 py-2" value={cycleMonth} onChange={(e)=> applyCycle6to5(e.target.value)} />
                  <span className="text-[10px] text-gray-500 mt-1">Rango: 06/MM a 05/(MM+1)</span>
                </div>
              )}

              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">↙</span>
                  Desde
                </label>
                <input type="date" className="border rounded px-3 py-2" value={dateFrom} max={dateTo || undefined}
                  onChange={e=>{ setDateFrom(e.target.value); setQuickRange('personalizado') }} />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">↗</span>
                  Hasta
                </label>
                <input type="date" className="border rounded px-3 py-2" value={dateTo} min={dateFrom || undefined}
                  onChange={e=>{ setDateTo(e.target.value); setQuickRange('personalizado') }} />
              </div>
            </div>

            <div className="text-xs text-gray-700">
              Rango seleccionado:&nbsp;<span className="font-semibold">{toDDMMYYYY(dateFrom)}  {toDDMMYYYY(dateTo)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Profesor</label>
              <select className="border rounded px-3 py-2" value={teacher} onChange={e=>setTeacher(e.target.value)}>
                <option value="">Todos</option>
                {teachers.map(t => (<option key={t} value={t}>{t}</option>))}
              </select>
            </div>
          </div>
        </div>

        {!firstLoad && tableLoading && (
          <div className="text-xs text-fuchsia-700 animate-pulse">Actualizando datos...</div>
        )}
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <>
          {/* Tarjetas resumen cuando hay profesor seleccionado */}
          {teacher ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              <StatCard title={`Total ${teacher}`} value={fmtCLP.format(selectedAgg?.total || 0)} icon={<IcMoney />} iconBg="bg-gradient-to-br from-purple-100 to-fuchsia-100" iconText="text-purple-700" />
              <StatCard title="Efectivo" value={fmtCLP.format(selectedAgg?.cash || 0)} icon={<IcCash />} iconBg="bg-gradient-to-br from-emerald-100 to-emerald-50" iconText="text-emerald-700" />
              <StatCard title="Tarjeta/Débito" value={fmtCLP.format(selectedAgg?.card || 0)} icon={<IcCard />} iconBg="bg-gradient-to-br from-sky-100 to-indigo-50" iconText="text-sky-700" />
              <StatCard title="Transferencia" value={fmtCLP.format(selectedAgg?.transfer || 0)} icon={<IcTransfer />} iconBg="bg-gradient-to-br from-indigo-100 to-blue-50" iconText="text-indigo-700" />
              <StatCard title="Convenio" value={fmtCLP.format(selectedAgg?.agreement || 0)} icon={<IcDeal />} iconBg="bg-gradient-to-br from-amber-100 to-amber-50" iconText="text-amber-700" />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
              <div className="text-sm text-gray-700">
                Profesores en el rango seleccionado: <span className="font-semibold">{computedByTeacher.length}</span>
              </div>
            </div>
          )}

          {/* Vista */}
          {teacher ? (
            <>
              {/* -------- Tabla por curso (contorno degradado) -------- */}
              <div className="rounded-2xl p-[2px] bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-sm relative">
                {tableLoading && !firstLoad && (
                  <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center text-sm font-semibold text-fuchsia-700">
                    Actualizando...
                  </div>
                )}
                <div className="bg-white rounded-2xl overflow-auto">
                  <div className="px-4 pt-4 text-sm font-semibold">Detalle por curso</div>
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gradient-to-r from-fuchsia-50 to-purple-50 text-left">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-fuchsia-700"><span className="inline-flex items-center gap-2"><IcBook />Curso</span></th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-fuchsia-700">Efectivo</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-fuchsia-700">Tarjeta</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-fuchsia-700">Transferencia</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-fuchsia-700">Convenio</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-fuchsia-700"><span className="inline-flex items-center gap-2"><IcMoney />Total</span></th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:nth-child(even)]:bg-gray-50">
                      {byCourseForTeacher.length === 0 ? (
                        <tr><td className="px-4 py-4 text-gray-500" colSpan={6}>Sin pagos en el rango.</td></tr>
                      ) : byCourseForTeacher.map(r => (
                        <tr key={r.course} className="border-t hover:bg-fuchsia-50/40 transition">
                          <td className="px-4 py-2">
                            <div className="leading-tight">
                              <div>{r.course}</div>
                              <div className="text-[11px] text-gray-500">{r.schedule || "Sin horario"}</div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.cash)}</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.card)}</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.transfer)}</td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.agreement)}</td>
                          <td className="px-4 py-2 text-right font-semibold">{fmtCLP.format(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------- Lista detallada (contorno degradado) -------- */}
              <div className="rounded-2xl p-[2px] bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-sm relative">
                {tableLoading && !firstLoad && (
                  <div className="absolute inset-0 rounded-2xl bg-white/70 backdrop-blur-[1px] flex items-center justify-center text-sm font-semibold text-fuchsia-700">
                    Actualizando...
                  </div>
                )}
                <div className="bg-white rounded-2xl overflow-auto">
                  <div className="px-4 pt-4 text-sm font-semibold">Listado detallado</div>
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0">
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 border-b">
                        <th className="px-4 py-3 text-left"><span className="inline-flex items-center gap-2"><IcCalendar />Fecha</span></th>
                        <th className="px-4 py-3 text-left"><span className="inline-flex items-center gap-2"><IcUser />Alumno</span></th>
                        <th className="px-4 py-3 text-left"><span className="inline-flex items-center gap-2"><IcBook />Curso</span></th>
                        <th className="px-4 py-3 text-left">Profesor</th>
                        <th className="px-4 py-3 text-left">Periodo</th>
                        <th className="px-4 py-3 text-left">Metodo</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-left">Observacion</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:nth-child(even)]:bg-gray-50">
                      {pageRows.length === 0 ? (
                        <tr><td className="px-4 py-4 text-gray-500" colSpan={8}>Sin pagos en el rango.</td></tr>
                      ) : pageRows.map(r => (
                        <tr key={r.id} className="border-t hover:bg-fuchsia-50/40 transition">
                          <td className="px-4 py-2">{r.fecha}</td>
                          <td className="px-4 py-2">{r.alumno}</td>
                          <td className="px-4 py-2">{r.curso}</td>
                          <td className="px-4 py-2">{r.profesor}</td>
                          <td className="px-4 py-2">{r.periodo || '-'}</td>
                          <td className="px-4 py-2">{r.metodo}</td>
                          <td className="px-4 py-2 text-right">{r.monto}</td>
                          <td className="px-4 py-2">{r.obs}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-gray-600">
                              Mostrando {pageRows.length} de {detailedRowsForTeacher.length} / Pagina {safePage} de {totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600">Filas:</label>
                              <select
                                className="border rounded px-2 py-1 text-sm"
                                value={pageSize}
                                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                              >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                              </select>
                              <button
                                className="px-2 py-1 border rounded disabled:opacity-50"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                              >
                                Anterior
                              </button>
                              <button
                                className="px-2 py-1 border rounded disabled:opacity-50"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                              >
                                Siguiente
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* -------- Vista TODOS: grilla por profesor -------- */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {computedByTeacher.map(r => (
                <TeacherCard
                  key={r.teacher}
                  name={r.teacher}
                  totals={{
                    total: r.total,
                    cash: r.cash,
                    card: r.card,
                    transfer: r.transfer,
                    agreement: r.agreement,
                  }}
                  onView={() => setTeacher(r.teacher)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
























