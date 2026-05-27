import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import * as XLSX from 'xlsx'
import { 
  HiOutlineSearch, 
  HiOutlineDownload, 
  HiOutlineFilter, 
  HiOutlineCalendar, 
  HiOutlineCash, 
  HiOutlineCreditCard, 
  HiOutlineSwitchHorizontal, 
  HiOutlineCheckCircle,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineTag,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineViewGrid,
  HiOutlineViewList,
  HiOutlineUserGroup,
  HiOutlineCurrencyDollar,
  HiOutlineArrowRight,
  HiOutlineX
} from 'react-icons/hi'
import EditPaymentModal from '../components/EditPaymentModal'

type Payment = {
  id: number
  student_id?: number | null
  course_id?: number | null
  student_name?: string | null
  course_name?: string | null
  teacher_name?: string | null
  amount: number
  method: string
  type: string
  reference?: string | null
  notes?: string | null
  payment_date: string
}

type PaymentStats = {
  total_amount: number
  cash_amount: number
  card_amount: number
  transfer_amount: number
  agreement_amount: number
}

type CourseRef = { id: number; name: string; teacher_name?: string | null; day_of_week?: number | null; start_time?: string | null }
type StudentRef = { id: number; name: string }
type Enrollment = { id: number; student_id: number; course_id: number; start_date: string; end_date?: string | null; is_active: boolean }

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const DN = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

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
function excelAmount(raw: any) {
  const n = Number(raw || 0)
  if (!Number.isFinite(n)) return 0
  return Number.isInteger(n) ? n : Number(n.toFixed(2))
}
function tenantInitials(name?: string | null) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return 'TEN'
  const initials = words.slice(0, 3).map(w => w[0]?.toUpperCase() || '').join('')
  return initials || 'TEN'
}
function historicCourseNameFromReference(reference?: string | null) {
  const ref = String(reference || '')
  const m = ref.match(/\[CursoHistorico:(.+?)\]/i)
  return m?.[1]?.trim() || ''
}
function historicTeacherFromReference(reference?: string | null) {
  const ref = String(reference || '')
  const m = ref.match(/\[ProfesorHistorico:(.+?)\]/i)
  return m?.[1]?.trim() || ''
}

type ViewMode = 'detalle' | 'resumen-diario' | 'resumen-profesor'

