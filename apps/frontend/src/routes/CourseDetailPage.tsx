import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  attended_today?: boolean // si el backend lo envía (opcional)
}

export default function CourseDetailPage() {
  const { id } = useParams()
  const { tenantId } = useTenant()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attLoadingId, setAttLoadingId] = useState<number | null>(null)

  // IDs de alumnos que ya asistieron HOY
  const [attendedToday, setAttendedToday] = useState<Set<number>>(new Set())
  // Stats por alumno basadas en TODO el periodo de matrícula (X/Y)
  const [stuStats, setStuStats] = useState<Record<number, { expected:number; attended:number }>>({})

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
      const res = await api.get('/api/pms/course_status', { params: { course_id: Number(id), attendance_days: 30 } })
      const rows = res.data as any[]
      setData(rows[0] || null)

      // Construir set desde payload si viene 'attended_today', si no, pedirlo al endpoint liviano
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

  // Helpers y cálculo de asistencias esperadas/realizadas por alumno para TODO su periodo
  function ymd(dateLike?: string | null): string {
    if (!dateLike) return ''
    try { return new Date(dateLike).toISOString().slice(0,10) } catch { return '' }
  }
  function monthsInRange(startYMD: string, endYMD: string) {
    const out: {year:number; month:number}[] = []
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
      const next: Record<number, { expected:number; attended:number }> = {}
      for (const s of data.students as StudentRow[]) {
        const start = ymd(s.enrolled_since)
        const end   = ymd(s.renewal_date)
        if (!start || !end) { next[s.id] = { expected: 0, attended: 0 }; continue }
        let expected = 0
        let attended = 0
        const months = monthsInRange(start.slice(0,7) + '-01', end.slice(0,7) + '-01')
        for (const mm of months) {
          try {
            const res = await api.get(`/api/pms/students/${s.id}/attendance_calendar`, { params: { year: mm.year, month: mm.month } })
            const days = (res.data?.days || []) as { date: string; expected_course_ids?: number[]; attended_course_ids?: number[] }[]
            for (const d of days) {
              if (d.date >= start && d.date <= end) {
                if ((d.expected_course_ids || []).includes(courseId)) expected++
                if ((d.attended_course_ids || []).includes(courseId)) attended++
              }
            }
          } catch {}
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
    const female = students.filter(s => (s.gender||'').toLowerCase().startsWith('f') || (s.gender||'').toLowerCase().startsWith('muj')).length
    const male = students.filter(s => (s.gender||'').toLowerCase().startsWith('m') && !(s.gender||'').toLowerCase().startsWith('muj')).length
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
    return dt.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')
  }

  function renewalClass(d?: string | null) {
    if (!d) return ''
    const today = new Date()
    today.setHours(0,0,0,0)
    const rd = parseYMDLocal(d)
    if (!rd || isNaN(rd.getTime())) return ''
    rd.setHours(0,0,0,0)
    const diffDays = Math.floor((rd.getTime() - today.getTime()) / (1000*60*60*24))
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

      // Si se marcó ok (o ya estaba marcada hoy), oculta el botón:
      setAttendedToday(prev => new Set(prev).add(studentId))

      // Incrementa la barra solo si fue 'ok' (no si ya estaba marcada)
      if (status === 'ok') {
        setData((prev: any) => {
          if (!prev) return prev
          const copy = { ...prev, students: [...(prev.students ?? [])] }
          const idx = copy.students.findIndex((s: StudentRow) => s.id === studentId)
          if (idx >= 0) copy.students[idx] = { ...copy.students[idx], attendance_count: (copy.students[idx].attendance_count ?? 0) + 1 }
          return copy
        })
        // Refrescar contador del período mostrado (X/Y)
        setStuStats(prev => {
          const next = { ...prev }
          const today = new Date(); today.setHours(0,0,0,0)
          const st = (data?.students ?? []).find((x: StudentRow) => x.id === studentId)
          const start = parseYMDLocal(st?.enrolled_since)
          const end = parseYMDLocal(st?.renewal_date)
          if (start) start.setHours(0,0,0,0)
          if (end) end.setHours(0,0,0,0)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Detalle del curso</h1>
        <Link to="/courses" className="text-sm text-blue-600">Volver a cursos</Link>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data && (
        <div className="bg-white rounded shadow">
          {/* Header del curso */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              {data.course?.image_url ? (
                <img src={toAbsoluteUrl(data.course.image_url)} alt={data.course?.name} className="w-full h-40 sm:h-48 object-cover rounded" />
              ) : (
                <div className="w-full h-40 sm:h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">Sin imagen</div>
              )}
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-sm text-gray-500">Curso</div>
                <div className="font-medium">{data.course?.name}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Nivel</div>
                <div className="font-medium">{data.course?.level ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Profesor</div>
                <div className="font-medium">{data.teacher?.name ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Inicio</div>
                <div className="font-medium">{fmtDate(data.course?.start_date) ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Valor curso</div>
                <div className="font-medium">
                  {(data.course?.price != null && !isNaN(Number(data.course.price)))
                    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(data.course.price))
                    : '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Valor por clase</div>
                <div className="font-medium">
                  {(data.course?.class_price != null && !isNaN(Number(data.course.class_price)))
                    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(data.course.class_price))
                    : '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Totales */}
          <div className="px-4 pb-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2"><span role="img" aria-label="total">👥</span> Total: {counts.total}</div>
              <div className="flex items-center gap-2 text-green-700"><span>✅</span> Activos: {counts.activos}</div>
              <div className="flex items-center gap-2 text-red-700"><span>⏳</span> Pendientes: {counts.pendientes}</div>
              <div className="flex items-center gap-2 text-pink-600"><span role="img" aria-label="mujeres">👩</span> Mujeres: {counts.female}</div>
              <div className="flex items-center gap-2 text-blue-600"><span role="img" aria-label="hombres">👨</span> Hombres: {counts.male}</div>
            </div>

            {/* Tabla de alumnos */}
            <div className="mt-4 overflow-x-auto">
              {(data.students ?? []).length === 0 ? (
                <div className="text-sm text-gray-500">Sin alumnos inscritos</div>
              ) : (
                (() => {
                  const students: StudentRow[] = data.students
                  const maxAtt = Math.max(0, ...students.map(s => (stuStats[s.id]?.attended ?? 0)))
                  return (
                    <table className="min-w-full">
                      <thead>
                        <tr className="text-left bg-gray-50">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Alumno</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2">Renovación</th>
                          <th className="px-3 py-2">Asistencia</th>
                          <th className="px-3 py-2">Marcar</th>
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
                            <tr key={s.id} className="border-t">
                              <td className="px-3 py-2">{idx + 1}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {s.birthday_today && <span title="Cumpleaños hoy" className="text-pink-600">🎂</span>}
                                  {isBest && <span title="Mejor asistencia" className="text-amber-500"><FaMedal /></span>}
                                  <span className="font-medium">{s.first_name} {s.last_name}</span>
                                  {hasToday && (
                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                                      Asistió hoy
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {paid ? 'Activo' : 'Pendiente'}
                                </span>
                              </td>
                              <td className={`px-3 py-2 ${renewalClass(s.renewal_date)}`}>
                                {fmtDate(s.renewal_date)}
                              </td>
                              <td className="px-3 py-2">
                                <div className={`text-sm ${att > expected ? 'text-rose-600 font-semibold' : ''}`} title={`Asistencias del período: ${att} de ${expected}`}>
                                  {att} / {expected}
                                  {expected > 0 && (
                                    <span className="ml-2 text-xs text-gray-500">({pct}%)</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {!hasToday ? (
                                  <button
                                    className="px-3 py-1 rounded border text-sm hover:bg-emerald-50 disabled:opacity-50"
                                    onClick={() => markAttendance(s.id)}
                                    disabled={attLoadingId === s.id}
                                    title="Marcar asistencia"
                                  >
                                    {attLoadingId === s.id ? '...' : '✔ Asistencia'}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-500">—</span>
                                )}
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
