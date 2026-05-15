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

const toDDMMYYYY = (d?: string | null) => {
  if (!d) return '--/--'
  const parts = d.split('T')[0].split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3">
             <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Resumen</span>
             <div className="h-1 w-1 rounded-full bg-gray-300" />
             <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">{todayLabel}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Panel de Control</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">Bienvenido a tu gestión diaria.</p>
        </div>
        <div className="flex flex-col xs:flex-row items-center gap-3 md:gap-4 w-full sm:w-auto">
          <button 
            onClick={load} 
            className="w-full xs:flex-1 sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-gray-600 font-black text-[10px] md:text-xs uppercase tracking-widest border border-gray-100 shadow-sm hover:bg-gray-50 transition-all active:scale-95"
          >
            <HiRefresh className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-6 rounded-[32px] bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-4 text-sm font-bold animate-in shake duration-500">
          <HiExclamationCircle className="text-2xl" />
          {error}
        </div>
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4">
        {kpiData.map((k, idx) => (
          <div key={idx} className="group bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-5 border border-gray-100 shadow-sm hover:shadow-2xl hover:border-fuchsia-100 transition-all duration-500 relative overflow-hidden">
            <div className="relative flex items-center gap-4">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-${k.color}-50 text-${k.color}-600 flex items-center justify-center text-xl md:text-2xl transition-all duration-500 group-hover:scale-110 shrink-0`}>
                {k.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">{k.label}</div>
                <div className="text-lg md:text-2xl font-black text-gray-900 tracking-tight truncate leading-none mt-1">{k.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Main Column */}
        <div className="xl:col-span-8 space-y-6">
          {/* Clases de hoy */}
          <section className="bg-white md:rounded-[32px] border-y md:border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 md:px-8 py-5 md:py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center">
                  <HiCalendar className="text-xl md:text-2xl" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Clases de hoy</h2>
                  <p className="text-[9px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">{classesToday.length} Sesiones</p>
                </div>
              </div>
              <Link to="/calendar" className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest hover:text-fuchsia-700 transition-colors bg-fuchsia-50 px-3 md:px-4 py-2 rounded-full">Ver Todo</Link>
            </div>
            
            <div className="p-5 md:p-8">
              {classesToday.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                  <HiClock className="text-5xl mb-4 opacity-20" />
                  <p className="font-black uppercase tracking-widest text-[9px]">No hay clases hoy</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                  {classesToday.map((c: any) => (
                    <div key={c.id} className="group p-3 md:p-4 rounded-2xl md:rounded-[28px] border border-gray-50 bg-gray-50/30 hover:bg-white hover:border-fuchsia-200 hover:shadow-xl transition-all duration-500 flex gap-3 md:gap-4 items-center cursor-pointer">
                      <div className="relative flex-shrink-0">
                        {c.image_url ? (
                          <img src={toAbsoluteUrl(c.image_url)} alt={c.name} className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl object-cover border-2 md:border-3 border-white shadow-md" />
                        ) : (
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 border-2 md:border-3 border-white flex items-center justify-center text-gray-400 text-lg md:text-xl shadow-md">
                            {c.name[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 md:gap-2">
                          <h3 className="text-sm md:text-lg font-black text-gray-900 truncate group-hover:text-fuchsia-600 transition-colors leading-tight">{c.name}</h3>
                          <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-bold text-gray-500">
                            <span className="bg-white px-2 py-0.5 md:px-3 md:py-1 rounded-lg border border-gray-100 text-fuchsia-600 font-black">
                               {(c.start_time || '').slice(0, 5)}
                            </span>
                            <span className="text-gray-300">/</span>
                            <span className="bg-white px-2 py-0.5 md:px-3 md:py-1 rounded-lg border border-gray-100 text-gray-600 font-black">
                               {(c.end_time || '').slice(0, 5)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">
                            <HiUserGroup size={12} className="text-fuchsia-400" />
                            <span className="truncate">{c.teacher_name || 'Sin profesor'}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 pt-1 border-t border-gray-100/50">
                            <div className="flex items-center gap-1">
                               <span className="text-[10px] font-black text-gray-900">{c.total_students || 0}</span>
                               <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Tot</span>
                            </div>
                            <div className="flex items-center gap-1">
                               <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                               <span className="text-[10px] font-black text-pink-600">{c.female_students || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                               <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                               <span className="text-[10px] font-black text-blue-600">{c.male_students || 0}</span>
                            </div>
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
          <section className="bg-white md:rounded-[32px] border-y md:border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 md:px-8 py-5 md:py-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <HiOutlineCurrencyDollar className="text-xl md:text-2xl" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Actividad Reciente</h2>
                  <p className="text-[9px] md:text-xs text-gray-400 font-bold uppercase tracking-widest">Finanzas</p>
                </div>
              </div>
              <Link to="/payments" className="text-[9px] md:text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors bg-emerald-50 px-3 md:px-4 py-2 rounded-full">Ver Más</Link>
            </div>

            <div className="p-5 md:p-8">
              {paymentsRecent.length === 0 ? (
                <div className="text-center py-10 text-gray-300 font-black uppercase tracking-widest text-[10px] italic">Sin movimientos recientes</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:gap-4">
                  {paymentsRecent.slice(0, 6).map((p: any) => (
                    <div key={p.id} className="p-3 md:p-4 rounded-xl md:rounded-[20px] border border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/20 transition-all flex items-center justify-between gap-3 md:gap-4 group">
                      <div className="flex items-center gap-3 md:gap-5 min-w-0">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white border border-gray-100 text-emerald-600 flex items-center justify-center font-black text-xs md:text-sm shadow-sm group-hover:scale-110 transition-transform">
                          {p.method?.[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs md:text-sm font-black text-gray-900 group-hover:text-emerald-600 transition-colors truncate">
                            {p.course_name || p.reference || 'Concepto Vario'}
                          </div>
                          <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5 truncate">
                             {methodLabel[p.method] || p.method}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm md:text-lg font-black text-gray-900">{fmtCLP.format(Number(p.amount || 0))}</div>
                        <div className="text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{(p.payment_date || '').split('-').reverse().slice(0,2).join('/')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumen por método */}
              <div className="mt-8 md:mt-10 pt-8 md:pt-10 border-t border-gray-100 grid grid-cols-3 gap-3 md:gap-6">
                {['cash', 'card', 'transfer'].map(m => (
                  <div key={m} className="p-3 md:p-6 rounded-xl md:rounded-[24px] bg-gray-50/50 border border-gray-50 text-center group hover:bg-white hover:border-emerald-100 transition-all">
                    <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 md:mb-2 truncate">{methodLabel[m] || m}</div>
                    <div className="text-xs md:text-xl font-black text-gray-900 truncate">{fmtCLP.format(revByMethod[m] || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="xl:col-span-4 space-y-8">
          {/* Alertas */}
          <section className="bg-gradient-to-br from-rose-50/80 to-white rounded-[32px] border border-rose-100 shadow-xl shadow-rose-100/20 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-rose-500/10 transition-all" />
            
            <div className="px-6 py-6 border-b border-rose-100/50 flex items-center gap-4 bg-rose-100/20 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                 <HiExclamationCircle className="text-2xl" />
              </div>
              <div>
                 <h2 className="text-lg font-black text-rose-900 tracking-tight">Pendientes</h2>
                 <p className="text-[9px] font-bold text-rose-600/60 uppercase tracking-widest">Seguimiento</p>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Pagos pendientes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Pendientes</div>
                  <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black shadow-lg shadow-rose-200">{alerts.pending_count}</span>
                </div>
                {!alerts.pending_preview || alerts.pending_preview.length === 0 ? (
                   <p className="text-xs text-gray-400 italic text-center py-4">Todo al día</p>
                ) : (
                  <div className="space-y-3">
                    {alerts.pending_preview.map((p: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-2xl bg-rose-50/30 border border-rose-100/30 flex items-center justify-between group cursor-pointer hover:bg-rose-50 transition-all">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-gray-900 truncate">{p.student}</div>
                          <div className="text-[10px] font-bold text-rose-600/70 mt-0.5 truncate uppercase tracking-widest">{p.course}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="text-[9px] font-black text-rose-500 bg-rose-100/50 px-2 py-0.5 rounded-lg">
                            Venció: {toDDMMYYYY(p.end_date)}
                          </div>
                          <HiOutlineArrowRight className="text-rose-400 opacity-0 group-hover:opacity-100 transition-all" size={12} />
                        </div>
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

            </div>
          </section>

          {/* Cumpleaños */}
          <section className="bg-gradient-to-br from-pink-50 to-white rounded-[32px] border border-pink-100 shadow-xl shadow-pink-100/20 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-pink-500/10 transition-all" />
            
            <div className="px-6 py-6 border-b border-pink-100/50 flex items-center gap-4 bg-pink-100/20 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center shadow-lg shadow-pink-200">
                 <FaBirthdayCake className="text-xl" />
              </div>
              <div>
                 <h2 className="text-lg font-black text-pink-900 tracking-tight">Cumpleaños</h2>
                 <p className="text-[9px] font-bold text-pink-600/60 uppercase tracking-widest">Celebraciones de hoy</p>
              </div>
            </div>

            <div className="p-6">
              {alerts.birthdays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-pink-300">
                   <p className="text-[10px] font-black uppercase tracking-widest italic">Nadie cumple hoy</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {alerts.birthdays.map((n: string, i: number) => (
                    <div key={i} className="px-4 py-3 rounded-2xl bg-white border border-pink-100 text-pink-700 text-xs font-black shadow-sm flex items-center gap-2 animate-in zoom-in duration-500" style={{ animationDelay: `${i*100}ms` }}>
                       <span className="text-base">🎂</span>
                       {n}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Estadísticas 30D */}
          <section className="bg-gray-900 md:rounded-[32px] p-6 md:p-8 shadow-2xl relative overflow-hidden group mx-4 md:mx-0">
            <div className="absolute top-0 right-0 w-32 md:w-40 h-32 md:h-40 bg-fuchsia-500/20 rounded-full -mr-16 -mt-16 md:-mr-20 md:-mt-20 blur-[40px] md:blur-[60px] group-hover:bg-fuchsia-500/30 transition-all" />
            <div className="relative space-y-4 md:space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <HiSparkles className="text-fuchsia-400 text-lg md:text-xl" />
                </div>
                <h2 className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em]">Asistencias 30D</h2>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">{attendances30d}</div>
                <p className="text-gray-400 text-[8px] md:text-[10px] font-black mt-2 md:mt-3 uppercase tracking-widest">Total registros mensuales</p>
              </div>
              <div className="h-1.5 md:h-2 w-full bg-white/10 rounded-full overflow-hidden mt-4 md:mt-6">
                <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-full shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all duration-1000" style={{ width: `${Math.min(100, (attendances30d/500)*100)}%` }} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