export default function PaymentsPage() {
  const { tenantId } = useTenant()
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Payment[]>([])
  const [courses, setCourses] = useState<Record<number, CourseRef>>({})
  const [students, setStudents] = useState<Record<number, StudentRef>>({})
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<PaymentStats>({ total_amount: 0, cash_amount: 0, card_amount: 0, transfer_amount: 0, agreement_amount: 0 })
  
  // Rango y Filtros
  const { todayYMD, monthStartYMD } = useMemo(() => {
    const d = new Date()
    return { 
      todayYMD: toYMDInTZ(d),
      monthStartYMD: toYMDInTZ(new Date(d.getFullYear(), d.getMonth(), 1))
    }
  }, [])

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [q, setQ] = useState('')
  const [fMethod, setFMethod] = useState('')
  const [fType, setFType] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)

  // Vista
  const [viewMode, setViewMode] = useState<ViewMode>('detalle')
  const [quickRange, setQuickRange] = useState('todo')

  // Modals
  const [editing, setEditing] = useState<Payment | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: q || undefined,
        method: fMethod || undefined,
        type: fType || undefined
      }

      const [pres, cres, sres, eres] = await Promise.all([
        api.get('/api/pms/payments', { params }),
        api.get('/api/pms/courses', { params: { limit: 500 } }),
        api.get('/api/pms/students', { params: { limit: 1000 } }),
        api.get('/api/pms/enrollments')
      ])

      if (pres.data && pres.data.items) {
        setData(pres.data.items)
        setTotalItems(pres.data.total)
        setStats(pres.data.stats)
      } else {
        // Fallback for old API format if somehow still active
        setData(Array.isArray(pres.data) ? pres.data : [])
        setTotalItems(Array.isArray(pres.data) ? pres.data.length : 0)
      }

      const cMap: Record<number, CourseRef> = {}
      const coursesData = cres.data.items || cres.data || []
      coursesData.forEach((c: any) => {
        cMap[c.id] = { id: c.id, name: c.name, teacher_name: c.teacher_name, day_of_week: c.day_of_week, start_time: c.start_time }
      })
      setCourses(cMap)

      const sMap: Record<number, StudentRef> = {}
      const studentsData = sres.data.items || sres.data || []
      studentsData.forEach((s: any) => {
        sMap[s.id] = { id: s.id, name: `${s.first_name} ${s.last_name}`.trim() }
      })
      setStudents(sMap)

      setEnrollments(eres.data || [])
    } catch (err: any) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : (typeof detail === 'object' ? JSON.stringify(detail) : err.message || 'Error al cargar datos de pagos'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId, page, pageSize, dateFrom, dateTo, fMethod, fType, reloadKey])

  // Debounced Search
  useEffect(() => {
    const id = setTimeout(() => {
      if (page !== 1) setPage(1)
      else load()
    }, 350)
    return () => clearTimeout(id)
  }, [q])

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar este pago permanentemente?')) {
      await api.delete(`/api/pms/payments/${id}`)
      setReloadKey(k => k + 1)
    }
  }

  const applyQuickRange = (val: string) => {
    setQuickRange(val)
    const d = new Date()
    if (val === 'todo') {
      setDateFrom(''); setDateTo('')
    } else if (val === 'dia_hoy') {
      const ymd = toYMDInTZ(d)
      setDateFrom(ymd); setDateTo(ymd)
    } else if (val === 'dia_ayer') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const ymd = toYMDInTZ(yesterday)
      setDateFrom(ymd); setDateTo(ymd)
    } else if (val === 'mes_actual') {
      const { start, end } = monthRangeFor(d)
      setDateFrom(start); setDateTo(end)
    } else if (val === 'mes_anterior') {
      const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const { start, end } = monthRangeFor(prevMonth)
      setDateFrom(start); setDateTo(end)
    }
  }

  const methodLabel = (m: string) => ({
    efectivo: 'Efectivo', cash: 'Efectivo',
    debito: 'Débito', credito: 'Crédito', card: 'Tarjeta',
    transferencia: 'Transferencia', transfer: 'Transferencia',
    convenio: 'Convenio', agreement: 'Convenio'
  }[m] || m)

  const typeLabel = (t: string) => ({
    monthly: 'Mensualidad',
    single_class: 'Clase suelta',
    rental: 'Arriendo',
    registration: 'Matrícula',
    agreement: 'Convenio',
    convenio: 'Convenio'
  }[t] || t)

  const registrationVariantLabel = (p: Payment) => {
    const ref = (p.reference || '').toLowerCase()
    const notes = (p.notes || '').toLowerCase()
    const joined = `${ref} ${notes}`
    if (joined.includes('anual')) return 'Matrícula anual'
    if (joined.includes('incorporación') || joined.includes('incorporacion')) return 'Matrícula incorporación'
    return 'Matrícula'
  }

  const findPeriod = (p: Payment) => {
    const directStart = (p as any).period_start as string | undefined
    const directEnd = (p as any).period_end as string | undefined
    if (directStart || directEnd) {
      return `${directStart ? toDDMMYYYY(directStart) : '---'} - ${directEnd ? toDDMMYYYY(directEnd) : 'Activo'}`
    }

    if (!p.student_id || !p.course_id) return ''
    const matches = enrollments.filter(e => e.student_id === p.student_id && e.course_id === p.course_id)
    const best = matches.find(e => p.payment_date >= e.start_date && (!e.end_date || p.payment_date <= e.end_date))
    return best ? `${toDDMMYYYY(best.start_date)} - ${best.end_date ? toDDMMYYYY(best.end_date) : 'Activo'}` : ''
  }

  const downloadExcel = async () => {
    try {
      const all: Payment[] = []
      let offset = 0
      const limit = 1000

      while (true) {
        const params: any = {
          limit,
          offset,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          q: q || undefined,
          method: fMethod || undefined,
          type: fType || undefined,
        }
        const res = await api.get('/api/pms/payments', { params })
        const chunk: Payment[] = res.data?.items || []
        all.push(...chunk)
        if (chunk.length < limit) break
        offset += limit
      }

      const exportRows = all.length ? all : visibleData
      if (!exportRows.length) {
        alert('No hay registros para exportar con los filtros actuales.')
        return
      }

      const toProfessorBucket = (p: Payment) =>
        (p.type === 'registration'
          ? 'Matrículas'
          : (p.teacher_name || (p.course_id && courses[p.course_id]?.teacher_name) || historicTeacherFromReference(p.reference) || 'Sin asignar'))

      const courseWithSchedule = (p: Payment) => {
        if (p.type === 'registration') return 'Matrícula'
        const historicName = historicCourseNameFromReference(p.reference)
        const courseName = p.course_name || (p.course_id && courses[p.course_id]?.name) || historicName || 'Gasto General'
        const courseRef = p.course_id ? courses[p.course_id] : undefined
        const dayIdx = courseRef?.day_of_week
        const time = (courseRef?.start_time || '').slice(0, 5)
        if (dayIdx === null || dayIdx === undefined || !time) return courseName
        const dayLabel = DN[dayIdx] || ''
        return dayLabel ? `${courseName} - ${dayLabel} ${time}` : courseName
      }

      const detalleData = exportRows.map(p => ({
      ID: p.id,
      Fecha: toDDMMYYYY(p.payment_date),
      Alumno: p.student_name || students[p.student_id!]?.name || '-',
      Curso: courseWithSchedule(p),
      Profesor: p.type === 'registration' ? '-' : (p.teacher_name || (p.course_id && courses[p.course_id]?.teacher_name) || historicTeacherFromReference(p.reference) || '-'),
      Periodo: findPeriod(p),
      Metodo: methodLabel(p.method),
      Tipo: typeLabel(p.type),
      Monto: excelAmount(p.amount),
      Referencia: p.reference || '',
      Notas: p.notes || ''
    }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(detalleData)
      XLSX.utils.book_append_sheet(wb, ws, 'Pagos')

      // Hoja resumen diario (por fecha y medio de pago)
      const dailyMap: Record<string, { Fecha: string; Efectivo: number; Debito: number; Transferencia: number; Convenio: number; Total: number }> = {}
      for (const p of exportRows) {
        const key = p.payment_date
        if (!dailyMap[key]) {
          dailyMap[key] = {
            Fecha: toDDMMYYYY(key),
            Efectivo: 0,
            Debito: 0,
            Transferencia: 0,
            Convenio: 0,
            Total: 0,
          }
        }
        const amt = excelAmount(p.amount)
        const m = (p.method || '').toLowerCase()
        if (m === 'efectivo' || m === 'cash') dailyMap[key].Efectivo += amt
        else if (m === 'debito' || m === 'credito' || m === 'card') dailyMap[key].Debito += amt
        else if (m === 'transferencia' || m === 'transfer') dailyMap[key].Transferencia += amt
        else dailyMap[key].Convenio += amt
        dailyMap[key].Total += amt
      }
      const resumenDiarioRows = Object.entries(dailyMap)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([, row]) => row)
      const wsResumenDiario = XLSX.utils.json_to_sheet(resumenDiarioRows)
      XLSX.utils.book_append_sheet(wb, wsResumenDiario, 'Resumen Diario')

      // Hoja por profesor (incluye Matrículas como bucket propio)
      const byProfessor: Record<string, any[]> = {}
      const summaryByProfessor: Record<string, { total: number; count: number; cash: number; card: number; transfer: number; agreement: number }> = {}
      for (const p of exportRows) {
        const bucket = toProfessorBucket(p)
        if (!byProfessor[bucket]) byProfessor[bucket] = []
        if (!summaryByProfessor[bucket]) summaryByProfessor[bucket] = { total: 0, count: 0, cash: 0, card: 0, transfer: 0, agreement: 0 }
        const amt = Number(p.amount || 0)
        const m = (p.method || '').toLowerCase()
        summaryByProfessor[bucket].total += Number(p.amount || 0)
        summaryByProfessor[bucket].count += 1
        if (m === 'efectivo' || m === 'cash') summaryByProfessor[bucket].cash += amt
        else if (m === 'debito' || m === 'credito' || m === 'card') summaryByProfessor[bucket].card += amt
        else if (m === 'transferencia' || m === 'transfer') summaryByProfessor[bucket].transfer += amt
        else summaryByProfessor[bucket].agreement += amt
        byProfessor[bucket].push({
          ID: p.id,
          Fecha: toDDMMYYYY(p.payment_date),
          Alumno: p.student_name || students[p.student_id!]?.name || '-',
          Curso: courseWithSchedule(p),
          Profesor: p.type === 'registration' ? '-' : (p.teacher_name || (p.course_id && courses[p.course_id]?.teacher_name) || historicTeacherFromReference(p.reference) || '-'),
          Periodo: findPeriod(p),
          Metodo: methodLabel(p.method),
          Tipo: typeLabel(p.type),
          Monto: excelAmount(p.amount),
          Referencia: p.reference || '',
          Notas: p.notes || ''
        })
      }

      const makeUniqueSheetName = (base: string, used: Set<string>) => {
        const safeBase = (base.replace(/[\\\/\?\*\[\]\:]/g, ' ').trim() || 'Sin asignar')
        let candidate = safeBase.slice(0, 31)
        let i = 2
        while (used.has(candidate)) {
          const suffix = ` (${i})`
          const head = safeBase.slice(0, Math.max(1, 31 - suffix.length))
          candidate = `${head}${suffix}`
          i += 1
        }
        used.add(candidate)
        return candidate
      }
      const usedSheetNames = new Set<string>(['Pagos', 'Resumen Responsables'])
      Object.entries(byProfessor).forEach(([teacherName, rows]) => {
        const rowsWithoutProfessor = rows.map(({ Profesor, ...rest }) => rest)
        const wsTeacher = XLSX.utils.json_to_sheet(rowsWithoutProfessor)
        const baseName = teacherName === 'Matrículas' ? 'Matrículas' : `Prof - ${teacherName}`
        const sheetName = makeUniqueSheetName(baseName, usedSheetNames)
        XLSX.utils.book_append_sheet(wb, wsTeacher, sheetName)
      })

      // Hoja resumen global por profesor + matrículas
      const resumenRows = Object.entries(summaryByProfessor)
        .map(([responsable, data]) => ({
          Responsable: responsable,
          Registros: data.count,
          Efectivo: data.cash,
          'Débito/Tarjeta': data.card,
          Transferencia: data.transfer,
          Convenio: data.agreement,
          Total: data.total,
        }))
        .sort((a, b) => b.Total - a.Total)
      const wsResumen = XLSX.utils.json_to_sheet(resumenRows)
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Responsables')

      // Orden final de hojas: Pagos, Resumen Diario, Resumen Responsables, resto
      const sheetOrder = wb.SheetNames || []
      const idxDiario = sheetOrder.indexOf('Resumen Diario')
      const idxResumen = sheetOrder.indexOf('Resumen Responsables')
      if (idxDiario >= 0) {
        sheetOrder.splice(idxDiario, 1)
        sheetOrder.splice(1, 0, 'Resumen Diario')
      }
      const currentIdxResumen = sheetOrder.indexOf('Resumen Responsables')
      if (currentIdxResumen >= 0) {
        sheetOrder.splice(currentIdxResumen, 1)
        sheetOrder.splice(2, 0, 'Resumen Responsables')
      }
      wb.SheetNames = sheetOrder

      const todayFileDate = toYMDInTZ(new Date())
      let tenantLabel = 'TEN'
      try {
        const tRes = await api.get('/api/pms/tenants/me')
        tenantLabel = tenantInitials(tRes.data?.name)
      } catch {
        tenantLabel = 'TEN'
      }
      XLSX.writeFile(wb, `${tenantLabel}_pagos_hoy_${todayFileDate}.xlsx`)
    } catch (e: any) {
      alert('No se pudo generar el Excel: ' + (e?.message || 'Error'))
    }
  }

  const totalPages = Math.ceil(totalItems / pageSize)

  const visibleData = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return data
    const tokens = query.split(/\s+/).filter(Boolean)
    return data.filter((p) => {
      const studentText = (p.student_name || students[p.student_id!]?.name || '').toLowerCase()
      const courseText = ((p as any).course_name || (p.course_id && courses[p.course_id]?.name) || '').toLowerCase()
      const target = `${studentText} ${courseText}`.trim()
      return tokens.every((t) => target.includes(t))
    })
  }, [data, q, students, courses])

  // --- Resúmenes para Tablas Secundarias ---
  // (Como ya cargamos solo lo paginado en 'data', para estos resúmenes necesitamos idealmente data completa. 
  // Pero para mantener la rapidez solicitada, usaremos lo que hay en 'data' o sugeriremos usar el Excel para el total real si hay mucha data.
  // Sin embargo, para que se vea Pro, calcularemos lo posible con los datos cargados.)

  const dailyRows = useMemo(() => {
    const map: Record<string, any> = {}
    visibleData.forEach(p => {
      const d = p.payment_date
      if (!map[d]) map[d] = { date: d, cash: 0, card: 0, transfer: 0, agreement: 0, total: 0 }
      
      const m = p.method
        const amt = excelAmount(p.amount)
      
      if (m === 'efectivo' || m === 'cash') map[d].cash += amt
      else if (m === 'debito' || m === 'credito' || m === 'card') map[d].card += amt
      else if (m === 'transferencia' || m === 'transfer') map[d].transfer += amt
      else map[d].agreement += amt
      
      map[d].total += amt
    })
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  }, [visibleData])

  const teacherRows = useMemo(() => {
    const map: Record<string, any> = {}
    visibleData.forEach(p => {
      const name =
        (p.type || '').toLowerCase() === 'registration'
          ? 'Matrícula'
          : (p.teacher_name || (p.course_id && courses[p.course_id]?.teacher_name) || historicTeacherFromReference(p.reference) || 'Sin asignar')
      if (!map[name]) map[name] = { name, cash: 0, card: 0, transfer: 0, agreement: 0, total: 0 }
      
      const m = p.method
      const amt = Number(p.amount || 0)
      if (m === 'efectivo' || m === 'cash') map[name].cash += amt
      else if (m === 'debito' || m === 'credito' || m === 'card') map[name].card += amt
      else if (m === 'transferencia' || m === 'transfer') map[name].transfer += amt
      else map[name].agreement += amt
      
      map[name].total += amt
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [visibleData, courses])

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4">
        <div className="space-y-1 text-center sm:text-left">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Caja y Pagos</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">Control financiero en tiempo real.</p>
        </div>
        <div className="flex flex-col xs:flex-row items-center gap-3 w-full sm:w-auto">
          <Link to="/payments-teachers" className="w-full xs:flex-1 sm:w-auto px-6 py-4 bg-white border-2 border-gray-100 text-gray-700 font-black rounded-2xl hover:border-fuchsia-200 hover:bg-fuchsia-50 transition-all flex items-center justify-center gap-2 text-[10px] md:text-sm uppercase tracking-widest">
            Profesores <HiOutlineArrowRight />
          </Link>
          <button 
            onClick={downloadExcel} 
            className="w-full xs:flex-1 sm:w-auto px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 text-[10px] md:text-sm uppercase tracking-widest"
          >
            <HiOutlineDownload size={20} /> Excel
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 font-bold flex items-center gap-3">
          <HiOutlineX className="shrink-0" /> {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 px-4">
        {[
          { label: 'Total', value: stats.total_amount, icon: HiOutlineCurrencyDollar, classes: 'bg-fuchsia-50 text-fuchsia-600' },
          { label: 'Efectivo', value: stats.cash_amount, icon: HiOutlineCash, classes: 'bg-emerald-50 text-emerald-600' },
          { label: 'Tarjeta', value: stats.card_amount, icon: HiOutlineCreditCard, classes: 'bg-sky-50 text-sky-600' },
          { label: 'Transf.', value: stats.transfer_amount, icon: HiOutlineSwitchHorizontal, classes: 'bg-indigo-50 text-indigo-600' },
          { label: 'Convenio', value: stats.agreement_amount, icon: HiOutlineCheckCircle, classes: 'bg-amber-50 text-amber-600' },
        ].map((s, i) => (
          <div key={i} className={`bg-white p-4 md:p-5 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm group hover:border-fuchsia-100 transition-all ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <div className={`p-2.5 w-9 h-9 md:w-10 md:h-10 rounded-xl ${s.classes} mb-2 md:mb-3 flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <s.icon size={20} />
            </div>
            <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</div>
            <div className="text-base md:text-xl font-black text-gray-900 truncate">{fmtCLP.format(Number(s.value || 0))}</div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="bg-white p-6 md:p-8 md:rounded-[40px] border-y md:border border-gray-100 shadow-sm space-y-6 md:space-y-8 mx-0 md:mx-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 items-end">
          {/* Quick Range */}
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
                <option value="dia_ayer">Ayer</option>
                <option value="mes_actual">Mes Actual</option>
                <option value="mes_anterior">Mes Anterior</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Desde</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={e => { setDateFrom(e.target.value); setQuickRange('personalizado') }}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
            />
          </div>
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Hasta</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={e => { setDateTo(e.target.value); setQuickRange('personalizado') }}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-sm md:text-base text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
            />
          </div>

          {/* View Mode */}
          <div className="lg:col-span-3 space-y-2">
            <label className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 text-center lg:text-right block">Vista</label>
            <div className="flex bg-gray-100 p-1 rounded-xl md:rounded-2xl">
              {(['detalle', 'resumen-diario', 'resumen-profesor'] as ViewMode[]).map(v => (
                <button 
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`flex-1 py-2 px-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === v ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {v === 'detalle' ? 'Lista' : v === 'resumen-diario' ? 'Día' : 'Profe'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-6 items-end border-t border-gray-50 pt-6 md:pt-8">
          <div className="lg:col-span-6 relative group">
            <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={24} />
            <input
              className="w-full bg-gray-50 border-2 border-transparent rounded-xl md:rounded-3xl pl-12 md:pl-14 pr-6 py-3 md:py-4 font-bold text-sm md:text-base text-gray-700 focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 transition-all outline-none"
              placeholder="Buscar alumno, curso..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="lg:col-span-3">
             <select 
               value={fMethod} 
               onChange={e => setFMethod(e.target.value)}
               className="w-full px-4 py-3 md:py-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
             >
               <option value="">Todos los Métodos</option>
               <option value="cash">Efectivo</option>
               <option value="card">Tarjeta</option>
               <option value="transfer">Transferencia</option>
               <option value="agreement">Convenio</option>
             </select>
          </div>
          <div className="lg:col-span-3">
             <select 
               value={fType} 
               onChange={e => setFType(e.target.value)}
               className="w-full px-4 py-3 md:py-4 bg-gray-50 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
             >
               <option value="">Todos los Tipos</option>
               <option value="monthly">Mensualidad</option>
               <option value="single_class">Clase Suelta</option>
               <option value="registration">Matrícula</option>
               <option value="agreement">Convenio</option>
             </select>
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden min-h-[400px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4">
             <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
             <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Actualizando registros...</span>
          </div>
        )}

        {viewMode === 'detalle' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="hidden md:table-header-group">
                <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumno / Concepto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Método / Tipo</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Monto</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 block md:table-row-group">
                {visibleData.length === 0 && !loading ? (
                  <tr className="block md:table-row"><td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-bold block md:table-cell">No se encontraron pagos en este rango.</td></tr>
                ) : visibleData.map((p) => (
                  <tr key={p.id} className="block md:table-row hover:bg-fuchsia-50/20 transition-colors group">
                    <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6">
                      <div className="flex md:block items-center justify-between">
                        <div className="text-sm font-black text-gray-900">{toDDMMYYYY(p.payment_date)}</div>
                        <div className="text-[10px] font-bold text-gray-400">ID #{p.id}</div>
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6">
                      <div className="font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors truncate">{p.student_name || students[p.student_id!]?.name || '-'}</div>
                      <div className="text-xs font-bold text-gray-500 truncate">
                        {p.type === 'registration' ? 'Matrícula' : (p.course_name || (p.course_id && courses[p.course_id]?.name) || historicCourseNameFromReference(p.reference) || 'Gasto General')}
                      </div>
                      {p.notes && <div className="text-[10px] text-gray-400 italic mt-1 line-clamp-1">"{p.notes}"</div>}
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          (p.method === 'efectivo' || p.method === 'cash') ? 'bg-emerald-50 text-emerald-600' : 
                          (p.method === 'debito' || p.method === 'credito' || p.method === 'card') ? 'bg-sky-50 text-sky-600' : 
                          (p.method === 'transferencia' || p.method === 'transfer') ? 'bg-indigo-50 text-indigo-600' : 
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {methodLabel(p.method)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          p.type === 'monthly' ? 'bg-fuchsia-50 text-fuchsia-600' :
                          p.type === 'single_class' ? 'bg-amber-100 text-amber-700' :
                          p.type === 'registration' ? 'bg-rose-100 text-rose-700' :
                          p.type === 'agreement' || p.type === 'convenio' ? 'bg-cyan-50 text-cyan-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>{p.type === 'registration' ? registrationVariantLabel(p) : typeLabel(p.type)}</span>
                      </div>
                      <div className="text-[9px] font-bold text-gray-400 mt-1">{findPeriod(p)}</div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-left md:text-right">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Monto</div>
                      <div className="text-base md:text-lg font-black text-gray-900">{fmtCLP.format(p.amount)}</div>
                    </td>
                    <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6 text-right">
                      <div className="flex items-center justify-end gap-2 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditing(p)}
                          className="flex-1 md:flex-none p-2.5 bg-white border border-gray-100 text-amber-500 rounded-xl hover:bg-amber-50 hover:border-amber-100 transition-all shadow-sm flex justify-center"
                        >
                          <HiOutlinePencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="flex-1 md:flex-none p-2.5 bg-white border border-gray-100 text-rose-500 rounded-xl hover:bg-rose-50 hover:border-rose-100 transition-all shadow-sm flex justify-center"
                        >
                          <HiOutlineTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {viewMode === 'detalle' && totalPages > 1 && (
          <div className="px-6 md:px-8 py-4 md:py-6 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {visibleData.length} de {totalItems} registros
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:text-fuchsia-600 transition-all"
              >
                <HiOutlineChevronLeft size={24} />
              </button>
              <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-none no-scrollbar">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`min-w-[32px] md:min-w-[40px] h-8 md:h-10 rounded-lg md:rounded-xl font-black text-[10px] md:text-xs transition-all shrink-0 ${page === i + 1 ? 'bg-fuchsia-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-white border border-gray-200 text-gray-500 disabled:opacity-30 hover:text-fuchsia-600 transition-all"
              >
                <HiOutlineChevronRight size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Daily Summary View */}
        {viewMode === 'resumen-diario' && (
           <div className="overflow-x-auto">
             <table className="w-full">
               <thead className="hidden md:table-header-group">
                 <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha</th>
                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Efectivo</th>
                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Tarjeta</th>
                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Transf.</th>
                    <th className="px-4 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Convenio</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Día</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50 block md:table-row-group">
                 {dailyRows.map(r => (
                   <tr key={r.date} className="block md:table-row hover:bg-fuchsia-50/20 transition-colors">
                     <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6 font-black text-gray-900">{toDDMMYYYY(r.date)}</td>
                     <td className="block md:table-cell px-6 py-1 md:py-6 text-left md:text-right font-bold text-emerald-600">
                        <span className="md:hidden text-[8px] font-black text-gray-400 uppercase mr-2">Efect:</span>
                        {fmtCLP.format(r.cash)}
                     </td>
                     <td className="block md:table-cell px-6 py-1 md:py-6 text-left md:text-right font-bold text-sky-600">
                        <span className="md:hidden text-[8px] font-black text-gray-400 uppercase mr-2">Tarj:</span>
                        {fmtCLP.format(r.card)}
                     </td>
                     <td className="block md:table-cell px-6 py-1 md:py-6 text-left md:text-right font-bold text-indigo-600">
                        <span className="md:hidden text-[8px] font-black text-gray-400 uppercase mr-2">Trans:</span>
                        {fmtCLP.format(r.transfer)}
                     </td>
                     <td className="block md:table-cell px-6 py-1 md:py-6 text-left md:text-right font-bold text-amber-600">
                        <span className="md:hidden text-[8px] font-black text-gray-400 uppercase mr-2">Conv:</span>
                        {fmtCLP.format(r.agreement)}
                     </td>
                     <td className="block md:table-cell px-6 py-3 md:py-6 text-left md:text-right font-black text-gray-900 text-lg">{fmtCLP.format(r.total)}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}

        {/* Teacher Summary View */}
        {viewMode === 'resumen-profesor' && (
           <div className="overflow-x-auto">
             <table className="w-full">
               <thead>
                 <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                   <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Profesor</th>
                   <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Generado</th>
                   <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Participación</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                 {teacherRows.map(r => (
                   <tr key={r.name} className="hover:bg-fuchsia-50/20 transition-colors">
                     <td className="px-8 py-6 font-black text-gray-900">{r.name}</td>
                     <td className="px-6 py-6 text-right font-black text-gray-900 text-lg">{fmtCLP.format(r.total)}</td>
                     <td className="px-6 py-6 text-right">
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                           <div className="bg-fuchsia-600 h-full rounded-full" style={{ width: `${(r.total / stats.total_amount) * 100}%` }} />
                        </div>
                        <div className="text-[10px] font-black text-fuchsia-600 mt-1">{((r.total / stats.total_amount) * 100).toFixed(1)}%</div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <EditPaymentModal 
          payment={editing} 
          onClose={() => setEditing(null)} 
          onSuccess={() => { setEditing(null); setReloadKey(k => k + 1) }}
        />
      )}
    </div>
  )
}
