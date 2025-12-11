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

      setPayments(payRes.data?.results ?? payRes.data ?? [])
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
        const hasPay = payments.some((p) => p.student_id === s.id && p.course_id === row.course.id)
        const stuEnd = toDate(s.renewal_date)
        const isPastPeriod = stuEnd ? today > stuEnd : false
        let statusLabel = 'Inscrito'
        let statusClass = 'bg-sky-50 text-sky-700 border-sky-200'
        if (!hasPay) {
          statusLabel = 'Pendiente de pago'
          statusClass = 'bg-rose-50 text-rose-700 border-rose-200'
        } else if (isPastPeriod) {
          statusLabel = 'Pendiente de renovacion'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-fuchsia-600 to-purple-600 text-transparent bg-clip-text">
          Estado de cursos por genero
        </h1>
        <p className="text-sm text-gray-600">
          Vista general por curso, separando alumnos por genero.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/course-status"
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:border-fuchsia-200 hover:text-fuchsia-700"
          >
            Por curso
          </Link>
          <Link
            to="/course-status-gender"
            className="px-3 py-1.5 rounded-lg border border-fuchsia-200 bg-white text-sm text-fuchsia-700 shadow-sm"
          >
            Por genero (actual)
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border bg-white p-3 md:p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-start">
          <input
            className="border rounded-lg px-3 py-2 w-full sm:w-64 lg:w-72 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
            placeholder="Buscar por curso"
            value={courseQ}
            onChange={(e) => setCourseQ(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2 w-full sm:w-64 lg:w-72 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
            placeholder="Buscar por alumno (nombre o email)"
            value={studentQ}
            onChange={(e) => setStudentQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-lg px-3 py-2"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              title="Dia"
            >
              <option value="">Todos los dias</option>
              <option value="0">Lunes</option>
              <option value="1">Martes</option>
              <option value="2">Miercoles</option>
              <option value="3">Jueves</option>
              <option value="4">Viernes</option>
              <option value="5">Sabado</option>
              <option value="6">Domingo</option>
            </select>
            <select
              className="border rounded-lg px-3 py-2"
              value={attendanceDays}
              onChange={(e) => setAttendanceDays(e.target.value)}
              title="Ventana asistencia"
            >
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
            </select>
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Profesor"
              value={teacherQ}
              onChange={(e) => setTeacherQ(e.target.value)}
            />
            <button
              className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow-sm"
              onClick={load}
            >
              Buscar
            </button>
            <select
              className="border rounded-lg px-3 py-2"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              title="Orden"
            >
              <option value="none">Sin ordenar</option>
              <option value="att_desc">Asistencia (desc)</option>
              <option value="att_asc">Asistencia (asc)</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && grouped.length === 0 && (
        <div className="text-gray-600">No hay resultados</div>
      )}

      <div className="space-y-8">
        {grouped.map(({ row, expectedAttendance, female, male, other, counts }) => (
          <div key={row.course.id} className="rounded-2xl border border-fuchsia-200/60 bg-gradient-to-br from-white via-fuchsia-50 to-purple-50 overflow-hidden shadow-sm">
            <div className="p-4 bg-gradient-to-r from-fuchsia-100 via-pink-100 to-purple-100 border-b border-fuchsia-200/60 grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
              <div>
                <div className="text-lg font-semibold text-gray-900">{row.course.name}</div>
                <div className="text-sm text-gray-700">Nivel: {row.course.level ?? '-'}</div>
              </div>
              <div className="text-sm text-gray-800">
                Profesor: <span className="font-medium">{row.teacher?.name ?? '-'}</span>
              </div>
              <div className="text-sm text-gray-800">Inicio: {fmtDisplayDate(row.course.start_date)}</div>
              <div className="text-sm text-gray-800">
                Valor:{' '}
                {(row.course.price !== null &&
                  row.course.price !== undefined &&
                  String(row.course.price) !== '' &&
                  !isNaN(Number(row.course.price))) ? (
                    <span className="font-medium">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(row.course.price))}
                    </span>
                  ) : (
                    '-'
                  )}
              </div>
            <div className="hidden md:flex items-center justify-end gap-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-white border border-fuchsia-200 text-gray-700">Alumnos: {counts.total}</span>
                <span className="px-2 py-1 rounded-full bg-white border text-pink-700 border-pink-200">Mujeres: {counts.female}</span>
                <span className="px-2 py-1 rounded-full bg-white border text-blue-700 border-blue-200">Hombres: {counts.male}</span>
                {other.length > 0 && (
                  <span className="px-2 py-1 rounded-full bg-white border text-gray-700 border-gray-200">Otros: {other.length}</span>
                )}
              </div>
              <Link
                to="/course-status"
                className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow-sm"
              >
                Inscribir alumno
              </Link>
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
  students: (CourseRow['students'][number] & { expected: number; attPct: number; extra: number; statusLabel: string; statusClass: string })
  onView: (id: number) => void
}

function GenderTable({ title, students, onView }: GenderTableProps) {
  return (
    <div className="rounded-2xl border border-fuchsia-200/60 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 text-sm font-semibold text-gray-800 bg-gray-50">{title}</div>
      {students.length === 0 ? (
        <div className="p-4 text-gray-600">Sin alumnos</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-left bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <th className="px-3 py-2 text-center w-10">#</th>
                <th className="px-3 py-2 w-44">Alumno</th>
                <th className="px-3 py-2 text-center w-20">Telefono</th>
                <th className="px-3 py-2 text-center w-20">Email</th>
                <th className="px-3 py-2 text-center w-24">Inicio</th>
                <th className="px-3 py-2 text-center w-28">Renovacion</th>
                <th className="px-3 py-2 text-center w-20">Pago</th>
                <th className="px-3 py-2 text-center w-24">Asist.</th>
                <th className="px-3 py-2 text-center w-24">Ver</th>
                <th className="px-3 py-2 text-left w-24">Obs</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                const EmailIcon = MdEmail
                const phoneTitle = s.phone ?? 'Sin telefono'
                const emailTitle = s.email ?? 'Sin correo'
                const paid = s.statusLabel === 'Inscrito'
                const att = s.attendance_count ?? 0

                return (
                  <tr key={s.id} className="border-t hover:bg-fuchsia-50/40">
                    <td className="px-3 py-2 text-center">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {s.birthday_today && (
                          <span title="Cumpleanos hoy" className="text-pink-600">
                            <FaBirthdayCake />
                          </span>
                        )}
                        <span>{s.first_name} {s.last_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {s.phone ? (
                        <span title={phoneTitle} className="inline-flex items-center justify-center text-green-600">
                          <FaWhatsapp />
                        </span>
                      ) : (
                        <span title={phoneTitle} className="inline-flex items-center justify-center text-gray-400">
                          <FaWhatsapp />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        title={emailTitle}
                        className={`inline-flex items-center justify-center ${s.email_ok ? 'text-blue-600' : 'text-gray-400'}`}
                      >
                        <EmailIcon />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">{fmtDisplayDate(s.enrolled_since)}</td>
                    <td className="px-3 py-2 text-center">{fmtDisplayDate(s.renewal_date)}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold border shadow-sm ${s.statusClass}`}
                      >
                        {s.statusLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[12px] ${att > s.expected ? 'text-rose-600 font-semibold' : 'text-gray-700'}`}>
                          {att} / {s.expected} {s.expected > 0 && `(${s.attPct}%)`}
                        </span>
                        {s.extra > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold px-2 py-0.5 border border-rose-100"
                            title="Excedió lo contratado"
                          >
                            +extra
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        className="px-3 py-1.5 rounded border text-xs bg-white hover:bg-fuchsia-50"
                        onClick={() => onView(s.id)}
                      >
                        Ver
                      </button>
                    </td>
                    <td className="px-3 py-2">{s.notes ?? '-'}</td>
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
