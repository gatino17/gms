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
  HiOutlineArrowRight,
  HiOutlineTrendingUp
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

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

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

const methodLabel: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
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

  useEffect(() => { load() }, [tenantId])

  const { label: todayLabel } = dayInfoInTZ(CL_TZ)
  const kpis = summary?.kpis
  const classesToday = summary?.classes_today || []
  const paymentsRecent = summary?.recent_payments || []
  const alerts = summary?.alerts || { pending_count: 0, birthdays: [], soon_end: [] }
  const attendances30d = summary?.attendance_30d || 0
  const revByMethod = kpis?.revenue_by_method || {}

  const kpiData = [
    { label: 'Alumnos activos', value: kpis?.active_students || 0, icon: <HiUserGroup />, color: 'fuchsia' },
    { label: 'Cursos activos', value: kpis?.active_courses || 0, icon: <HiBookOpen />, color: 'purple' },
    { label: 'Ingresos hoy', value: fmtCLP.format(kpis?.revenue_today || 0), icon: <HiOutlineCurrencyDollar />, color: 'emerald' },
    { label: 'Ingresos mes', value: fmtCLP.format(kpis?.revenue_month || 0), icon: <HiOutlineTrendingUp />, color: 'indigo' },
  ]

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Resumen General</span>
             <div className="h-1 w-1 rounded-full bg-gray-300" />
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{todayLabel}</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Panel de Control</h1>
          <p className="text-gray-500 font-medium">Bienvenido. Aquí tienes el pulso de tu academia hoy.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={load} 
            className="flex items-center gap-2 px-6 py-3.5 rounded-[20px] bg-white text-gray-600 font-black text-xs uppercase tracking-widest border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            <HiRefresh className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <Link 
            to="/payments" 
            className="flex items-center gap-2 px-8 py-3.5 rounded-[20px] bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-fuchsia-200 hover:scale-[1.02] transition-all active:scale-95"
          >
            <HiOutlineCurrencyDollar className="text-lg" />
            Nuevo Pago
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-6 rounded-[32px] bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-4 text-sm font-bold animate-in shake duration-500">
          <HiExclamationCircle className="text-2xl" />
          {error}
        </div>
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((k, idx) => (
          <div key={idx} className="group bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm hover:shadow-2xl hover:border-fuchsia-100 transition-all duration-500 relative overflow-hidden">
            <div className="relative flex flex-col gap-6">
              <div className={`w-14 h-14 rounded-2xl bg-${k.color}-50 text-${k.color}-600 flex items-center justify-center text-2xl transition-all duration-500 group-hover:scale-110`}>
                {k.icon}
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{k.label}</div>
                <div className="text-3xl font-black text-gray-900 tracking-tight">{k.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="xl:col-span-8 space-y-8">
          {/* Clases de hoy */}
          <section className="bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
                  <HiCalendar className="text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Clases de hoy</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{classesToday.length} Sesiones</p>
                </div>
              </div>
              <Link to="/calendar" className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest hover:text-fuchsia-700 transition-colors bg-fuchsia-50 px-4 py-2 rounded-full">Ver Calendario</Link>
            </div>
            
            <div className="p-10">
              {classesToday.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                  <HiClock className="text-6xl mb-4 opacity-20" />
                  <p className="font-black uppercase tracking-[0.2em] text-xs">No hay clases para hoy</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  {classesToday.map(c => (
                    <div key={c.id} className="group p-6 rounded-[32px] border border-gray-50 bg-gray-50/30 hover:bg-white hover:border-fuchsia-200 hover:shadow-xl transition-all duration-500 flex gap-6 items-center cursor-pointer">
                      <div className="relative flex-shrink-0">
                        {c.image_url ? (
                          <img src={toAbsoluteUrl(c.image_url)} alt={c.name} className="w-24 h-24 rounded-[28px] object-cover border-4 border-white shadow-lg" />
                        ) : (
                          <div className="w-24 h-24 rounded-[28px] bg-gradient-to-br from-gray-100 to-gray-200 border-4 border-white flex items-center justify-center text-gray-400 text-3xl shadow-lg">
                            {c.name[0]}
                          </div>
                        )}
                        {c.level && (
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest shadow-xl">
                            {c.level}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2">
                          <h3 className="text-lg font-black text-gray-900 truncate group-hover:text-fuchsia-600 transition-colors leading-tight">{c.name}</h3>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                            <span className="bg-white px-3 py-1 rounded-lg border border-gray-100 text-fuchsia-600 font-black">
                              {(c.start_time || '').slice(0, 5)}
                            </span>
                            <span className="text-gray-300 font-normal">a</span>
                            <span className="bg-white px-3 py-1 rounded-lg border border-gray-100 text-gray-600 font-black">
                              {(c.end_time || '').slice(0, 5)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            <HiUserGroup size={14} className="text-fuchsia-400" />
                            <span className="truncate">{c.teacher_name || 'Sin profesor'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Pagos Recientes */}
          <section className="bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <HiOutlineCurrencyDollar className="text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Actividad Reciente</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Finanzas</p>
                </div>
              </div>
              <Link to="/payments" className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors bg-emerald-50 px-4 py-2 rounded-full">Ver Detalles</Link>
            </div>

            <div className="p-10">
              {paymentsRecent.length === 0 ? (
                <div className="text-center py-10 text-gray-300 font-black uppercase tracking-widest text-xs italic">Sin movimientos recientes</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {paymentsRecent.slice(0, 6).map((p: any) => (
                    <div key={p.id} className="p-5 rounded-[24px] border border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/20 transition-all flex items-center justify-between gap-6 group">
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 text-emerald-600 flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-110 transition-transform">
                          {p.method?.[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                            {p.course_name || p.reference || 'Concepto Vario'}
                          </div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                             {methodLabel[p.method] || p.method}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-black text-gray-900">{fmtCLP.format(Number(p.amount || 0))}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{(p.payment_date || '').split('-').reverse().join('/')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen por método */}
              <div className="mt-10 pt-10 border-t border-gray-100 grid grid-cols-3 gap-6">
                {['cash', 'card', 'transfer'].map(m => (
                  <div key={m} className="p-6 rounded-[24px] bg-gray-50/50 border border-gray-50 text-center group hover:bg-white hover:border-emerald-100 transition-all">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">{methodLabel[m] || m}</div>
                    <div className="text-xl font-black text-gray-900">{fmtCLP.format(revByMethod[m] || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="xl:col-span-4 space-y-8">
          {/* Alertas */}
          <section className="bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-8 border-b border-gray-50 flex items-center gap-4 bg-gray-50/30">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                 <HiExclamationCircle className="text-2xl" />
              </div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Alertas</h2>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Pagos pendientes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pendientes</div>
                  <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-lg shadow-rose-100">{alerts.pending_count}</span>
                </div>
                {!alerts.pending_preview || alerts.pending_preview.length === 0 ? (
                   <p className="text-xs text-gray-400 italic text-center py-4">Todo al día</p>
                ) : (
                  <div className="space-y-3">
                    {alerts.pending_preview.map((p: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-2xl bg-rose-50/30 border border-rose-100/30 flex items-center justify-between group cursor-pointer hover:bg-rose-50 transition-all">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-gray-900 truncate">{p.student}</div>
                          <div className="text-[10px] font-bold text-rose-600/70 mt-0.5 truncate uppercase tracking-widest">{p.course}</div>
                        </div>
                        <HiOutlineArrowRight className="text-rose-400 opacity-0 group-hover:opacity-100 transition-all" size={14} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Renovaciones */}
              <div className="space-y-4 pt-8 border-t border-gray-50">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">Vencimientos (7d)</div>
                {!alerts.soon_end || alerts.soon_end.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">Sin vencimientos próximos</p>
                ) : (
                  <div className="space-y-3">
                    {alerts.soon_end.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all group">
                        <div className="min-w-0">
                          <div className="text-xs font-black text-gray-900 truncate">{r.student}</div>
                          <div className="text-[10px] font-bold text-gray-400 truncate uppercase tracking-widest mt-0.5">{r.course}</div>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-[10px] font-black tabular-nums group-hover:bg-fuchsia-100 group-hover:text-fuchsia-600 transition-colors">
                          {r.renewal_date.split('-').reverse().slice(0,2).join('/')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cumpleaños */}
              <div className="pt-8 border-t border-gray-50 space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2">
                  <FaBirthdayCake className="text-pink-400" />
                  <span>Hoy cumplen</span>
                </div>
                {alerts.birthdays.length === 0 ? <p className="text-xs text-gray-400 italic text-center py-2">Nadie cumple hoy</p> : (
                  <div className="flex flex-wrap gap-2 px-1">
                    {alerts.birthdays.map((n, i) => (
                      <span key={i} className="px-4 py-2 rounded-xl bg-pink-50 text-pink-700 text-[10px] font-black border border-pink-100 animate-bounce" style={{ animationDelay: `${i*100}ms`, animationIterationCount: 1 }}>{n} 🎂</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Estadísticas 30D */}
          <section className="bg-gray-900 rounded-[48px] p-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-fuchsia-500/20 rounded-full -mr-20 -mt-20 blur-[60px] group-hover:bg-fuchsia-500/30 transition-all" />
            <div className="relative space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <HiSparkles className="text-fuchsia-400 text-xl" />
                </div>
                <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Asistencias 30D</h2>
              </div>
              <div>
                <div className="text-5xl font-black text-white tracking-tight leading-none">{attendances30d}</div>
                <p className="text-gray-400 text-[10px] font-black mt-3 uppercase tracking-widest">Total registros mensuales</p>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mt-6">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, (attendances30d/500)*100)}%` }} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
