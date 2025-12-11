import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { FaBirthdayCake } from 'react-icons/fa'
import {
  HiExclamationCircle,
  HiCalendar,
  HiRefresh,
  HiUserGroup,
  HiBookOpen,
  HiClock,
  HiSparkles,
} from 'react-icons/hi'

type CourseListItem = {
  id: number
  name: string
  level?: string | null
  image_url?: string | null
  day_of_week?: number | null
  start_time?: string | null
  end_time?: string | null
  start_date?: string | null
  price?: number | null
  class_price?: number | null
  is_active?: boolean
  teacher_name?: string | null
  room_name?: string | null
}

type CourseStatusStudent = {
  id: number
  first_name: string
  last_name: string
  photo_url?: string | null
  email?: string | null
  gender?: string | null
  phone?: string | null
  notes?: string | null
  enrolled_since?: string | null
  renewal_date?: string | null
  email_ok?: boolean
  payment_status: 'activo' | 'pendiente'
  attendance_count?: number
  birthday_today?: boolean
}

type CourseStatusItem = {
  course: {
    id: number
    name: string
    level?: string | null
    price?: number | null
    class_price?: number | null
    image_url?: string | null
    day_of_week?: number | null
    start_date?: string | null
  }
  teacher?: { id: number; name: string } | null
  students: CourseStatusStudent[]
  counts: { total: number; female: number; male: number }
}

type Payment = {
  id: number
  student_id?: number | null
  course_id?: number | null
  amount: number
  method: 'cash' | 'card' | 'transfer' | string
  type: 'monthly' | 'single_class' | 'rental' | string
  reference?: string | null
  notes?: string | null
  payment_date: string // YYYY-MM-DD
  course_name?: string | null
  teacher_name?: string | null
}

type StudentListItem = {
  id: number
  first_name: string
  last_name: string
  joined_at?: string | null
  enrolled_since?: string | null
}

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const dayNames = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function dayInfoInTZ(tz = CL_TZ) {
  const tzNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
  const dow = (tzNow.getDay() + 6) % 7 // lunes = 0
  return {
    dow,
    label: dayNames[dow],
    ymd: toYMDInTZ(tzNow, tz),
  }
}

function formatYMDToCL(ymd?: string | null) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

const methodLabel: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
}

const typeLabel: Record<string, string> = {
  monthly: 'Mensual',
  single_class: 'Clase suelta',
}

