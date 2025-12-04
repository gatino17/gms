import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { FaBirthdayCake } from 'react-icons/fa'

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
}

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })

function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

const dayNames = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo']

export default function DashboardPage() {
  const { tenantId } = useTenant()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [status, setStatus] = useState<CourseStatusItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

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
      const [cres, sres, pres] = await Promise.all([
        api.get('/api/pms/courses', { params: { limit: 500, offset: 0 } }),
        api.get('/api/pms/course_status', { params: { attendance_days: 30 } }),
        api.get('/api/pms/payments', { params: { limit: 500, offset: 0, date_from: monthStart, date_to: todayYMD } }),
      ])
      setCourses((cres.data as any)?.items ?? cres.data ?? [])
      setStatus(sres.data)
      setPayments((pres.data as any)?.items ?? pres.data ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // Derivados
  const today = toYMDInTZ(new Date(), CL_TZ)
  const [y, m] = today.split('-')
  const monthStart = `${y}-${m}-01`

  const activeCourses = useMemo(() => status.length, [status])

  const uniqueActiveStudents = useMemo(() => {
    const ids = new Set<number>()
    for (const s of status) {
      for (const st of s.students || []) ids.add(st.id)
    }
    return ids.size
  }, [status])

  const classesToday = useMemo(() => {
    const dow = (new Date().getDay() + 6) % 7 // JS: 0=Dom -> 0=Lun
    return courses.filter(c => c.is_active !== false && c.day_of_week === dow).length
  }, [courses])

  const revenue = useMemo(() => {
    let todayTotal = 0, monthTotal = 0
    for (const p of payments) {
      const amt = Number(p.amount || 0)
      if (p.payment_date >= monthStart && p.payment_date <= today) monthTotal += amt
      if (p.payment_date === today) todayTotal += amt
    }
    return { todayTotal, monthTotal }
  }, [payments, today, monthStart])

  const attendances30d = useMemo(() => {
    let total = 0
    for (const s of status) for (const st of s.students || []) total += Number(st.attendance_count || 0)
    return total
  }, [status])

  const classesTodayList = useMemo(() => {
    const dow = (new Date().getDay() + 6) % 7
    return courses
      .filter(c => c.is_active !== false && c.day_of_week === dow)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  }, [courses])

  const paymentsToday = useMemo(() => payments.filter(p => p.payment_date === today), [payments, today])
  const paymentsTodayByMethod = useMemo(() => {
    const map: Record<string, number> = { cash: 0, card: 0, transfer: 0 }
    for (const p of paymentsToday) map[p.method] = (map[p.method] || 0) + Number(p.amount || 0)
    return map
  }, [paymentsToday])

  const alerts = useMemo(() => {
    const soonEnd: { student: string; course: string; renewal_date: string }[] = []
    const pendingNames: string[] = []
    const birthdays: string[] = []
    const endFrom = today
    const endTo = toYMDInTZ(new Date(Date.now() + 7 * 24 * 3600 * 1000), CL_TZ)
    for (const group of status) {
      for (const st of group.students || []) {
        const fullName = `${st.first_name} ${st.last_name}`.trim()
        if (st.renewal_date && st.renewal_date >= endFrom && st.renewal_date <= endTo) {
          soonEnd.push({ student: fullName, course: group.course.name, renewal_date: st.renewal_date })
        }
        if (st.payment_status === 'pendiente') pendingNames.push(fullName)
        if (st.birthday_today) birthdays.push(fullName)
      }
    }
    soonEnd.sort((a, b) => a.renewal_date.localeCompare(b.renewal_date))
    return { soonEnd, pendingCount: pendingNames.length, pendingPreview: pendingNames.slice(0, 6), birthdays: birthdays.slice(0, 6) }
  }, [status, today])

  // Renovaciones pendientes por dia (grouped)
  const pendingByDay = useMemo(() => {
    const map: Record<number, Array<{ student: string; photo?: string; course: string; timeLabel: string; overdue: number }>> = {}
    const todayDate = new Date(today)
    for (const group of status) {
      const dow = (group.course.day_of_week ?? -1) as number
      // Buscar el curso completo para obtener start_time
      const fullCourse = courses.find(c => c.id === group.course.id)
      const time = fullCourse?.start_time || ''
      const timeLabel = time ? `${time.slice(0,2)}hrs` : ''
      for (const st of group.students || []) {
        if (st.payment_status !== 'pendiente') continue
        const name = `${st.first_name} ${st.last_name}`.trim()
        let overdue = 0
        if (st.renewal_date) {
          const rd = new Date(st.renewal_date)
          overdue = Math.max(0, Math.floor((todayDate.getTime() - rd.getTime()) / (24*3600*1000)))
        }
        const photo = st.photo_url ? toAbsoluteUrl(st.photo_url) : undefined
        if (!(dow in map)) map[dow] = []
        map[dow].push({ student: name, photo, course: group.course.name, timeLabel, overdue })
      }
    }
    // sort by overdue desc then by name
    for (const k of Object.keys(map)) map[Number(k)].sort((a,b)=> (b.overdue - a.overdue) || a.student.localeCompare(b.student, 'es'))
    return map
  }, [status, today, courses])

  const methodLabel = (m: string) => m === 'cash' ? 'Efectivo' : m === 'card' ? 'Tarjeta' : m === 'transfer' ? 'Transferencia' : m

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-4 text-white">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Dashboard</h1>
          <div className="text-sm/relaxed opacity-90">Vista general del sistema</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Alumnos activos" value={uniqueActiveStudents} />
        <KpiCard label="Cursos activos" value={activeCourses} />
        <KpiCard label="Clases de hoy" value={classesToday} />
        <KpiCard label="Ingresos hoy" value={fmtCLP.format(revenue.todayTotal)} />
        <KpiCard label="Ingresos mes" value={fmtCLP.format(revenue.monthTotal)} />
      </div>

      {error && <div className="text-red-600">{error}</div>}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="h-48 bg-gray-100 rounded-2xl border animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-2xl border animate-pulse" />
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Columna principal - Renovaciones pendientes destacadas */}
          <div className="xl:col-span-2 space-y-6">
            {/* Renovaciones pendientes - DESTACADO */}
            {Object.keys(pendingByDay).length > 0 && (
              <section className="rounded-2xl border-2 border-rose-400 bg-gradient-to-br from-rose-50 to-white p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⚡</span>
                  <h2 className="text-lg font-semibold text-gray-900">Renovaciones pendientes</h2>
                  <span className="ml-auto px-3 py-1 rounded-full bg-rose-500 text-white text-sm font-semibold">
                    {Object.values(pendingByDay).flat().length}
                  </span>
                </div>
                <div className="space-y-4 max-h-96 overflow-auto pr-1">
                  {[0,1,2,3,4,5,6].map(d => {
                    const items = pendingByDay[d] || []
                    if (items.length === 0) return null
                    return (
                      <div key={d}>
                        <div className="text-xs font-semibold text-gray-600 uppercase mb-2">{dayNames[d]}</div>
                        <div className="space-y-2">
                          {items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-xl border-2 border-rose-200 bg-white p-3 hover:shadow-md transition">
                              {it.photo ? (
                                <img src={it.photo} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-rose-300" />
                              ) : (
                                <div className="w-10 h-10 rounded-full grid place-items-center bg-rose-100 border-2 border-rose-300 text-sm font-semibold text-rose-700">
                                  {it.student.slice(0,1).toUpperCase()}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900">{it.student}</div>
                                <div className="text-xs text-gray-600">{it.course} · {dayNames[d]}{it.timeLabel ? `, ${it.timeLabel}` : ''}</div>
                              </div>
                              {it.overdue > 0 && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500 text-white text-xs font-semibold">
                                  <span>?</span>
                                  <span>{it.overdue}d</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="rounded-2xl border p-5 bg-gradient-to-b from-sky-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Clases de hoy</h2>
                <Link to="/courses" className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium">Ver cursos</Link>
              </div>
              {classesTodayList.length === 0 ? (
                <div className="text-gray-500 text-sm">No hay clases programadas para hoy.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classesTodayList.map(c => (
                    <Link key={c.id} to={`/courses/${c.id}`} className="rounded-xl border p-3 hover:shadow-md transition bg-white">
                      <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                      {c.level && <div className="text-xs text-gray-500 mt-0.5">{c.level}</div>}
                      <div className="mt-2 text-xs text-gray-600">
                        <div>{c.start_time?.slice(0,5) || '--:--'} - {c.end_time?.slice(0,5) || '--:--'}</div>
                        {c.teacher_name && <div className="mt-0.5">👩‍🏫 {c.teacher_name}</div>}
                        {c.room_name && <div className="mt-0.5">📍 {c.room_name}</div>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border p-5 bg-gradient-to-b from-emerald-50 to-white">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Pagos de hoy</h2>
                <Link to="/payments" className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium">Ver todos</Link>
              </div>
              {paymentsToday.length === 0 ? (
                <div className="text-gray-500 text-sm">Aun no hay pagos registrados hoy.</div>
              ) : (
                <div className="space-y-2">
                  {paymentsToday.slice(0, 6).map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
                      <div className="text-sm">
                        <div className="font-semibold text-gray-900">
                          {p.type === 'monthly' ? 'Mensualidad' : p.type === 'single_class' ? 'Clase suelta' : 'Otro'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{methodLabel(p.method)}</div>
                      </div>
                      <div className="font-semibold text-emerald-600">{fmtCLP.format(Number(p.amount || 0))}</div>
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
          <div className="space-y-6">
            <section className="rounded-2xl border p-5 bg-gradient-to-b from-amber-50 to-white">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Alertas</h2>
              <div className="space-y-3 text-sm">
                {/* Pagos pendientes */}
                <div className="p-3 rounded-lg border bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">Pagos pendientes</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-500 text-white font-semibold">
                      {alerts.pendingCount}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">{alerts.pendingPreview.slice(0,3).join(', ') || '-'}</div>
                </div>

                {/* Renovaciones proximas */}
                <div className="p-3 rounded-lg border bg-white">
                  <div className="font-medium text-gray-900 mb-2">Renovaciones proximas (7 dias)</div>
                  {alerts.soonEnd.length === 0 ? (
                    <div className="text-xs text-gray-500">Sin vencimientos proximos.</div>
                  ) : (
                    <ul className="space-y-2">
                      {alerts.soonEnd.slice(0, 4).map((r, i) => (
                        <li key={i} className="text-xs">
                          <div className="font-medium text-gray-900 truncate">{r.student}</div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-gray-600 truncate">{r.course}</span>
                            <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-medium whitespace-nowrap">
                              {r.renewal_date}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {alerts.soonEnd.length > 4 && (
                    <div className="text-xs text-gray-500 mt-2">y {alerts.soonEnd.length - 4} mas...</div>
                  )}
                </div>

                {/* Cumpleanos */}
                <div className="p-3 rounded-lg border bg-white">
                  <div className="font-medium text-gray-900 mb-2">Cumpleaños hoy</div>
                  {alerts.birthdays.length === 0 ? (
                    <div className="text-xs text-gray-500">-</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {alerts.birthdays.slice(0,3).map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200"
                        >
                          <FaBirthdayCake className="text-pink-500" />
                          <span className="truncate max-w-[120px]">{name}</span>
                        </span>
                      ))}
                      {alerts.birthdays.length > 3 && (
                        <span className="text-[11px] text-pink-600 font-medium">
                          +{alerts.birthdays.length - 3} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border p-5 bg-gradient-to-b from-violet-50 to-white">
              <h2 className="text-base font-semibold text-gray-900">Asistencias (30 dias)</h2>
              <div className="mt-2 text-3xl font-semibold text-gray-900">{attendances30d}</div>
              <div className="text-xs text-gray-500 mt-1">Suma de asistencias registradas</div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border p-4 bg-gradient-to-b from-gray-50 to-white">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}

