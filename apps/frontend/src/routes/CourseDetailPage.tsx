import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { FaMedal } from 'react-icons/fa'

type StudentRow = {
  id: number
  first_name: string
  last_name: string
  gender?: string | null
  enrolled_since?: string | null
  renewal_date?: string | null
  payment_status?: 'activo' | 'pendiente'
  attendance_count?: number
  birthday_today?: boolean
  attended_today?: boolean
}

export default function CourseDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { tenantId } = useTenant()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attLoadingId, setAttLoadingId] = useState<number | null>(null)

  const [attendedToday, setAttendedToday] = useState<Set<number>>(new Set())
  const [stuStats, setStuStats] = useState<Record<number, { expected: number; attended: number }>>({})

  const buildAttendedSetFromData = (rows: any[] | null) => {
    const s = new Set<number>()
    const row = rows?.[0]
    if (row?.students) {
      for (const st of row.students as StudentRow[]) {
        if (st.attended_today) s.add(st.id)
      }
    }
    return s
  }

  const fetchTodayAttendance = async () => {
    if (!id) return new Set<number>()
    try {
      const res = await api.get('/api/pms/attendance/today', { params: { course_id: Number(id) } })
      const arr: number[] = res.data?.student_ids ?? []
      return new Set(arr)
    } catch {
      return new Set<number>()
    }
  }

  const fetchDetail = async () => {
    if (!id || tenantId == null) return
    setLoading(true); setError(null)
    try {
      const res = await api.get('/api/pms/course_status', {
        params: { course_id: Number(id), attendance_days: 30 },
      })
      const rows = res.data as any[]
      setData(rows[0] || null)

      const fromPayload = buildAttendedSetFromData(rows)
      if (fromPayload.size > 0) {
        setAttendedToday(fromPayload)
      } else {
        const fromApi = await fetchTodayAttendance()
        setAttendedToday(fromApi)
      }
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el curso')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDetail() }, [id, tenantId])

  function ymd(dateLike?: string | null): string {
    if (!dateLike) return ''
    try { return new Date(dateLike).toISOString().slice(0, 10) } catch { return '' }
  }

  function monthsInRange(startYMD: string, endYMD: string) {
    const out: { year: number; month: number }[] = []
    const [sy, sm] = startYMD.split('-').map(Number)
    const [ey, em] = endYMD.split('-').map(Number)
    let y = sy, m = sm
    while (y < ey || (y === ey && m <= em)) {
      out.push({ year: y, month: m })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return out
  }

  useEffect(() => {
    (async () => {
      if (!id || !(data?.students?.length)) { setStuStats({}); return }
      const courseId = Number(id)
      const next: Record<number, { expected: number; attended: number }> = {}
      for (const s of data.students as StudentRow[]) {
        const start = ymd(s.enrolled_since)
        const end = ymd(s.renewal_date)
        if (!start || !end) { next[s.id] = { expected: 0, attended: 0 }; continue }

        let expected = 0
        let attended = 0
        const months = monthsInRange(start.slice(0, 7) + '-01', end.slice(0, 7) + '-01')
        for (const mm of months) {
          try {
            const res = await api.get(`/api/pms/students/${s.id}/attendance_calendar`, {
              params: { year: mm.year, month: mm.month },
            })
            const days = (res.data?.days || []) as {
              date: string
              expected_course_ids?: number[]
              attended_course_ids?: number[]
            }[]
            for (const d of days) {
              if (d.date >= start && d.date <= end) {
                if ((d.expected_course_ids || []).includes(courseId)) expected++
                if ((d.attended_course_ids || []).includes(courseId)) attended++
              }
            }
          } catch { }
        }
        next[s.id] = { expected, attended }
      }
      setStuStats(next)
    })()
  }, [id, data?.students])

  const counts = useMemo(() => {
    const students: StudentRow[] = data?.students ?? []
    const total = students.length
    const activos = students.filter(s => s.payment_status === 'activo').length
    const pendientes = total - activos
    const female = students.filter(s =>
      (s.gender || '').toLowerCase().startsWith('f') ||
      (s.gender || '').toLowerCase().startsWith('muj')
    ).length
    const male = students.filter(s =>
      (s.gender || '').toLowerCase().startsWith('m') &&
      !(s.gender || '').toLowerCase().startsWith('muj')
    ).length
    return { total, activos, pendientes, female, male }
  }, [data])

  const parseYMDLocal = (d?: string | null) => {
    if (!d) return null
    const parts = d.split('-')
    if (parts.length !== 3) return null
    const [y, m, day] = parts.map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(day)) return null
    return new Date(y, m - 1, day)
  }

  function fmtDate(d?: string | null) {
    const dt = parseYMDLocal(d)
    if (!dt || isNaN(dt.getTime())) return d || '-'
    return dt
      .toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
      .replace('.', '')
  }

  function renewalClass(d?: string | null) {
    if (!d) return ''
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rd = parseYMDLocal(d)
    if (!rd || isNaN(rd.getTime())) return ''
    rd.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((rd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'text-red-600 font-medium'
    if (diffDays <= 3) return 'text-amber-600 font-medium'
    return 'text-gray-800'
  }

  async function markAttendance(studentId: number) {
    if (!id) return
    try {
      setAttLoadingId(studentId)
      const res = await api.post('/api/pms/attendance', {
        student_id: studentId,
        course_id: Number(id),
      })
      const status = res.data?.status

      setAttendedToday(prev => new Set(prev).add(studentId))

      if (status === 'ok') {
        setData((prev: any) => {
          if (!prev) return prev
          const copy = { ...prev, students: [...(prev.students ?? [])] }
          const idx = copy.students.findIndex((s: StudentRow) => s.id === studentId)
          if (idx >= 0) {
            copy.students[idx] = {
              ...copy.students[idx],
              attendance_count: (copy.students[idx].attendance_count ?? 0) + 1,
            }
          }
          return copy
        })

        setStuStats(prev => {
          const next = { ...prev }
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const st = (data?.students ?? []).find((x: StudentRow) => x.id === studentId)
          const start = parseYMDLocal(st?.enrolled_since)
          const end = parseYMDLocal(st?.renewal_date)
          if (start) start.setHours(0, 0, 0, 0)
          if (end) end.setHours(0, 0, 0, 0)
          if (st && start && end && today >= start && today <= end) {
            const cur = next[studentId] || { expected: 0, attended: 0 }
            next[studentId] = { ...cur, attended: cur.attended + 1 }
          }
          return next
        })
      }
    } catch (e: any) {
      alert(e?.message || 'No se pudo marcar asistencia')
    } finally {
      setAttLoadingId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Detalle del curso
          </h1>
          <p className="text-sm text-gray-500">
            Revisa información del curso, estado de alumnos y asistencias.
          </p>
        </div>
        <Link
          to="/courses"
          className="text-sm px-3 py-1.5 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
        >
          ← Volver a cursos
        </Link>
      </div>

      {loading && (
        <div className="bg-white/80 rounded-2xl shadow p-6 text-sm text-gray-600">
          Cargando...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="bg-white/80 rounded-3xl shadow-md border border-gray-100 overflow-hidden">
          {/* HERO CON DEGRADÉ + IMAGEN CON FADE */}
          <div className="bg-gradient-to-r from-fuchsia-500 via-purple-600 to-sky-500">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
              {/* LADO IZQUIERDO: INFO */}
              <div className="px-4 py-5 md:px-6 md:py-6 flex flex-col justify-center space-y-3 text-white">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/20 text-[11px] uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    Curso activo en Puerto Montt Salsa
                  </div>
                  <h2 className="mt-2 text-xl md:text-2xl font-semibold leading-snug">
                    {data.course?.name ?? 'Curso sin nombre'}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-white/70">Nivel</div>
                    <div className="font-medium">
                      {data.course?.level ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-white/70">Profesor</div>
                    <div className="font-medium">
                      {data.teacher?.name ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-white/70">Inicio</div>
                    <div className="font-medium">
                      {fmtDate(data.course?.start_date) ?? '-'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-[11px]">
                        {data.course?.classes_per_week
                          ? `${data.course.classes_per_week} clases / semana`
                          : 'Clases por semana no configuradas'}
                      </span>
                      {data.course?.total_classes && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/10 text-[11px]">
                          {data.course.total_classes} clases aprox. por período
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-sm pt-1">
                  <div className="px-3 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/20">
                    <div className="text-[11px] uppercase text-white/70">
                      Valor curso
                    </div>
                    <div className="text-base font-semibold">
                      {(data.course?.price != null && !isNaN(Number(data.course.price)))
                        ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(data.course.price))
                        : '—'}
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/20">
                    <div className="text-[11px] uppercase text-white/70">
                      Valor por clase
                    </div>
                    <div className="text-base font-semibold">
                      {(data.course?.class_price != null && !isNaN(Number(data.course.class_price)))
                        ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(data.course.class_price))
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* LADO DERECHO: IMAGEN CON FADE TRANSPARENTE HACIA EL DEGRADÉ */}
              <div className="relative h-40 sm:h-48 md:h-full">
                {data.course?.image_url ? (
                  <div className="absolute inset-0">
                    <img
                      src={toAbsoluteUrl(data.course.image_url)}
                      alt={data.course?.name}
                      className="w-full h-full object-cover"
                      style={{
                        WebkitMaskImage:
                          'linear-gradient(to right, transparent 0%, black 35%, black 100%)',
                        maskImage:
                          'linear-gradient(to right, transparent 0%, black 35%, black 100%)',
                      }}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80 bg-white/10">
                    Sin imagen
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CUERPO: RESUMEN + TABLA */}
          <div className="px-4 md:px-6 pb-5 pt-4 md:pt-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 text-sm mb-5">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] uppercase text-gray-500">Total alumnos</span>
                <span className="mt-1 text-lg font-semibold text-gray-900 flex items-center gap-1">
                  👥 {counts.total}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] uppercase text-emerald-700/80">Activos</span>
                <span className="mt-1 text-lg font-semibold text-emerald-800 flex items-center gap-1">
                  ✅ {counts.activos}
                </span>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] uppercase text-amber-700/80">Pendientes</span>
                <span className="mt-1 text-lg font-semibold text-amber-800 flex items-center gap-1">
                  ⏳ {counts.pendientes}
                </span>
              </div>
              <div className="rounded-xl border border-pink-100 bg-pink-50/70 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] uppercase text-pink-700/80">Mujeres</span>
                <span className="mt-1 text-lg font-semibold text-pink-800 flex items-center gap-1">
                  👩 {counts.female}
                </span>
              </div>
              <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5 flex flex-col">
                <span className="text-[11px] uppercase text-sky-700/80">Hombres</span>
                <span className="mt-1 text-lg font-semibold text-sky-800 flex items-center gap-1">
                  👨 {counts.male}
                </span>
              </div>
            </div>

            <div className="mt-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white">
              {(data.students ?? []).length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  Sin alumnos inscritos.
                </div>
              ) : (
                (() => {
                  const students: StudentRow[] = data.students
                  const maxAtt = Math.max(0, ...students.map(s => (stuStats[s.id]?.attended ?? 0)))
                  return (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left bg-gray-50/80 border-b border-gray-100 text-xs text-gray-600">
                          <th className="px-3 py-2.5 font-medium">#</th>
                          <th className="px-3 py-2.5 font-medium">Alumno</th>
                          <th className="px-3 py-2.5 font-medium">Estado</th>
                          <th className="px-3 py-2.5 font-medium">Renovación</th>
                          <th className="px-3 py-2.5 font-medium">Asistencia</th>
                          <th className="px-3 py-2.5 font-medium">Marcar</th>
                          <th className="px-3 py-2.5 font-medium text-center">Ver</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s, idx) => {
                          const paid = s.payment_status === 'activo'
                          const att = stuStats[s.id]?.attended ?? 0
                          const expected = stuStats[s.id]?.expected ?? 0
                          const pct = expected > 0 ? Math.round((att / expected) * 100) : 0
                          const isBest = att === maxAtt && maxAtt > 0
                          const hasToday = attendedToday.has(s.id) || !!s.attended_today

                          return (
                            <tr
                              key={s.id}
                              className={`border-t border-gray-100 ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                              }`}
                            >
                              <td className="px-3 py-2.5 text-xs text-gray-500">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  {s.birthday_today && (
                                    <span
                                      title="Cumpleaños hoy"
                                      className="text-pink-500 text-base"
                                    >
                                      🎂
                                    </span>
                                  )}
                                  {isBest && (
                                    <span
                                      title="Mejor asistencia"
                                      className="text-amber-500 text-sm"
                                    >
                                      <FaMedal />
                                    </span>
                                  )}
                                  <div className="flex flex-col">
                                    <span className="font-medium text-gray-900">
                                      {s.first_name} {s.last_name}
                                    </span>
                                    {hasToday && (
                                      <span className="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px]">
                                        Asistió hoy
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    paid
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-red-50 text-red-700 border border-red-100'
                                  }`}
                                >
                                  {paid ? 'Activo' : 'Pendiente'}
                                </span>
                              </td>
                              <td className={`px-3 py-2.5 ${renewalClass(s.renewal_date)}`}>
                                {fmtDate(s.renewal_date)}
                              </td>
                              <td className="px-3 py-2.5">
                                <div
                                  className={`text-sm ${
                                    att > expected ? 'text-rose-600 font-semibold' : 'text-gray-800'
                                  }`}
                                  title={`Asistencias del período: ${att} de ${expected}`}
                                >
                                  {att} / {expected}
                                  {expected > 0 && (
                                    <span className="ml-1.5 text-xs text-gray-500">
                                      ({pct}%)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {!hasToday ? (
                                  <button
                                    className="px-3 py-1.5 rounded-full border border-emerald-200 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
                                    onClick={() => markAttendance(s.id)}
                                    disabled={attLoadingId === s.id}
                                    title="Marcar asistencia"
                                  >
                                    {attLoadingId === s.id ? 'Marcando...' : '✔ Asistencia'}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  className="px-3 py-1.5 rounded border text-xs bg-white hover:bg-gray-50"
                                  onClick={() => navigate(`/students/${s.id}`)}
                                >
                                  Ver
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
