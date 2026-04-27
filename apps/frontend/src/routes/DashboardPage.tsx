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
  HiOutlineCurrencyDollar,
  HiOutlineOfficeBuilding,
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
    start_time?: string | null
    end_time?: string | null
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

  const [summary, setSummary] = useState<any>(null)

  const load = async () => {
    if (tenantId == null) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/pms/dashboard/summary')
      setSummary(res.data)
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [tenantId])

  const { label: todayLabel } = dayInfoInTZ(CL_TZ)

  const kpis = summary?.kpis
  const classesToday = summary?.classes_today || []
  const paymentsRecent = summary?.recent_payments || []
  const alerts = summary?.alerts || { pending_count: 0, birthdays: [], soon_end: [] }
  const attendances30d = summary?.attendance_30d || 0
  const revByMethod = kpis?.revenue_by_method || {}

  const kpiData = [
    { label: 'Alumnos activos', value: kpis?.active_students || 0, icon: <HiUserGroup className="text-blue-600" /> },
    { label: 'Cursos activos', value: kpis?.active_courses || 0, icon: <HiBookOpen className="text-indigo-600" /> },
    { label: 'Ingresos hoy', value: fmtCLP.format(kpis?.revenue_today || 0), icon: <HiOutlineCurrencyDollar className="text-emerald-600" /> },
    { label: 'Ingresos mes', value: fmtCLP.format(kpis?.revenue_month || 0), icon: <HiRefresh className="text-purple-600" /> },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Panel de Control</h1>
          <p className="text-slate-500 font-medium">Bienvenido de nuevo. Aquí tienes un resumen de hoy, {todayLabel}.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={load} 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
          >
            <HiRefresh className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <Link 
            to="/payments" 
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <HiOutlineCurrencyDollar className="text-lg" />
            Registrar Pago
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-3 text-sm font-semibold">
          <HiExclamationCircle className="text-xl" />
          {error}
        </div>
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((k, idx) => (
          <KpiCard key={idx} label={k.label} value={k.value} icon={k.icon} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="xl:col-span-8 space-y-8">
          {/* Clases de hoy */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <HiBookOpen className="text-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Clases de hoy</h2>
                  <p className="text-xs text-slate-500 font-medium">{classesToday.length} sesiones programadas</p>
                </div>
              </div>
              <Link to="/calendar" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors">Ver Calendario</Link>
            </div>
            
            <div className="p-8">
              {classesToday.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <HiClock className="text-5xl mb-4 opacity-20" />
                  <p className="font-semibold italic">No hay clases programadas para hoy.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {classesToday.map(c => (
                    <div key={c.id} className="group p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all duration-300 flex gap-4 items-center cursor-pointer">
                      <div className="relative flex-shrink-0">
                        {c.image_url ? (
                          <img src={toAbsoluteUrl(c.image_url)} alt={c.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-sm" />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white flex items-center justify-center text-slate-400 text-2xl shadow-sm">
                            <HiBookOpen />
                          </div>
                        )}
                        {c.level && (
                          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider shadow-lg">
                            {c.level}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{c.name}</h3>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <HiClock className="text-indigo-500 text-sm" />
                            <span className="bg-white px-2 py-0.5 rounded-md border border-slate-100">
                              {(c.start_time || '').slice(0, 5)} - {(c.end_time || '').slice(0, 5)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mt-1">
                            <HiUserGroup className="text-slate-400 text-sm" />
                            <span className="truncate">{c.teacher_name || 'Sin profesor'}</span>
                          </div>
                          {c.room_name && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wide">
                              <HiOutlineOfficeBuilding className="text-sm" />
                              <span>SALA {c.room_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Pagos Recientes */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <HiOutlineCurrencyDollar className="text-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">Actividad de Pagos</h2>
                  <p className="text-xs text-slate-500 font-medium">Últimos movimientos del día</p>
                </div>
              </div>
              <Link to="/payments" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors">Ver todos</Link>
            </div>

            <div className="p-8">
              {paymentsRecent.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-medium italic text-sm">Sin pagos registrados recientemente.</div>
              ) : (
                <div className="space-y-3">
                  {paymentsRecent.slice(0, 6).map((p: any) => (
                    <div key={p.id} className="p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all flex items-center justify-between gap-4 group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                          {p.method?.[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {p.course_name || p.reference || 'Concepto Vario'}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {methodLabel[p.method] || p.method}
                             </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-black text-slate-900">{fmtCLP.format(Number(p.amount || 0))}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1">{(p.payment_date || '').split('-').reverse().join('/')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen por método */}
              <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-3 gap-4">
                {['cash', 'card', 'transfer'].map(m => (
                  <div key={m} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">{methodLabel[m] || m}</div>
                    <div className="text-base font-black text-slate-900">{fmtCLP.format(revByMethod[m] || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="xl:col-span-4 space-y-8">
          {/* Alertas y Notificaciones */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-6 border-b border-slate-100 flex items-center gap-3">
              <HiExclamationCircle className="text-rose-500 text-2xl" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Alertas Críticas</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Pagos pendientes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <HiUserGroup className="text-rose-400 text-sm" />
                    <span>Pendientes</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 text-[10px] font-black">{alerts.pending_count}</span>
                </div>
                {!alerts.pending_preview || alerts.pending_preview.length === 0 ? (
                   <p className="text-xs text-slate-400 italic">No hay pagos pendientes.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.pending_preview.map((p: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl bg-rose-50/50 border border-rose-100/50">
                        <div className="text-xs font-bold text-slate-900">{p.student}</div>
                        <div className="text-[10px] font-bold text-rose-600 mt-0.5">{p.course}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Renovaciones proximas */}
              <div className="space-y-3 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                  <HiRefresh className="text-amber-400 text-sm" />
                  <span>Vencimientos (7d)</span>
                </div>
                {!alerts.soon_end || alerts.soon_end.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Sin renovaciones próximas.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.soon_end.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-3 group">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{r.student}</div>
                          <div className="text-[10px] font-bold text-slate-500 truncate">{r.course}</div>
                        </div>
                        <div className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black tabular-nums">
                          {r.renewal_date.split('-').reverse().slice(0,2).join('/')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cumpleaños y Aniversarios */}
              <div className="grid grid-cols-1 gap-4 pt-6 border-t border-slate-50">
                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <FaBirthdayCake className="text-pink-400" />
                    <span>Cumpleaños</span>
                  </div>
                  {alerts.birthdays.length === 0 ? <p className="text-[10px] text-slate-400 italic">Hoy nadie cumple.</p> : (
                    <div className="flex flex-wrap gap-1.5">
                      {alerts.birthdays.map((n, i) => (
                        <span key={i} className="px-2 py-1 rounded-lg bg-pink-50 text-pink-700 text-[10px] font-black border border-pink-100">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Estadísticas rápidas */}
          <section className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
                  <HiSparkles className="text-indigo-300" />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Asistencias 30D</h2>
              </div>
              <div>
                <div className="text-4xl font-black text-white tracking-tight">{attendances30d}</div>
                <p className="text-slate-400 text-[11px] font-bold mt-1 uppercase tracking-wider">Total registros mensuales</p>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-4">
                <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" style={{ width: `${Math.min(100, (attendances30d/500)*100)}%` }} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-50 transition-colors" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-2xl text-slate-600 transition-all duration-300 shadow-inner">
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</div>
          <div className="text-2xl font-black text-slate-900 tracking-tight group-hover:translate-x-1 transition-transform">{value}</div>
        </div>
      </div>
    </div>
  )
}

