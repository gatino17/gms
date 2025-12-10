import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'
import * as XLSX from 'xlsx'

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

type CourseRef = {
  id:number; name:string; teacher_name?: string | null
  // anadimos campos opcionales para mostrar "Sabado 14:00" si existen
  day_of_week?: number|null
  start_time?: string|null
}
type StudentRef = { id:number; name:string }
type Enrollment = { id:number; student_id:number; course_id:number; start_date:string; end_date?:string|null; is_active:boolean }

const CL_TZ = 'America/Santiago'
const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })
const DN = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo']

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

// Detecta pagos que cuentan como "Convenio"
function isAgreementPayment(p: Payment): boolean {
  const notes = String(p.notes || '').toLowerCase()
  const typeStr = String(p.type || '').toLowerCase()
  const methodStr = String(p.method || '').toLowerCase()
  const hasConvenioWord = notes.includes('convenio') || typeStr.includes('convenio') || methodStr.includes('convenio')
  return hasConvenioWord || typeStr === 'agreement' || methodStr === 'agreement'
}

type ViewMode = 'detalle' | 'resumen-diario' | 'resumen-profesor'

export default function PaymentsPage() {
  const { tenantId } = useTenant()
  const [payments, setPayments] = useState<Payment[]>([])
  const [courses, setCourses] = useState<Record<number, CourseRef>>({})
  const [students, setStudents] = useState<Record<number, StudentRef>>({})
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // rango de fechas base
  const todayYMD = toYMDInTZ(new Date(), CL_TZ)
  const [dateFrom, setDateFrom] = useState<string>(todayYMD)
  const [dateTo, setDateTo] = useState<string>(todayYMD)

  // filtros
  const [fMethod, setFMethod] = useState<string>("")
  const [fType, setFType] = useState<string>("")
  const [q, setQ] = useState<string>("")
  const [debouncedQ, setDebouncedQ] = useState<string>("")
  const [debouncedFrom, setDebouncedFrom] = useState<string>(todayYMD)
  const [debouncedTo, setDebouncedTo] = useState<string>(todayYMD)
  const [debouncedMethod, setDebouncedMethod] = useState<string>("")
  const [debouncedType, setDebouncedType] = useState<string>("")
  const [page, setPage] = useState<number>(1) 
  const [pageSize, setPageSize] = useState<number>(20)
  const [total, setTotal] = useState<number>(0)

  // rango rapido
  const [quickRange, setQuickRange] = useState<string>('dia_hoy')
  const [pickMonth, setPickMonth] = useState<string>('')   // YYYY-MM
  const [cycleMonth, setCycleMonth] = useState<string>('') // YYYY-MM

  // vista
  const [viewMode, setViewMode] = useState<ViewMode>('detalle')
  const [tableLoading, setTableLoading] = useState(false)
  const [firstLoad, setFirstLoad] = useState(true)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [q, fMethod, fType, dateFrom, dateTo, tenantId])

  // debounce entradas para evitar múltiples fetch mientras se escribe
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQ(q)
      setDebouncedFrom(dateFrom)
      setDebouncedTo(dateTo)
      setDebouncedMethod(fMethod)
      setDebouncedType(fType)
    }, 280)
    return () => clearTimeout(handle)
  }, [q, dateFrom, dateTo, fMethod, fType])

  useEffect(() => {
    const load = async () => {
      // solo mostramos loading fuerte en el primer render; luego usamos tableLoading ligero
      setError(null)
      if (firstLoad) setLoading(true)
      setTableLoading(true)
      try {
        const params: any = {
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }
        if (debouncedMethod) params.method = debouncedMethod
        if (debouncedType) params.type = debouncedType
        if (debouncedQ) params.q = debouncedQ
        if (debouncedFrom) params.date_from = debouncedFrom
        if (debouncedTo) params.date_to = debouncedTo

        const [pres, cres, sres, eres] = await Promise.all([
          api.get('/api/pms/payments', { params }),
          api.get('/api/pms/courses'),
          api.get('/api/pms/students'),
          api.get('/api/pms/enrollments'),
        ])
        const paymentItems = (pres.data as any)?.items ?? pres.data ?? []
        const paymentTotal = (pres.data as any)?.total ?? paymentItems.length
        setPayments(paymentItems)
        setTotal(paymentTotal)

        const cMap: Record<number, CourseRef> = {}
        for (const c of ( (cres.data as any)?.items ?? cres.data ?? [] )) {
          cMap[c.id] = {
            id:c.id,
            name:c.name,
            teacher_name:c.teacher_name,
            day_of_week: ('day_of_week' in c) ? c.day_of_week : null,
            start_time: ('start_time' in c && c.start_time) ? String(c.start_time).slice(0,5) : null,
          }
        }
        setCourses(cMap)

        const sMap: Record<number, StudentRef> = {}
        for (const s of ((sres.data as any)?.items ?? sres.data ?? [])) sMap[s.id] = { id:s.id, name:`${s.first_name} ${s.last_name}`.trim() }
        setStudents(sMap)

        setEnrollments((eres.data || []).map((e:any)=>({
          id:e.id, student_id:e.student_id, course_id:e.course_id,
          start_date:e.start_date, end_date:e.end_date, is_active:!!e.is_active
        })))
      } catch (e:any) {
        setError(e?.message || 'Error cargando pagos')
      } finally {
        setLoading(false)
        setTableLoading(false)
        setFirstLoad(false)
      }
    }
    load()
  }, [tenantId, debouncedMethod, debouncedType, debouncedQ, page, pageSize, debouncedFrom, debouncedTo])

  // Si cambian manualmente fechas ? personalizado
  useEffect(() => {
    if (quickRange !== 'mes_elegir' && quickRange !== 'ciclo_6a5') setQuickRange('personalizado')
  }, [dateFrom, dateTo])

  const methodLabel = (m:string) =>
    m === 'cash'
      ? 'Efectivo'
      : m === 'card'
        ? 'Tarjeta/Débito'
        : m === 'transfer'
          ? 'Transferencia'
          : (m === 'agreement' || m === 'convenio') ? 'Convenio' : m
  const typeLabel = (t:string) =>
    t === 'monthly' ? 'Mensualidad' : t === 'single_class' ? 'Clase suelta' : t

  // ---- Totales mes actual ----
  const monthTotals = useMemo(() => {
    const { start: monthStart, end: monthEnd } = monthRangeOffset(0)
    let monthTotal = 0
    const monthByMethod: Record<string, number> = { cash:0, card:0, transfer:0 }
    let monthAgreement = 0
    for (const p of payments) {
      if (p.payment_date >= monthStart && p.payment_date <= monthEnd) {
        const amt = Number(p.amount || 0)
        monthTotal += amt
        if (p.method in monthByMethod) monthByMethod[p.method] += amt
        if (isAgreementPayment(p)) monthAgreement += amt
      }
    }
    return { monthTotal, monthByMethod, monthAgreement }
  }, [payments])

  // ---- Totales del RANGO ----
  const rangeTotals = useMemo(() => {
    const from = dateFrom || '0000-01-01'
    const to = dateTo || '9999-12-31'
    let total = 0
    const byMethod: Record<string, number> = { cash:0, card:0, transfer:0 }
    let agreement = 0
    for (const p of payments) {
      if (p.payment_date >= from && p.payment_date <= to) {
        const amt = Number(p.amount || 0)
        total += amt
        if (p.method in byMethod) byMethod[p.method] += amt
        if (isAgreementPayment(p)) agreement += amt
      }
    }
    return { total, byMethod, agreement }
  }, [payments, dateFrom, dateTo])

  function findPeriodForPayment(p: Payment): { start?: string, end?: string } {
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

  // Texto corto de curso: "Nombre, Sabado 14:00"
  function courseShort(c?: CourseRef): string {
    if (!c) return '-'
    const day = (typeof c.day_of_week === 'number') ? DN[Math.max(0, Math.min(6, c.day_of_week))] : null
    const hh = c.start_time ? String(c.start_time).slice(0,5) : null
    if (day && hh) return `${c.name}, ${day} ${hh}`
    return c.name
  }

  // Filas dentro del rango
  const rangeRows = useMemo(() => {
    const from = dateFrom || '0000-01-01'
    const to = dateTo || '9999-12-31'
    const items = payments
      .filter(p => p.payment_date >= from && p.payment_date <= to)
      .map(p => {
        const c = p.course_id ? courses[p.course_id!] : undefined
        const student = p.student_id ? (students[p.student_id!]?.name || '-') : '-'
        const course  = courseShort(c)
        const teacher = c?.teacher_name || '-'
        const typeStr = typeLabel(p.type)
        const methodStr = methodLabel(p.method)
        let periodo = ''
        if (p.type === 'monthly' || isAgreementPayment(p)) {
          const per = findPeriodForPayment(p)
          if (per.start && per.end) periodo = `${toDDMMYYYY(per.start)} a ${toDDMMYYYY(per.end)}`
        } else if (p.type === 'single_class') {
          periodo = `${toDDMMYYYY(p.payment_date)}`
        }
        return {
          p, student, course, teacher, periodo, typeStr, methodStr,
          dateStr: toDDMMYYYY(p.payment_date)
        }
      })
      .sort((a,b)=> b.p.id - a.p.id)
    return items
  }, [payments, students, courses, enrollments, dateFrom, dateTo])

    // Filtros
  const filteredRows = useMemo(() => {
    let arr = rangeRows
    if (fMethod) arr = arr.filter(r => r.p.method === fMethod)
    if (fType) arr = arr.filter(r => r.p.type === fType)
    if (q.trim()) {
      const qq = q.toLowerCase()
      arr = arr.filter(r =>
        (`${r.student} ${r.course} ${r.teacher} ${r.typeStr} ${r.methodStr} ${r.periodo} ${r.p.notes||''}`.toLowerCase().includes(qq))
      )
    }
    return arr
  }, [rangeRows, fMethod, fType, q])

  const filteredTotal = useMemo(
    () => filteredRows.reduce((acc, r) => acc + Number(r.p.amount || 0), 0),
    [filteredRows]
  )

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = filteredRows

  useEffect(() => { setPage(1) }, [fMethod, fType, q, pageSize, dateFrom, dateTo])
  // ---------- Resumen diario ----------
  const dailySummary = useMemo(() => {
    const base = filteredRows // usa los FILTROS actuales
    const map: Record<string, {
      fechaYMD: string
      fechaStr: string
      efectivo: number
      debito: number
      transferencia: number
      convenio: number
      total: number
    }> = {}

    for (const row of base) {
      const ymd = row.p.payment_date
      const fechaStr = row.dateStr
      if (!map[ymd]) map[ymd] = { fechaYMD: ymd, fechaStr, efectivo:0, debito:0, transferencia:0, convenio:0, total:0 }
      const amt = Number(row.p.amount || 0)

      if (row.p.method === 'cash') map[ymd].efectivo += amt
      else if (row.p.method === 'card') map[ymd].debito += amt
      else if (row.p.method === 'transfer') map[ymd].transferencia += amt

      if (isAgreementPayment(row.p)) map[ymd].convenio += amt
      map[ymd].total += amt
    }

    const rows = Object.values(map).sort((a,b) => a.fechaYMD.localeCompare(b.fechaYMD))
    const grand = rows.reduce((acc, r) => {
      acc.efectivo += r.efectivo
      acc.debito += r.debito
      acc.transferencia += r.transferencia
      acc.convenio += r.convenio
      acc.total += r.total
      return acc
    }, { efectivo:0, debito:0, transferencia:0, convenio:0, total:0 })

    return { rows, grand }
  }, [filteredRows])

  // ---------- Resumen por profesor ----------
  const teacherSummary = useMemo(() => {
    const base = filteredRows
    const map: Record<string, {
      profesor: string
      efectivo: number
      debito: number
      transferencia: number
      convenio: number
      total: number
    }> = {}

    for (const row of base) {
      const key = row.teacher || '-'
      if (!map[key]) map[key] = { profesor: key, efectivo:0, debito:0, transferencia:0, convenio:0, total:0 }
      const amt = Number(row.p.amount || 0)
      if (row.p.method === 'cash') map[key].efectivo += amt
      else if (row.p.method === 'card') map[key].debito += amt
      else if (row.p.method === 'transfer') map[key].transferencia += amt
      if (isAgreementPayment(row.p)) map[key].convenio += amt
      map[key].total += amt
    }

    const rows = Object.values(map).sort((a,b) => a.profesor.localeCompare(b.profesor))
    const grand = rows.reduce((acc, r) => {
      acc.efectivo += r.efectivo
      acc.debito += r.debito
      acc.transferencia += r.transferencia
      acc.convenio += r.convenio
      acc.total += r.total
      return acc
    }, { efectivo:0, debito:0, transferencia:0, convenio:0, total:0 })

    return { rows, grand }
  }, [filteredRows])

  // ---------- Exportar Excel ----------
  function downloadExcel() {
    // 1) Detalle (todas las filas FILTRADAS)
    const detalleData = filteredRows.map(r => ({
      ID: r.p.id,
      Fecha: r.dateStr,
      Alumno: r.student,
      Curso: r.course,
      Profesor: r.teacher,
      Periodo: r.periodo || '',
      Tipo: r.typeStr,
      Metodo: r.methodStr,
      Monto: Number(r.p.amount || 0),
      Referencia: r.p.reference || '',
      Observacion: r.p.notes || ''
    }))

    // 2) Resumen diario
    const resumenDiario = [
      ...dailySummary.rows.map(d => ({
        Fecha: d.fechaStr,
        Efectivo: d.efectivo,
        Debito: d.debito,
        Transferencia: d.transferencia,
        Convenio: d.convenio,
        Total: d.total
      })),
      ...(dailySummary.rows.length ? [{
        Fecha: 'TOTAL',
        Efectivo: dailySummary.grand.efectivo,
        Debito: dailySummary.grand.debito,
        Transferencia: dailySummary.grand.transferencia,
        Convenio: dailySummary.grand.convenio,
        Total: dailySummary.grand.total
      }] : [])
    ]

    // 3) Resumen por profesor
    const resumenProfesor = [
      ...teacherSummary.rows.map(r => ({
        Profesor: r.profesor,
        Efectivo: r.efectivo,
        Debito: r.debito,
        Transferencia: r.transferencia,
        Convenio: r.convenio,
        Total: r.total
      })),
      ...(teacherSummary.rows.length ? [{
        Profesor: 'TOTAL',
        Efectivo: teacherSummary.grand.efectivo,
        Debito: teacherSummary.grand.debito,
        Transferencia: teacherSummary.grand.transferencia,
        Convenio: teacherSummary.grand.convenio,
        Total: teacherSummary.grand.total
      }] : [])
    ]

    const wb = XLSX.utils.book_new()

    const wsDetalle = XLSX.utils.json_to_sheet(detalleData)
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle')

    const wsDia = XLSX.utils.json_to_sheet(resumenDiario)
    XLSX.utils.book_append_sheet(wb, wsDia, 'Resumen diario')

    const wsProf = XLSX.utils.json_to_sheet(resumenProfesor)
    XLSX.utils.book_append_sheet(wb, wsProf, 'Resumen profesor')

    // 4) Una hoja por cada profesor con su DETALLE
    const profesores = Array.from(new Set(filteredRows.map(r => r.teacher))).filter(Boolean).sort((a,b)=>a.localeCompare(b,'es'))
    for (const prof of profesores) {
      const rows = filteredRows.filter(r => r.teacher === prof).map(r => ({
        ID: r.p.id,
        Fecha: r.dateStr,
        Alumno: r.student,
        Curso: r.course,
        Periodo: r.periodo || '',
        Tipo: r.typeStr,
        Metodo: r.methodStr,
        Monto: Number(r.p.amount || 0),
        Observacion: r.p.notes || ''
      }))
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: 'Sin registros en el rango/filters' }])
      // nombre de hoja mximo 31 caracteres
      const sheetName = (prof || 'Profesor').slice(0,31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }

    const fname = `Pagos_${dateFrom}_a_${dateTo}.xlsx`
    XLSX.writeFile(wb, fname)
  }

  // ---------- UI helpers ----------
  const IconTotal = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v6H3z" />
      <path d="M3 15h18v6H3z" />
      <path d="M7 6h2M7 18h2" />
    </svg>
  )
  const IconCash = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 8h0M18 8h0M6 16h0M18 16h0" />
    </svg>
  )
  const IconCard = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3M12 15h5" />
    </svg>
  )
  const IconTransfer = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10l-2-2M14 7l-2-2" />
      <path d="M20 17H10l2 2M10 17l2 2" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
  const IconAgreement = (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12l2 2 6-6" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
  const IconDownload = (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )

  function FeaturedStat({
    title, value, small, icon, highlight,
    iconBg = 'from-amber-100 to-amber-50',
    iconText = 'text-amber-600',
  }: {
    title: string; value: string; small?: string; icon?: any; highlight?: boolean;
    iconBg?: string; iconText?: string;
  }) {
    return (
      <div className={`rounded-2xl border ${highlight ? 'border-gray-200 shadow-md' : 'border-gray-100 shadow-sm'} bg-white px-5 py-4`}>
        <div className="flex items-center gap-3">
          {icon ? (
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br ${iconBg} ${iconText} text-lg shadow-inner`}>
              {icon}
            </span>
          ) : null}
          <div className="text-xs text-gray-600 font-semibold">{title}</div>
        </div>
        <div className={`mt-2 font-bold ${highlight ? 'text-3xl' : 'text-2xl'} text-gray-900`}>{value}</div>
        {small ? <div className="text-[11px] text-gray-500 mt-0.5">{small}</div> : null}
      </div>
    )
  }
  function GradientStat({
    title, value, small, icon, highlight,
    iconBg = 'from-fuchsia-100 to-purple-100',
    iconText = 'text-fuchsia-700',
  }: {
    title: string; value: string; small?: string; icon?: any; highlight?: boolean;
    iconBg?: string; iconText?: string;
  }) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          {icon ? (
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br ${iconBg} ${iconText} text-base shadow-inner`}>
              {icon}
            </span>
          ) : null}
          <div className="text-xs text-gray-600 font-semibold">{title}</div>
        </div>
        <div className={`mt-1 font-semibold ${highlight ? 'text-2xl' : 'text-xl'} text-gray-900`}>{value}</div>
        {small ? <div className="text-[11px] text-gray-500 mt-0.5">{small}</div> : null}
      </div>
    )
  }

  // ---------- Rango rapido ----------
  function applyQuickRange(val: string) {
    setQuickRange(val)
    if (val === 'dia_hoy') {
      const t = toYMDInTZ(new Date(), CL_TZ)
      setDateFrom(t); setDateTo(t)
      setPickMonth(''); setCycleMonth('')
    } else if (val === 'mes_actual') {
      const { start, end } = monthRangeOffset(0)
      setDateFrom(start); setDateTo(end)
      setPickMonth(''); setCycleMonth('')
    } else if (val === 'mes_elegir') {
      setCycleMonth('')
    } else if (val === 'ciclo_6a5') {
      setPickMonth('')
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pagos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadExcel}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-sm"
            title="Descargar Excel del rango (Detalle, Resumen diario, Resumen profesor y 1 hoja por profesor)"
          >
            {IconDownload} <span className="text-sm">Descargar Excel</span>
          </button>

          <Link
            to="/payments-teachers"
            className="px-3 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow-sm"
          >
            Pagos por profesor
          </Link>
        </div>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {!firstLoad && loading && !error && (
        <div className="text-sm text-gray-600">Actualizando...</div>
      )}

      {(!firstLoad || !loading) && !error && (
        <>
          {/* ---- Resumen del mes ---- */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-semibold text-gray-800">Resumen del mes (1  ultimo da)</div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white">Destacado</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <FeaturedStat title="Mes (total)" value={fmtCLP.format(monthTotals.monthTotal)} icon={IconTotal} highlight iconBg="from-purple-100 to-fuchsia-50" iconText="text-purple-600" />
              <FeaturedStat title="Mes Efectivo" value={fmtCLP.format(monthTotals.monthByMethod['cash'] || 0)} icon={IconCash} iconBg="from-emerald-100 to-emerald-50" iconText="text-emerald-600" />
              <FeaturedStat title="Mes Tarjeta" value={fmtCLP.format(monthTotals.monthByMethod['card'] || 0)} icon={IconCard} iconBg="from-sky-100 to-sky-50" iconText="text-sky-600" />
              <FeaturedStat title="Mes Transferencia" value={fmtCLP.format(monthTotals.monthByMethod['transfer'] || 0)} icon={IconTransfer} iconBg="from-indigo-100 to-indigo-50" iconText="text-indigo-600" />
              <FeaturedStat title="Mes Convenio" value={fmtCLP.format(monthTotals.monthAgreement || 0)} icon={IconAgreement} iconBg="from-amber-100 to-amber-50" iconText="text-amber-600" />
            </div>
          </div>

          {/* ---- Filtro fechas + rapido ---- */}
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
                  Rango rapido
                </label>
                <select className="border rounded px-3 py-2" value={quickRange} onChange={e => applyQuickRange(e.target.value)}>
                  <option value="dia_hoy">Por dia (hoy)</option>
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

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <GradientStat title="Rango (total)" value={fmtCLP.format(rangeTotals.total)} icon={IconTotal} highlight iconBg="from-purple-100 to-fuchsia-100" iconText="text-purple-700" />
            <GradientStat title="Rango Efectivo" value={fmtCLP.format(rangeTotals.byMethod['cash'] || 0)} icon={IconCash} iconBg="from-emerald-100 to-emerald-50" iconText="text-emerald-600" />
            <GradientStat title="Rango Tarjeta" value={fmtCLP.format(rangeTotals.byMethod['card'] || 0)} icon={IconCard} iconBg="from-sky-100 to-sky-50" iconText="text-sky-600" />
            <GradientStat title="Rango Transferencia" value={fmtCLP.format(rangeTotals.byMethod['transfer'] || 0)} icon={IconTransfer} iconBg="from-indigo-100 to-indigo-50" iconText="text-indigo-600" />
            <GradientStat title="Rango Convenio" value={fmtCLP.format(rangeTotals.agreement || 0)} icon={IconAgreement} iconBg="from-amber-100 to-amber-50" iconText="text-amber-600" />
          </div>

          {/* ---- Vista + filtros de la tabla ---- */}
          <div>
            <div className="flex items-center gap-3 my-2">
              <div className="text-sm font-semibold text-gray-800">Pagos del rango</div>

              <div className="ml-2 rounded-xl p-[1px] bg-gradient-to-r from-fuchsia-600 to-purple-600">
                <div className="flex bg-white rounded-xl overflow-hidden">
                  <button className={`px-3 py-1 text-xs ${viewMode==='detalle' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white' : 'text-gray-700'}`}
                          onClick={()=>setViewMode('detalle')}>Detalle</button>
                  <button className={`px-3 py-1 text-xs ${viewMode==='resumen-diario' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white' : 'text-gray-700'}`}
                          onClick={()=>setViewMode('resumen-diario')}>Resumen diario</button>
                  <button className={`px-3 py-1 text-xs ${viewMode==='resumen-profesor' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white' : 'text-gray-700'}`}
                          onClick={()=>setViewMode('resumen-profesor')}>Resumen profe</button>
                </div>
              </div>

              <div className="flex-1 border-t border-gray-200" />
              <div className="text-xs text-gray-700">Total mostrado:&nbsp;<span className="font-semibold">{fmtCLP.format(filteredTotal)}</span></div>
            </div>

              {viewMode === 'detalle' ? (
                <div className="bg-white rounded-2xl border border-fuchsia-100/70 shadow-sm overflow-auto p-3 relative">
                  {tableLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center text-sm text-gray-700">Actualizando...</div>}

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <select className="border rounded px-3 py-2" value={fMethod} onChange={e=>setFMethod(e.target.value)} title="Metodo">
                      <option value="">Metodo: todos</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="transfer">Transferencia</option>
                    <option value="agreement">Convenio</option>
                  </select>
                  <select className="border rounded px-3 py-2" value={fType} onChange={e=>setFType(e.target.value)} title="Tipo">
                    <option value="">Tipo: todos</option>
                    <option value="monthly">Mensualidad</option>
                    <option value="single_class">Clase suelta</option>
                  </select>
                  <input className="border rounded px-3 py-2 flex-1 min-w-[180px]" placeholder="Buscar (alumno/curso/profesor/nota)" value={q} onChange={e=>setQ(e.target.value)} />
                  <select className="border rounded px-2 py-2" value={String(pageSize)} onChange={e=>setPageSize(Number(e.target.value))} title="Filas por Pgina">
                    <option value="10">10</option><option value="20">20</option><option value="50">50</option>
                  </select>
                </div>

                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-fuchsia-50 to-purple-50 text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Fecha</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Alumno</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Curso</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Profesor</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Periodo</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Metodo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr><td className="px-3 py-4 text-sm text-gray-500" colSpan={7}>Sin pagos en el rango seleccionado.</td></tr>
                    ) : pageRows.map(row => (
                      <tr key={row.p.id} className="border-t hover:bg-fuchsia-50/40">
                        <td className="px-3 py-2">{row.dateStr}</td>
                        <td className="px-3 py-2">{row.student}</td>
                        <td className="px-3 py-2">{row.course}</td>
                        <td className="px-3 py-2">{row.teacher}</td>
                        <td className="px-3 py-2">{row.periodo || '-'}</td>
                        <td className="px-3 py-2">{row.methodStr}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(Number(row.p.amount||0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-end gap-3 mt-3 text-sm">
                  <span>Pgina {safePage} de {totalPages}</span>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 rounded border disabled:opacity-50" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button>
                    <button className="px-3 py-1 rounded border disabled:opacity-50" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Siguiente</button>
                  </div>
                </div>
              </div>
            ) : viewMode === 'resumen-diario' ? (
              <div className="bg-white rounded-2xl border border-fuchsia-100/70 shadow-sm overflow-auto p-3">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-fuchsia-50 to-purple-50 text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Fecha</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Efectivo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Debito</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Transferencia</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Convenio</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Total</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Entregado</th>
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.rows.length === 0 ? (
                      <tr><td className="px-3 py-4 text-sm text-gray-500" colSpan={8}>Sin pagos en el rango seleccionado.</td></tr>
                    ) : dailySummary.rows.map((d) => (
                      <tr key={d.fechaYMD} className="border-t hover:bg-fuchsia-50/40">
                        <td className="px-3 py-2">{d.fechaStr}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(d.efectivo)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(d.debito)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(d.transferencia)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(d.convenio)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtCLP.format(d.total)}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    ))}
                  </tbody>
                  {dailySummary.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-gradient-to-r from-fuchsia-50 to-purple-50 font-semibold text-fuchsia-800">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(dailySummary.grand.efectivo)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(dailySummary.grand.debito)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(dailySummary.grand.transferencia)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(dailySummary.grand.convenio)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(dailySummary.grand.total)}</td>
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-fuchsia-100/70 shadow-sm overflow-auto p-3">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-fuchsia-50 to-purple-50 text-left">
                      <th className="px-3 py-2 text-xs font-semibold text-fuchsia-700">Profesor</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Efectivo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Debito</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Transferencia</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Convenio</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teacherSummary.rows.length === 0 ? (
                      <tr><td className="px-3 py-4 text-sm text-gray-500" colSpan={6}>Sin pagos en el rango seleccionado.</td></tr>
                    ) : teacherSummary.rows.map((r) => (
                      <tr key={r.profesor} className="border-t hover:bg-fuchsia-50/40">
                        <td className="px-3 py-2">{r.profesor}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.efectivo)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.debito)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.transferencia)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-fuchsia-700">{fmtCLP.format(r.convenio)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmtCLP.format(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {teacherSummary.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-gradient-to-r from-fuchsia-50 to-purple-50 font-semibold text-fuchsia-800">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(teacherSummary.grand.efectivo)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(teacherSummary.grand.debito)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(teacherSummary.grand.transferencia)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(teacherSummary.grand.convenio)}</td>
                        <td className="px-3 py-2 text-right">{fmtCLP.format(teacherSummary.grand.total)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}





