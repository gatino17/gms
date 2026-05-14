import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdEmail } from 'react-icons/md'
import { FaWhatsapp, FaBirthdayCake } from 'react-icons/fa'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'

type CourseRow = {
  course: { id: number; name: string; level?: string; start_date?: string | null; price?: number | null; classes_per_week?: number | null }
  teacher?: { id: number | null; name?: string | null } | null
  counts?: { total: number; female: number; male: number }
  students: {
    id: number
    first_name: string
    last_name: string
    email?: string | null
    email_ok?: boolean
    gender?: string | null
    phone?: string | null
    enrolled_since?: string | null
    renewal_date?: string | null
    notes?: string | null
    payment_status?: 'activo' | 'pendiente'
    attendance_count?: number
    birthday_today?: boolean
  }[]
}

type GenderKey = 'female' | 'male' | 'other'
type PaymentRow = { id: number; student_id?: number | null; course_id?: number | null; payment_date?: string | null }

function toDate(iso?: string | null) {
  if (!iso) return null
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

function weeksBetween(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const diffMs = e.getTime() - s.getTime()
  if (diffMs < 0) return 0
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, Math.ceil(days / 7))
}

function monthsInRange(startYMD: string, endYMD: string) {
  const out: { year: number; month: number }[] = []
  const [sy, sm] = startYMD.split('-').map(Number)
  const [ey, em] = endYMD.split('-').map(Number)
  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push({ year: y, month: m })
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

function fmtDisplayDate(iso?: string | null) {
  if (!iso) return '-'
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return iso
}

function normalizeGender(gRaw?: string | null): GenderKey {
  const g = (gRaw ?? '').trim().toLowerCase()
  if (g.startsWith('f') || g.startsWith('muj')) return 'female'
  if (g.startsWith('m') && !g.startsWith('muj')) return 'male'
  return 'other'
}

export default function CourseStatusByGenderPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const [data, setData] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])

  const [courseQ, setCourseQ] = useState('')
  const [studentQ, setStudentQ] = useState('')
  const [day, setDay] = useState<string>('') // '' todos
  const [teacherQ, setTeacherQ] = useState('')
  const [attendanceDays, setAttendanceDays] = useState<string>('30')
  const [sortBy, setSortBy] = useState<'none' | 'att_desc' | 'att_asc'>('none')

  const load = async () => {
    if (tenantId == null) {
      setError('Seleccione un tenant')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (courseQ) params.course_q = courseQ
      if (studentQ) params.student_q = studentQ
      if (day !== '') params.day_of_week = Number(day)
      if (teacherQ) params.teacher_q = teacherQ
      if (attendanceDays) params.attendance_days = Number(attendanceDays)
      const today = new Date()
      const startRange = new Date()
      startRange.setDate(today.getDate() - 365) // pagos del ultimo año
      const [statusRes, payRes] = await Promise.all([
        api.get('/api/pms/course_status', { params }),
        api.get('/api/pms/payments', {
          params: {
            limit: 1000,
            offset: 0,
            date_from: toYMD(startRange),
            date_to: toYMD(today),
          },
        }),
      ])
      const statusData: CourseRow[] = statusRes.data || []

      // Recalcular asistencias para capturar extras (5/4, etc.)
      try {
        const latest = toYMD(today)
        const attendancePromises: Promise<void>[] = []
        for (const row of statusData) {
          for (const s of row.students || []) {
            const start = s.enrolled_since || latest
            const end = s.renewal_date || latest
            const horizon = toYMD(new Date(new Date().setMonth(new Date().getMonth() + 6)))
            const maxYMD = [latest, end, horizon].sort().slice(-1)[0]
            const months = monthsInRange(start.slice(0, 7) + '-01', maxYMD.slice(0, 7) + '-01')
            const courseId = row.course.id
            const studentId = s.id
            attendancePromises.push((async () => {
              let attended = 0
              for (const mm of months) {
                try {
                  const res = await api.get(`/api/pms/students/${studentId}/attendance_calendar`, { params: { year: mm.year, month: mm.month } })
                  const days = (res.data?.days || []) as { date: string; attended_course_ids?: number[] }[]
                  for (const d of days) {
                    if (d.date >= start && d.date <= maxYMD) {
                      if ((d.attended_course_ids || []).includes(courseId)) attended++
                    }
                  }
                } catch { }
              }
              s.attendance_count = attended
            })())
          }
        }
        await Promise.all(attendancePromises)
      } catch { /* si falla seguimos con los datos originales */ }

      const payRows = Array.isArray(payRes.data)
        ? payRes.data
        : Array.isArray(payRes.data?.results)
          ? payRes.data.results
          : []
      setPayments(payRows)
      setData(statusData)
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando estado de cursos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, day, attendanceDays])

  // Búsqueda reactiva como en course-status
  useEffect(() => {
    const id = setTimeout(() => {
      load()
    }, 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseQ, studentQ, teacherQ])

  // Filtrado en memoria para respuesta inmediata en la tabla
  // Agrupacion directa de los datos cargados (el load ya se dispara en cada cambio de filtro de texto con debounce)
  const grouped = useMemo(() => {
    const pays = Array.isArray(payments) ? payments : []
    return data.map((row) => {
      const today = new Date()
      const expectedDefault = Math.max(1, ((row.course as any).classes_per_week ?? 1) * 4)
      const sorter = (a: any, b: any) => {
        const av = a.attendance_count ?? 0
        const bv = b.attendance_count ?? 0
        if (sortBy === 'att_desc') return bv - av
        if (sortBy === 'att_asc') return av - bv
        return 0
      }
      const enrStudents = row.students.map((s) => {
        const payStatus = (s.payment_status || '').toString().toLowerCase()
        const hasPay = pays.some((p) => p.student_id === s.id && p.course_id === row.course.id)
        const stuEnd = toDate(s.renewal_date)
        const isPastPeriod = stuEnd ? today > stuEnd : false
        let statusLabel = 'Inscrito'
        let statusClass = 'bg-sky-50 text-sky-700 border-sky-200'
        if (!hasPay) {
          statusLabel = 'Pendiente de pago'
          statusClass = 'bg-rose-50 text-rose-700 border-rose-200'
        } else if (isPastPeriod) {
          statusLabel = 'Pendiente de renovación'
          statusClass = 'bg-amber-50 text-amber-700 border-amber-200'
        }
        const att = s.attendance_count ?? 0
        const stuStart = toDate(s.enrolled_since)
        const weeks = weeksBetween(stuStart, stuEnd)
        const expected =
          stuStart && stuEnd && stuStart.getTime() === stuEnd.getTime()
            ? 1
            : weeks != null
              ? Math.max(1, ((row.course as any).classes_per_week ?? 1) * weeks)
              : expectedDefault
        const attPct = expected > 0 ? Math.min(100, Math.round((att / expected) * 100)) : 0
        const over = att > expected
        const extra = over ? att - expected : 0
        const isSingleClass =
          !!(s.enrolled_since && s.renewal_date && s.enrolled_since === s.renewal_date)

        return { ...s, attendance_count: att, expected, attPct, extra, statusLabel, statusClass, isSingleClass }
      })
      const female = enrStudents.filter((s) => normalizeGender(s.gender) === 'female').sort(sorter)
      const male = enrStudents.filter((s) => normalizeGender(s.gender) === 'male').sort(sorter)
      const other = enrStudents.filter((s) => normalizeGender(s.gender) === 'other').sort(sorter)
      const counts = row.counts ?? {
        total: enrStudents.length,
        female: female.length,
        male: male.length,
      }
      return { row, expectedAttendance: expectedDefault, female, male, other, counts }
    })
  }, [data, sortBy, payments])

  const handleViewStudent = (studentId: number) => {
    navigate(`/students/${studentId}`)
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 md:space-y-12 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Reportes Académicos</span>
           <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-none">Estado por Género</h1>
           <p className="text-gray-500 font-medium text-sm md:text-lg">Análisis demográfico y de asistencia por curso.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-2xl w-fit">
        <Link to="/course-status" className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all">Por Curso</Link>
        <Link to="/course-status-gender" className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-fuchsia-600 bg-white shadow-sm">Por Género</Link>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
            placeholder="Nombre del curso..."
            value={courseQ}
            onChange={(e) => setCourseQ(e.target.value)}
          />
          <input
            className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
            placeholder="Alumno / Email..."
            value={studentQ}
            onChange={(e) => setStudentQ(e.target.value)}
          />
          <select
            className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            <option value="">Todos los días</option>
            <option value="0">Lunes</option>
            <option value="1">Martes</option>
            <option value="2">Miércoles</option>
            <option value="3">Jueves</option>
            <option value="4">Viernes</option>
            <option value="5">Sábado</option>
            <option value="6">Domingo</option>
          </select>
          <select
            className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
            value={attendanceDays}
            onChange={(e) => setAttendanceDays(e.target.value)}
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <input
              className="w-full sm:w-64 px-5 py-3 bg-gray-50 rounded-xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
              placeholder="Filtrar por Profesor..."
              value={teacherQ}
              onChange={(e) => setTeacherQ(e.target.value)}
            />
            <select
              className="hidden sm:block px-5 py-3 bg-gray-50 rounded-xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="none">Sin Ordenar</option>
              <option value="att_desc">Asist. (Máx a Mín)</option>
              <option value="att_asc">Asist. (Mín a Máx)</option>
            </select>
          </div>
          <button
            className="w-full sm:w-auto px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            onClick={load}
          >
            Refrescar Datos
          </button>
        </div>
      </div>

      {loading && (
         <div className="p-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
            <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Analizando Sedes...</span>
         </div>
      )}
      {error && <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-black uppercase tracking-widest text-center">{error}</div>}
      {!loading && !error && grouped.length === 0 && (
        <div className="p-10 text-gray-400 text-center font-black uppercase text-xs">No hay resultados para esta búsqueda.</div>
      )}

      <div className="space-y-8">
        {grouped.map(({ row, expectedAttendance, female, male, other, counts }) => (
          <div key={row.course.id} className="bg-white rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
            <div className="p-6 md:p-10 bg-gray-50/50 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-fuchsia-100">{row.course.level || 'General'}</span>
                     <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                     <span className="text-[10px] font-bold text-gray-400">Inicio: {fmtDisplayDate(row.course.start_date)}</span>
                  </div>
                  <h3 className="text-2xl md:text-4xl font-black text-gray-900 leading-none">{row.course.name}</h3>
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       </div>
                       <span className="text-sm font-bold text-gray-600">{row.teacher?.name || 'Por Asignar'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </div>
                       <span className="text-sm font-black text-gray-900">
                          {row.course.price ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(row.course.price)) : '-'}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="px-5 py-4 bg-white rounded-2xl border border-gray-100 text-center min-w-[80px]">
                     <div className="text-[8px] font-black text-gray-400 uppercase tracking-tighter mb-1">Total</div>
                     <div className="text-xl font-black text-gray-900">{counts.total}</div>
                  </div>
                  <div className="px-5 py-4 bg-white rounded-2xl border border-pink-100 text-center min-w-[80px]">
                     <div className="text-[8px] font-black text-pink-400 uppercase tracking-tighter mb-1">Mujeres</div>
                     <div className="text-xl font-black text-pink-600">{counts.female}</div>
                  </div>
                  <div className="px-5 py-4 bg-white rounded-2xl border border-blue-100 text-center min-w-[80px]">
                     <div className="text-[8px] font-black text-blue-400 uppercase tracking-tighter mb-1">Hombres</div>
                     <div className="text-xl font-black text-blue-600">{counts.male}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GenderTable title="Mujeres" students={female} onView={handleViewStudent} />
                <GenderTable title="Hombres" students={male} onView={handleViewStudent} />
              </div>
              {other.length > 0 && (
                <div className="grid grid-cols-1">
                  <GenderTable title="Otro / Sin dato" students={other} onView={handleViewStudent} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type GenderTableProps = {
  title: string
  students: (CourseRow['students'][number] & { expected: number; attPct: number; extra: number; statusLabel: string; statusClass: string })[]
  onView: (id: number) => void
}

function GenderTable({ title, students, onView }: GenderTableProps) {
  return (
    <div className="bg-white rounded-[24px] border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50/30 border-b border-gray-50">
         <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</h4>
      </div>
      {students.length === 0 ? (
        <div className="p-8 text-center text-gray-300 font-bold text-xs uppercase tracking-widest">Sin alumnos registrados</div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group bg-gray-50/50">
              <tr className="text-left border-b border-gray-100">
                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">#</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter">Alumno</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Contacto</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Pago</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Asist.</th>
                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-tighter text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 block md:table-row-group">
              {students.map((s, idx) => {
                const EmailIcon = MdEmail
                const att = s.attendance_count ?? 0

                return (
                  <tr key={s.id} className="block md:table-row hover:bg-gray-50 transition-colors">
                    <td className="hidden md:table-cell px-4 py-4 text-center font-bold text-gray-300">{idx + 1}</td>
                    <td className="block md:table-cell px-6 py-4 md:py-6">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-fuchsia-50 flex items-center justify-center text-fuchsia-600 font-black text-xs shrink-0">
                            {s.first_name[0]}{s.last_name[0]}
                         </div>
                         <div className="min-w-0">
                           <div className="flex items-center gap-2">
                              <span className="font-black text-gray-900 truncate">{s.first_name} {s.last_name}</span>
                              {s.birthday_today && <FaBirthdayCake className="text-pink-500 shrink-0" size={12} />}
                           </div>
                           <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Socio #{s.id}</div>
                         </div>
                      </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-center">
                       <div className="flex md:justify-center items-center gap-4">
                          <div className="md:hidden text-[8px] font-black text-gray-400 uppercase w-16">Contacto</div>
                          <div className="flex items-center gap-2">
                             <div className={`p-2 rounded-lg ${s.phone ? 'text-emerald-500 bg-emerald-50' : 'text-gray-300 bg-gray-50'}`}>
                                <FaWhatsapp size={14} />
                             </div>
                             <div className={`p-2 rounded-lg ${s.email_ok ? 'text-blue-500 bg-blue-50' : 'text-gray-300 bg-gray-50'}`}>
                                <MdEmail size={14} />
                             </div>
                          </div>
                       </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-center">
                       <div className="flex md:justify-center items-center gap-4">
                          <div className="md:hidden text-[8px] font-black text-gray-400 uppercase w-16">Estatus</div>
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${s.statusClass}`}>
                            {s.statusLabel}
                          </span>
                       </div>
                    </td>
                    <td className="block md:table-cell px-6 py-2 md:py-6 text-center">
                       <div className="flex md:justify-center items-center gap-4">
                          <div className="md:hidden text-[8px] font-black text-gray-400 uppercase w-16">Asistencia</div>
                          <div className="flex flex-col md:items-center">
                             <div className={`text-xs font-black ${att > s.expected ? 'text-rose-600' : 'text-gray-700'}`}>
                               {att} / {s.expected}
                             </div>
                             <div className="text-[8px] font-bold text-gray-400 uppercase">{s.attPct}% Cumplimiento</div>
                          </div>
                       </div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 text-center">
                      <button
                        className="w-full md:w-auto px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gray-100 hover:bg-fuchsia-50 hover:text-fuchsia-600 hover:border-fuchsia-100 transition-all"
                        onClick={() => onView(s.id)}
                      >
                        Perfil
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
