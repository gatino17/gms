import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineArrowLeft,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineCash,
  HiOutlineCreditCard,
  HiOutlineSwitchHorizontal,
  HiOutlineCheckCircle,
  HiOutlineBookOpen,
  HiOutlineUser,
  HiOutlineFilter,
  HiOutlineUserGroup,
  HiOutlineChartBar
} from 'react-icons/hi'

type Payment = {
  id: number
  course_id?: number | null
  student_id?: number | null
  amount: number
  method: 'cash' | 'card' | 'transfer' | 'agreement' | string
  type?: 'monthly' | 'single_class' | 'rental' | 'agreement' | string
  notes?: string | null
  payment_date: string
  student_name?: string | null
  period_start?: string | null
  period_end?: string | null
}
type CourseRef = {
  id: number; name: string; teacher_name?: string | null
  day_of_week?: number | null; start_time?: string | null; end_time?: string | null;
}
type StudentRef = { id: number; name: string }
type Enrollment = { id: number; student_id: number; course_id: number; start_date: string; end_date?: string | null; is_active: boolean }

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })

// --- Utils ---
function toYMDInTZ(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: CL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function toDDMMYYYY(ymd?: string) { return ymd ? ymd.split('-').reverse().join('-') : '' }
function daysInMonth(year: number, month0: number) { return new Date(year, month0 + 1, 0).getDate() }
function monthRangeFor(date = new Date()) {
  const y = date.getFullYear(); const m = date.getMonth()
  return { start: toYMDInTZ(new Date(y, m, 1)), end: toYMDInTZ(new Date(y, m + 1, 0)) }
}
function cycleFromMonth(yyyy_mm: string, anchorDay: number) {
  const [ys, ms] = yyyy_mm.split('-'); const y = +ys; const m = +ms
  const startDay = Math.min(anchorDay, daysInMonth(y, m - 1))
  const start = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const nextDate = new Date(y, m, 1); const ny = nextDate.getFullYear(); const nm = nextDate.getMonth() + 1
  const endDay = Math.min(anchorDay - 1, daysInMonth(ny, nm - 1))
  const end = `${ny}-${String(nm).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  return { start, end }
}

const methodLabel = (m: string) => ({
  efectivo: 'Efectivo', cash: 'Efectivo',
  debito: 'Débito', credito: 'Crédito', card: 'Tarjeta',
  transferencia: 'Transferencia', transfer: 'Transferencia',
  convenio: 'Convenio', agreement: 'Convenio'
}[m] || m)

export default function PaymentsTeachers() {
  const { tenantId } = useTenant()
  const [payments, setPayments] = useState<Payment[]>([])
  const [courses, setCourses] = useState<Record<number, CourseRef>>({})
  const [students, setStudents] = useState<Record<number, StudentRef>>({})
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [byTeacher, setByTeacher] = useState<any[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teacher, setTeacher] = useState<string>('')

  const todayYMD = useMemo(() => toYMDInTZ(new Date()), [])
  const [dateFrom, setDateFrom] = useState(todayYMD)
  const [dateTo, setDateTo] = useState(todayYMD)
  const [quickRange, setQuickRange] = useState('dia_hoy')
  const [pickMonth, setPickMonth] = useState('')
  const [cycleMonth, setCycleMonth] = useState('')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const payParams: any = { limit: 1000, offset: 0, date_from: dateFrom || undefined, date_to: dateTo || undefined }
      const [pres, cres, sres, eres, tres] = await Promise.all([
        api.get('/api/pms/payments', { params: payParams }),
        api.get('/api/pms/courses', { params: { limit: 500 } }),
        api.get('/api/pms/students', { params: { limit: 1000 } }),
        api.get('/api/pms/enrollments'),
        api.get('/api/pms/payments/by_teacher', { params: payParams }),
      ])

      setPayments(pres.data.items || pres.data || [])
      setByTeacher(tres.data.items || tres.data || [])

      const cMap: Record<number, CourseRef> = {}
      for (const c of (cres.data.items || cres.data)) cMap[c.id] = c
      setCourses(cMap)

      const sMap: Record<number, StudentRef> = {}
      for (const s of (sres.data.items || sres.data)) sMap[s.id] = { id: s.id, name: `${s.first_name} ${s.last_name}`.trim() }
      setStudents(sMap)

      setEnrollments(eres.data || [])
    } catch (e: any) {
      const detail = e.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (typeof detail === 'object' ? JSON.stringify(detail) : e.message || 'Error cargando datos'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId, dateFrom, dateTo])

  const applyQuickRange = (val: string) => {
    setQuickRange(val)
    if (val === 'todo') { setDateFrom(''); setDateTo('') }
    else if (val === 'dia_hoy') { setDateFrom(todayYMD); setDateTo(todayYMD) }
    else if (val === 'mes_actual') { const { start, end } = monthRangeFor(); setDateFrom(start); setDateTo(end) }
  }

  const enriched = useMemo(() => {
    return payments.map(p => {
      const c = p.course_id ? courses[p.course_id] : null
      const teacherName = c?.teacher_name || 'Sin profesor'
      const courseName = c?.name || '-'
      const studentName = p.student_name || (p.student_id ? (students[p.student_id]?.name || '-') : '-')
      return { ...p, teacherName, courseName, studentName }
    })
  }, [payments, courses, students])

  const teachers = useMemo(() => {
    const set = new Set<string>()
    enriched.forEach(p => set.add(p.teacherName))
    return Array.from(set).filter(t => t !== 'Sin profesor').sort((a, b) => a.localeCompare(b))
  }, [enriched])

  const selectedAgg = useMemo(() => byTeacher.find(t => (t.teacher_name || t.teacher) === teacher), [byTeacher, teacher])

  const detailedRows = useMemo(() => {
    if (!teacher) return []
    return enriched.filter(p => p.teacherName === teacher).sort((a, b) => b.id - a.id)
  }, [enriched, teacher])

  const totalPages = Math.ceil(detailedRows.length / pageSize)
  const safePage = Math.min(Math.max(1, page), totalPages || 1)
  const pageRows = useMemo(() => detailedRows.slice((safePage - 1) * pageSize, safePage * pageSize), [detailedRows, safePage, pageSize])

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4 md:px-0">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
            <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
              <HiOutlineArrowLeft size={20} />
            </button>
            <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Finanzas</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Pagos Profesores</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">Ingresos y participación por docente.</p>
        </div>
      </div>

      {/* Stats for Selected Teacher */}
      {teacher && selectedAgg && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 px-4">
          {[
            { label: `Total`, value: selectedAgg.total, icon: HiOutlineCurrencyDollar, classes: 'bg-fuchsia-50 text-fuchsia-600' },
            { label: 'Efectivo', value: selectedAgg.cash, icon: HiOutlineCash, classes: 'bg-emerald-50 text-emerald-600' },
            { label: 'Tarjeta', value: selectedAgg.card, icon: HiOutlineCreditCard, classes: 'bg-sky-50 text-sky-600' },
            { label: 'Transf.', value: selectedAgg.transfer, icon: HiOutlineSwitchHorizontal, classes: 'bg-indigo-50 text-indigo-600' },
            { label: 'Convenio', value: selectedAgg.agreement, icon: HiOutlineCheckCircle, classes: 'bg-amber-50 text-amber-600' },
          ].map((s, i) => (
            <div key={i} className={`bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm group hover:border-fuchsia-100 transition-all ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <div className={`p-2.5 w-9 h-9 md:w-10 md:h-10 rounded-xl ${s.classes} mb-2 md:mb-3 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <s.icon size={20} />
              </div>
              <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{s.label}</div>
              <div className="text-base md:text-xl font-black text-gray-900 truncate">{fmtCLP.format(Number(s.value || 0))}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 md:p-8 md:rounded-[40px] border-y md:border border-gray-100 shadow-sm space-y-6 md:space-y-8 mx-0 md:mx-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 items-end">
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Rango</label>
            <div className="relative">
              <HiOutlineFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={quickRange}
                onChange={e => applyQuickRange(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
              >
                <option value="todo">Ver Todo</option>
                <option value="dia_hoy">Hoy</option>
                <option value="mes_actual">Mes Actual</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
          </div>
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Desde</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setQuickRange('personalizado') }} className="w-full px-4 py-3 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
          </div>
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Hasta</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setQuickRange('personalizado') }} className="w-full px-4 py-3 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
          </div>
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Profesor</label>
            <div className="relative">
              <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={teacher} onChange={e => setTeacher(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none">
                <option value="">Todos los Profesores</option>
                {teachers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
            <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando caja...</span>
          </div>
        )}

        {error && <div className="p-10 text-center text-rose-500 font-bold">{error}</div>}

        {!teacher ? (
          <div className="p-4 md:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {byTeacher.map((t, idx) => (
              <div key={idx} className="bg-gray-50 p-6 rounded-3xl border border-transparent hover:border-fuchsia-200 hover:bg-white transition-all group cursor-pointer" onClick={() => setTeacher(t.teacher_name || t.teacher)}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center font-black text-xl shrink-0">
                    {(t.teacher_name || t.teacher)?.[0] || 'P'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-black text-gray-900 truncate group-hover:text-fuchsia-600 transition-colors">{t.teacher_name || t.teacher}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resumen</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Generado</span>
                    <span className="text-lg font-black text-gray-900">{fmtCLP.format(Number(t.total || 0))}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/50">
                    <div className="text-[9px] font-bold text-gray-500 flex items-center gap-1.5 truncate"><span className="shrink-0">💵</span> {fmtCLP.format(Number(t.cash || 0))}</div>
                    <div className="text-[9px] font-bold text-gray-500 flex items-center gap-1.5 truncate"><span className="shrink-0">💳</span> {fmtCLP.format(Number(t.card || 0))}</div>
                    <div className="text-[9px] font-bold text-gray-500 flex items-center gap-1.5 truncate"><span className="shrink-0">🔄</span> {fmtCLP.format(Number(t.transfer || 0))}</div>
                    <div className="text-[9px] font-bold text-gray-500 flex items-center gap-1.5 truncate"><span className="shrink-0">🤝</span> {fmtCLP.format(Number(t.agreement || 0))}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="hidden md:table-header-group">
                <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumno / Curso</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Método</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Periodo</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 block md:table-row-group">
                {pageRows.map((r, i) => (
                  <tr key={i} className="block md:table-row hover:bg-fuchsia-50/20 transition-colors group">
                    <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6">
                      <div className="flex md:block items-center justify-between">
                        <div className="text-sm font-black text-gray-900">{toDDMMYYYY(r.payment_date)}</div>
                        <div className="text-[10px] font-bold text-gray-400">ID #{r.id}</div>
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6">
                      <div className="font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors truncate">{r.studentName}</div>
                      <div className="text-xs font-bold text-gray-500 truncate">{r.courseName}</div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${(r.method === 'efectivo' || r.method === 'cash') ? 'bg-emerald-50 text-emerald-600' :
                        (r.method === 'debito' || r.method === 'credito' || r.method === 'card') ? 'bg-sky-50 text-sky-600' :
                          (r.method === 'transferencia' || r.method === 'transfer') ? 'bg-indigo-50 text-indigo-600' :
                            'bg-amber-50 text-amber-600'
                        }`}>
                        {methodLabel(r.method)}
                      </span>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6">
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {r.period_start && r.period_end ? `${toDDMMYYYY(r.period_start)} - ${toDDMMYYYY(r.period_end)}` : '---'}
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-left md:text-right">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Monto</div>
                      <div className="text-base md:text-lg font-black text-gray-900">{fmtCLP.format(r.amount)}</div>
                    </td>
                    <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6">
                      <div className="text-[10px] text-gray-400 font-medium italic line-clamp-1">{r.notes || '-'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 md:px-8 py-4 md:py-6 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Página {safePage} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={safePage === 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:text-fuchsia-600 transition-all">
                    <HiOutlineChevronLeft size={24} />
                  </button>
                  <button disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:text-fuchsia-600 transition-all">
                    <HiOutlineChevronRight size={24} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