export default function DashboardPage() {
  const { tenantId } = useTenant()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [status, setStatus] = useState<CourseStatusItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])

  const load = async () => {
    if (tenantId == null) {
      setError('Seleccione un tenant')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const todayYMD = toYMDInTZ(new Date(), CL_TZ)
      const [yy, mm] = todayYMD.split('-')
      const monthStart = `${yy}-${mm}-01`
      const [cres, sres, pres, stures] = await Promise.all([
        api.get('/api/pms/courses', { params: { limit: 500, offset: 0 } }),
        api.get('/api/pms/course_status', { params: { attendance_days: 30 } }),
        api.get('/api/pms/payments', { params: { limit: 500, offset: 0, date_from: monthStart, date_to: todayYMD } }),
        api.get('/api/pms/students', { params: { limit: 500, offset: 0 } }),
      ])
      setCourses((cres.data as any)?.items ?? cres.data ?? [])
      setStatus(sres.data)
      setPayments((pres.data as any)?.items ?? pres.data ?? [])
      setStudents((stures.data as any)?.items ?? stures.data ?? [])
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId])

  const { dow: dowCL, label: todayLabel, ymd: today } = dayInfoInTZ(CL_TZ)

  const classesToday = useMemo(() => {
    return courses
      .filter(c => (c.day_of_week ?? -1) === dowCL)
      .slice()
      .sort((a, b) => {
        const aT = a.start_time || ''
        const bT = b.start_time || ''
        if (aT !== bT) return aT.localeCompare(bT)
        return (a.name || '').localeCompare(b.name || '')
      })
  }, [courses, dowCL])

  const paymentsToday = useMemo(() => payments.filter(p => p.payment_date === today), [payments, today])
  const paymentsTodayByMethod = useMemo(() => {
    const map: Record<string, number> = { cash: 0, card: 0, transfer: 0 }
    for (const p of paymentsToday) map[p.method] = (map[p.method] || 0) + Number(p.amount || 0)
    return map
  }, [paymentsToday])

  const courseInfoMap = useMemo(() => {
    const map: Record<
      number,
      { name?: string; teacher?: string; dow?: number | null; start_time?: string | null; end_time?: string | null }
    > = {}
    for (const c of courses) {
      map[c.id] = {
        name: c.name,
        teacher: c.teacher_name || undefined,
        dow: c.day_of_week,
        start_time: c.start_time,
        end_time: c.end_time,
      }
    }
    for (const g of status) {
      const id = g.course.id
      const teacher = g.teacher?.name
      if (!map[id])
        map[id] = {
          name: g.course.name,
          teacher: teacher || undefined,
          dow: g.course.day_of_week,
          start_time: g.course.start_date ? undefined : undefined,
          end_time: undefined,
        }
      else {
        if (!map[id].teacher && teacher) map[id].teacher = teacher
        if (map[id].dow == null) map[id].dow = g.course.day_of_week
      }
    }
    return map
  }, [courses, status])

  const alerts = useMemo(() => {
    const soonEnd: { student: string; course: string; renewal_date: string }[] = []
    const pendingSet = new Set<string>()
    const birthdaysSet = new Set<string>()
    const anniversariesSet = new Set<string>()
    const endFrom = today
    const endTo = toYMDInTZ(new Date(Date.now() + 7 * 24 * 3600 * 1000), CL_TZ)
    const todayDate = new Date(`${today}T00:00:00`)

    // pagos indexados por student para fallback (usa solo los cargados en dashboard)
    const studentHasPayment = new Set<number>()
    for (const p of payments) {
      if (p.student_id != null) studentHasPayment.add(p.student_id)
    }

    for (const group of status) {
      for (const st of group.students || []) {
        const fullName = `${st.first_name} ${st.last_name}`.trim()
        if (st.renewal_date && st.renewal_date >= endFrom && st.renewal_date <= endTo) {
          soonEnd.push({ student: fullName, course: group.course.name, renewal_date: st.renewal_date })
        }
        const payStatus = (st.payment_status || '').toString().toLowerCase()
        const isPending = payStatus ? payStatus !== 'activo' : !studentHasPayment.has(st.id)
        if (isPending) pendingSet.add(fullName)
        if (st.birthday_today) birthdaysSet.add(fullName)
        if (st.enrolled_since) {
          const joined = new Date(`${st.enrolled_since}T00:00:00`)
          if (!isNaN(joined.getTime())) {
            const oneYear = new Date(joined)
            oneYear.setFullYear(oneYear.getFullYear() + 1)
            if (todayDate >= oneYear) anniversariesSet.add(fullName)
          }
        }
      }
    }
    // También consideramos alumnos sin curso activo pero con 1 año
    for (const st of students) {
      const joinedIso = st.joined_at || st.enrolled_since
      if (!joinedIso) continue
      const joined = new Date(`${joinedIso}T00:00:00`)
      if (!isNaN(joined.getTime())) {
        const oneYear = new Date(joined)
        oneYear.setFullYear(oneYear.getFullYear() + 1)
        if (todayDate >= oneYear) {
          const fullName = `${st.first_name} ${st.last_name}`.trim()
          anniversariesSet.add(fullName)
        }
      }
    }
    soonEnd.sort((a, b) => a.renewal_date.localeCompare(b.renewal_date))
    const anniversaries = Array.from(anniversariesSet).slice(0, 6)
    const birthdays = Array.from(birthdaysSet).slice(0, 6)
    const pending = Array.from(pendingSet)
    return {
      soonEnd,
      pendingCount: pending.length,
      pendingPreview: pending.slice(0, 6),
      birthdays,
      anniversaries,
    }
  }, [status, today, students, payments])

  const activeCourses = useMemo(() => courses.filter(c => c.is_active !== false).length, [courses])
  const revenue = useMemo(() => {
    const monthKey = today.slice(0, 7)
    let todayTotal = 0
    let monthTotal = 0
    for (const p of payments) {
      if (p.payment_date === today) todayTotal += Number(p.amount || 0)
      if ((p.payment_date || '').startsWith(monthKey)) monthTotal += Number(p.amount || 0)
    }
    return { todayTotal, monthTotal }
  }, [payments, today])

  const attendances30d = useMemo(() => {
    let total = 0
    for (const g of status) total += (g.students || []).reduce((acc, s) => acc + (s.attendance_count || 0), 0)
    return total
  }, [status])

  const kpiData = [
    { label: 'Cursos activos', value: activeCourses, icon: <HiBookOpen className="text-blue-600" /> },
    { label: 'Clases de hoy', value: classesToday.length, icon: <HiClock className="text-emerald-600" /> },
    { label: 'Ingresos hoy', value: fmtCLP.format(revenue.todayTotal), icon: <HiCalendar className="text-amber-600" /> },
    { label: 'Ingresos mes', value: fmtCLP.format(revenue.monthTotal), icon: <HiRefresh className="text-purple-600" /> },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-3 lg:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link to="/payments" className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm">
            Pagos
          </Link>
          <button onClick={load} className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 shadow-sm">
            Refrescar
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">{error}</div>}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="h-28 rounded-2xl border bg-white shadow-sm animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiData.map((k, idx) => (
                <KpiCard key={idx} label={k.label} value={k.value} icon={k.icon} />
              ))}
            </div>

            {/* Clases de hoy */}
            <section className="rounded-2xl border border-indigo-100 p-5 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-gray-900">
                <span className="inline-flex w-9 h-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <HiBookOpen />
                </span>
                <h2 className="text-base font-semibold">Clases de hoy ({todayLabel})</h2>
              </div>
              {classesToday.length === 0 ? (
                <div className="text-sm text-gray-500">No hay clases programadas hoy.</div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {classesToday.map(c => (
                    <div key={c.id} className="p-3 rounded-xl border bg-white shadow-sm flex gap-4 items-center">
                      <div className="relative">
                        {c.image_url ? (
                          <img src={toAbsoluteUrl(c.image_url)} alt={c.name} className="w-16 h-16 rounded-lg object-cover border" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-indigo-100 to-sky-100 border flex items-center justify-center text-indigo-400 text-lg">
                            <HiBookOpen />
                          </div>
                        )}
                        {c.level && (
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] shadow-sm">
                            {c.level}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <HiClock className="text-indigo-500" />
                            {dayNames[c.day_of_week ?? dowCL].slice(0, 3)} { (c.start_time || '').slice(0, 5)} - {(c.end_time || '').slice(0, 5)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 truncate flex items-center gap-1">
                          <HiUserGroup className="text-indigo-500" />
                          <span>{c.teacher_name || 'Sin profesor'}</span>
                        </div>
                        {c.start_date && (
                          <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                            <HiCalendar className="text-indigo-400" />
                            <span>Inicio: {formatYMDToCL(c.start_date)}</span>
                          </div>
                        )}
                        {c.room_name && (
                          <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                            <HiCalendar className="text-indigo-400" />
                            <span>Sala: {c.room_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Pagos recientes */}
            <section className="rounded-2xl border p-5 bg-white shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-gray-900">
                <HiBookOpen className="text-emerald-500" />
                <h2 className="text-base font-semibold">Pagos recientes</h2>
              </div>
              {paymentsToday.length === 0 ? (
                <div className="text-sm text-gray-500">Sin pagos registrados hoy.</div>
              ) : (
                <div className="space-y-2">
                  {paymentsToday.slice(0, 6).map(p => (
                    <div key={p.id} className="p-3 rounded-xl border bg-gradient-to-r from-white to-emerald-50 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900">{fmtCLP.format(Number(p.amount || 0))}</div>
                        <div className="text-xs text-gray-600 truncate">
                          {p.course_name || (p.course_id ? courseInfoMap[p.course_id]?.name : '') || p.reference || p.type}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                          <HiClock className="text-emerald-500" />
                          <span>
                            {p.course_id && courseInfoMap[p.course_id]?.dow != null
                              ? `${dayNames[courseInfoMap[p.course_id]!.dow!].slice(0, 3)} ${(courseInfoMap[p.course_id]?.start_time || '').slice(0, 5)} - ${(courseInfoMap[p.course_id]?.end_time || '').slice(0, 5)}`
                              : p.payment_date}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {p.teacher_name
                            ? `Profesor: ${p.teacher_name}`
                            : p.course_id && courseInfoMap[p.course_id]?.teacher
                            ? `Profesor: ${courseInfoMap[p.course_id]?.teacher}`
                            : p.notes || '—'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-xs text-gray-500">
                        <span>{p.payment_date}</span>
                        <span className="mt-1 px-2 py-0.5 rounded-full border text-[10px] bg-white text-emerald-700 border-emerald-200">
                          {methodLabel[p.method] || p.method}
                        </span>
                      </div>
                    </div>
                  ))}
                  {paymentsToday.length > 6 && (
                    <div className="text-xs text-gray-500 text-center">y {paymentsToday.length - 6} mas...</div>
                  )}
                </div>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="px-3 py-2 rounded-lg border bg-white text-center">
                  <div className="text-gray-500 mb-1">Efectivo</div>
                  <div className="font-semibold text-gray-900">{fmtCLP.format(paymentsTodayByMethod['cash'] || 0)}</div>
                </div>
                <div className="px-3 py-2 rounded-lg border bg-white text-center">
                  <div className="text-gray-500 mb-1">Tarjeta</div>
                  <div className="font-semibold text-gray-900">{fmtCLP.format(paymentsTodayByMethod['card'] || 0)}</div>
                </div>
                <div className="px-3 py-2 rounded-lg border bg-white text-center">
                  <div className="text-gray-500 mb-1">Transfer.</div>
                  <div className="font-semibold text-gray-900">{fmtCLP.format(paymentsTodayByMethod['transfer'] || 0)}</div>
                </div>
              </div>
            </section>
          </div>

          {/* Columna lateral */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-rose-200 p-5 bg-gradient-to-br from-rose-100 via-rose-50 to-white shadow-lg">
              <div className="flex items-center justify-between mb-3 text-rose-700">
                <div className="flex items-center gap-2">
                  <HiExclamationCircle className="text-xl" />
                  <h2 className="text-base font-semibold text-gray-900">Alertas</h2>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {/* Pagos pendientes */}
                <div className="p-3 rounded-xl border border-rose-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-gray-900 font-medium">
                      <HiUserGroup className="text-rose-500" />
                      <span>Pagos pendientes</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold shadow-sm">
                      {alerts.pendingCount}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">{alerts.pendingPreview.slice(0, 3).join(', ') || '-'}</div>
                </div>

                {/* Renovaciones proximas */}
                <div className="p-3 rounded-xl border border-rose-100 bg-white shadow-sm">
                  <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                    <HiRefresh className="text-rose-500" />
                    <span>Renovaciones proximas (7 dias)</span>
                  </div>
                  {alerts.soonEnd.length === 0 ? (
                    <div className="text-xs text-gray-500">Sin vencimientos proximos.</div>
                  ) : (
                    <ul className="space-y-2">
                      {alerts.soonEnd.slice(0, 4).map((r, i) => (
                        <li key={i} className="text-xs rounded-lg bg-rose-50 border border-rose-100 p-2">
                          <div className="font-medium text-gray-900 truncate">{r.student}</div>
                          <div className="flex items-center justify-between mt-0.5 gap-2">
                            <span className="text-gray-600 truncate">{r.course}</span>
                            <span className="ml-2 px-2 py-0.5 rounded bg-white text-rose-700 text-[10px] font-semibold shadow-sm border border-rose-200 whitespace-nowrap">
                              {r.renewal_date}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {alerts.soonEnd.length > 4 && <div className="text-xs text-gray-500 mt-2">y {alerts.soonEnd.length - 4} mas...</div>}
                </div>

                {/* Cumpleanos */}
                <div className="p-3 rounded-xl border border-rose-100 bg-white shadow-sm">
                  <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                    <HiCalendar className="text-rose-500" />
                    <span>Cumpleanos hoy</span>
                  </div>
                  {alerts.birthdays.length === 0 ? (
                    <div className="text-xs text-gray-500">-</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {alerts.birthdays.slice(0, 3).map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm"
                        >
                          <FaBirthdayCake className="text-rose-500" />
                          <span className="truncate max-w-[120px]">{name}</span>
                        </span>
                      ))}
                      {alerts.birthdays.length > 3 && (
                        <span className="text-[11px] text-rose-600 font-medium">+{alerts.birthdays.length - 3} mas</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Aniversario 1 ano */}
                <div className="p-3 rounded-xl border border-emerald-100 bg-white shadow-sm">
                  <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
                    <HiSparkles className="text-emerald-500" />
                    <span>Cumplieron 1 ano</span>
                  </div>
                  {alerts.anniversaries?.length === 0 ? (
                    <div className="text-xs text-gray-500">Sin aniversarios hoy.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {alerts.anniversaries.map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm"
                        >
                          <HiSparkles className="text-emerald-500" />
                          <span className="truncate max-w-[140px]">{name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border-2 border-violet-100 p-5 bg-gradient-to-br from-violet-50 via-white to-indigo-50 shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-sm font-semibold">A</span>
                <h2 className="text-base font-semibold text-gray-900">Asistencias (30 dias)</h2>
              </div>
              <div className="mt-1 text-3xl font-semibold text-gray-900">{attendances30d}</div>
              <div className="text-xs text-gray-500">Suma de asistencias registradas</div>
              <div className="mt-4 h-2 rounded-full bg-violet-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${Math.min(100, attendances30d)}%` }} />
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border p-4 bg-gradient-to-b from-gray-50 to-white shadow-sm">
      <div className="text-sm text-gray-600 flex items-center gap-2">
        {icon && (
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-700">
            {icon}
          </span>
        )}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}
