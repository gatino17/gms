import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

type PortalData = {
  student: { id:number; first_name:string; last_name:string; email?:string|null }
  enrollments: {
    id:number; is_active:boolean;
    start_date?:string|null; end_date?:string|null;
    course:{ id:number; name:string; day_of_week?:number|null; start_time?:string|null; end_time?:string|null }
  }[]
  classes_active: number
  payments: {
    total_last_90:number
    recent?: {
      id:number
      amount:number
      payment_date?:string|null
      method:string
      type:string
      reference?:string|null
    }[]
  }
}

type CalDay = { date:string; expected:boolean; attended:boolean; expected_course_ids?: number[]; attended_course_ids?: number[] }

const CL_TZ = 'America/Santiago'
const DAY_NAMES_MON_FIRST = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'] as const

function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(d)
    .reduce<Record<string,string>>((acc, p) => { if (p.type !== 'literal') acc[p.type] = p.value; return acc }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}
function ymdToCL(ymd?: string | null): string { if (!ymd) return ''; const [y,m,d] = ymd.split('-').map(Number); const dt = new Date(y, (m||1)-1, d||1); return dt.toLocaleDateString('es-CL') }
function ymdBetween(target?: string|null, start?: string|null, end?: string|null): boolean {
  if (!target || !start) return false
  if (end) return target >= start && target <= end
  return target >= start
}
function buildPaymentPeriod(p: any, enrollments?: PortalData['enrollments']): string {
  if (!enrollments || enrollments.length === 0) {
    return p?.type === 'single_class' ? (p?.payment_date ? ymdToCL(p.payment_date) : '-') : '-'
  }
  const byEnroll = enrollments.find(e => e.id === p.enrollment_id)
  if (byEnroll && p.type !== 'single_class') {
    const sd = ymdToCL(byEnroll.start_date) || '-'
    const ed = ymdToCL(byEnroll.end_date)   || '-'
    return `${sd} a ${ed}`
  }
  const byCourse = enrollments.find(e => e.course.id === p.course_id)
  if (byCourse && p.type !== 'single_class') {
    const sd = ymdToCL(byCourse.start_date) || '-'
    const ed = ymdToCL(byCourse.end_date)   || '-'
    return `${sd} a ${ed}`
  }
  const payYmd = p.payment_date ?? ''
  if (payYmd && p.type !== 'single_class') {
    const match = enrollments.find(e => ymdBetween(payYmd, e.start_date, e.end_date))
    if (match) {
      const sd = ymdToCL(match.start_date) || '-'
      const ed = ymdToCL(match.end_date)   || '-'
      return `${sd} a ${ed}`
    }
  }
  if (p.type === 'single_class') {
    return p.payment_date ? ymdToCL(p.payment_date) : '-'
  }
  return '-'
}

function resolvePaymentCourseName(p: any, enrollments?: PortalData['enrollments']): string {
  if (!enrollments || enrollments.length === 0) return ''
  const byEnroll = enrollments.find(e => e.id === p.enrollment_id)
  if (byEnroll) return byEnroll.course.name
  const byCourse = enrollments.find(e => e.course.id === p.course_id)
  if (byCourse) return byCourse.course.name
  const payYmd = p.payment_date ?? ''
  if (payYmd) {
    const match = enrollments.find(e => ymdBetween(payYmd, e.start_date, e.end_date))
    if (match) return match.course.name
  }
  return ''
}

function buildPaymentConcept(p: any, enrollments?: PortalData['enrollments']): string {
  const base = (p.type === 'monthly' ? 'Mensualidad' : (p.type === 'single_class' ? 'Clase suelta' : (p.type || 'Pago')))
  const courseName = resolvePaymentCourseName(p, enrollments)
  if (courseName) return `${base} - ${courseName}`
  if (p.reference) return `${base} - ${p.reference}`
  return base
}

// Helpers para contar ocurrencias y asistencia por curso en un periodo
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

function countWeekdayOccurrencesInRange(mon0Day: number, startYMD: string, endYMD: string) {
  const start = new Date(`${startYMD}T00:00:00`)
  const end   = new Date(`${endYMD}T00:00:00`)
  let count = 0
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const w = (d.getDay() + 6) % 7 // 0=Lun..6=Dom
    if (w === mon0Day) count++
  }
  return count
}

export default function StudentDetailPage(){
  const { id } = useParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

  // calendario
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1)
  const [calDays, setCalDays] = useState<CalDay[]>([])
  const [calLoading, setCalLoading] = useState(false)

  // modal asistencia simple
  const [showAttend, setShowAttend] = useState(false)
  const [attendDate, setAttendDate] = useState<string>('')
  const [attendCourseId, setAttendCourseId] = useState<string>('')
  const [attendSaving, setAttendSaving] = useState(false)
  const [attendError, setAttendError] = useState<string|null>(null)
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<number|null>(null)
  // editar periodo de matrícula
  const [showEdit, setShowEdit] = useState(false)
  const [editEnrollmentId, setEditEnrollmentId] = useState<number|null>(null)
  const [editStartDate, setEditStartDate] = useState<string>('')
  const [editEndDate, setEditEndDate] = useState<string>('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string|null>(null)
  const [editMethod, setEditMethod] = useState<string>('')
  const [editAmount, setEditAmount] = useState<string>('')
  const [editPaymentId, setEditPaymentId] = useState<number|null>(null)

  // cargar portal
  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true); setError(null)
      try{
        const portalRes = await api.get(`/api/pms/students/${id}/portal`)
        setData(portalRes.data)
      }catch(e:any){ setError(e?.message || 'No se pudo cargar alumno') }
      finally{ setLoading(false) }
    }
    load()
  }, [id])

  // calendario
  const fetchCalendar = async () => {
    if (!id) return
    setCalLoading(true)
    try{
      const res = await api.get(`/api/pms/students/${id}/attendance_calendar`, { params: { year: calYear, month: calMonth } })
      setCalDays(res.data?.days ?? [])
    } finally{ setCalLoading(false) }
  }
  useEffect(() => { fetchCalendar() }, [id, calYear, calMonth])
  const attendedThisMonth = useMemo(() => (calDays || []).filter(d => d.attended).length, [calDays])
  const expectedThisMonth = useMemo(() => (calDays || []).filter(d => d.expected).length, [calDays])
  const fmtCLP = useMemo(() => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }), [])

  // horario semanal (0=Lun..6=Dom)
  const schedule = useMemo(() => {
    const map = new Map<number, any[]>()
    for (let i = 0; i < 7; i++) map.set(i, [])
    for (const e of (data?.enrollments ?? [])) {
      const idx = (e.course.day_of_week ?? 0)
      if (idx >= 0 && idx <= 6) map.get(idx)!.push(e)
    }
    return map
  }, [data?.enrollments])

  // Stats de asistencia por curso (enrollment)
  const [courseStats, setCourseStats] = useState<Record<number, { expected:number; attended:number }>>({})
  useEffect(() => {
    (async () => {
      try{
        if(!id || !(data?.enrollments?.length)) return
        const next: Record<number, { expected:number; attended:number }> = {}
        for (const e of data.enrollments) {
          const start = e.start_date || ''
          const end   = e.end_date   || ''
          if (!start || !end) continue
          const courseId = e.course.id

          let attended = 0
          let expected = 0
          const months = monthsInRange(start.slice(0,7) + '-01', end.slice(0,7) + '-01')
          for (const mm of months) {
            try{
              const res = await api.get(`/api/pms/students/${id}/attendance_calendar`, { params: { year: mm.year, month: mm.month } })
              const days = (res.data?.days || []) as { date: string; attended_course_ids?: number[]; expected_course_ids?: number[] }[]
              for (const d of days) {
                if (d.date >= start && d.date <= end) {
                  if ((d.attended_course_ids || []).includes(courseId)) attended++
                  if ((d.expected_course_ids || []).includes(courseId)) expected++
                }
              }
            }catch{}
          }
          next[e.id] = { expected, attended }
        }
        setCourseStats(next)
      }catch{}
    })()
  }, [id, data?.enrollments, calDays])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight truncate">
                {data ? `${data.student.first_name} ${data.student.last_name}` : 'Alumno'}
              </h1>
              <div className="text-sm/relaxed opacity-90">{data?.student.email ?? '-'}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-white/10 hover:bg-white/20" onClick={() => { if(id){ api.get(`/api/pms/students/${id}/portal`).then(r=>setData(r.data)).finally(()=>fetchCalendar()) } }} title="Actualizar datos">Actualizar</button>
              <Link to="/students" className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-white/10 hover:bg-white/20">Volver</Link>
            </div>
          </div>
        </div>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Métricas generales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border bg-gradient-to-b from-fuchsia-50 to-white">
              <div className="text-sm text-gray-600 mb-1">Asistencia (mes actual)</div>
              <div className="text-3xl font-semibold text-gray-900">{attendedThisMonth} / {expectedThisMonth || 0}</div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded overflow-hidden">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.min(100, (attendedThisMonth/Math.max(1, expectedThisMonth))*100)}%` }} />
              </div>
            </div>
            <div className="p-4 rounded-2xl border bg-gradient-to-b from-violet-50 to-white">
              <div className="text-sm text-gray-600 mb-1">Clases activas</div>
              <div className="text-3xl font-semibold text-gray-900">{data.classes_active}</div>
              <div className="text-xs text-gray-500 mt-1">Clases semanales</div>
            </div>
            <div className="p-4 rounded-2xl border bg-gradient-to-b from-emerald-50 to-white">
              <div className="text-sm text-gray-600 mb-1">Total pagado (90 días)</div>
              <div className="text-3xl font-semibold text-gray-900">{new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }).format(Number(data.payments.total_last_90 || 0))}</div>
              <div className="text-xs text-gray-500 mt-1">Últimos pagos</div>
            </div>
          </div>

          {/* Mis cursos */}
          <div className="grid grid-cols-1 gap-4">

            <div className="rounded-2xl border p-4 bg-gradient-to-b from-gray-50 to-white">
              <div className="text-lg font-medium mb-3">Mis cursos</div>
              <div className="space-y-3">
                {(data.enrollments ?? []).map((e)=> (
                  <div key={e.id} className="p-3 rounded-xl border bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-lg font-semibold text-gray-900">{e.course.name}</div>
                      <div className="shrink-0 flex items-center gap-2">
                        <Link
                          to={`/students/${id}/renew?enrollment=${e.id}&course=${e.course.id}`}
                          className="px-2 py-1 rounded-md text-white bg-emerald-600 hover:bg-emerald-700 text-xs"
                          title="Renovar periodo"
                        >
                          Renovar
                        </Link>
                        <button
                          className="px-2 py-1 rounded-md text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-xs"
                          title="Editar periodo"
                          onClick={() => {
                            setEditEnrollmentId(e.id)
                            setEditStartDate(e.start_date || '')
                            setEditEndDate(e.end_date || '')
                            setEditError(null)
                            // detectar pago mensual asociado para prefijar monto/método
                            const all = (data?.payments?.recent || []) as any[]
                            const byEnroll = all.find(p => p.type === 'monthly' && (p.enrollment_id === e.id))
                            const byCourse = all.find(p => p.type === 'monthly' && (p.course_id === e.course.id))
                            const byDate = all.find(p => p.type === 'monthly' && p.payment_date && (
                              (!e.start_date || p.payment_date >= e.start_date) && (!e.end_date || p.payment_date <= e.end_date)
                            ))
                            const target = byEnroll || byCourse || byDate || null
                            setEditPaymentId(target?.id ?? null)
                            setEditAmount(target?.amount != null ? String(target.amount) : '')
                            setEditMethod(target?.method || '')
                            setShowEdit(true)
                          }}
                        >Editar</button>
                        <button
                          className="px-2 py-1 rounded-md text-white bg-rose-600 hover:bg-rose-700 text-xs disabled:opacity-60"
                          title="Eliminar curso"
                          disabled={deletingEnrollmentId === e.id}
                          onClick={async ()=>{
                            if(!confirm('¿Eliminar este curso? Esta acción no se puede deshacer.')) return
                            try{
                              setDeletingEnrollmentId(e.id)
                              await api.delete(`/api/pms/enrollments/${e.id}`)
                              // refrescar datos
                              if(id){ const res = await api.get(`/api/pms/students/${id}/portal`); setData(res.data) }
                              await fetchCalendar()
                            }catch(err:any){ alert(err?.message || 'No se pudo eliminar el curso') }
                            finally{ setDeletingEnrollmentId(null) }
                          }}
                        >Eliminar</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-gray-700 mt-2">
                      <div>
                        <div className="text-gray-500 text-xs">Horario</div>
                        <div>
                          {[
                            DAY_NAMES_MON_FIRST[(e.course.day_of_week ?? 0)],
                            (e.course.start_time||'').slice(0,5),
                            e.course.end_time ? ` - ${(e.course.end_time||'').slice(0,5)}` : ''
                          ].filter(Boolean).join(' ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Estado</div>
                        <div>{e.is_active ? 'Inscrito' : 'Inactivo'}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Periodo</div>
                        <div>{e.start_date ? ymdToCL(e.start_date) : '-'} {e.end_date ? `a ${ymdToCL(e.end_date)}` : ''}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 text-xs">Asistencias</div>
                        {(() => {
                          const attended = (courseStats[e.id]?.attended ?? 0)
                          const expected = (courseStats[e.id]?.expected ?? 0)
                          const over = attended > expected
                          return (
                            <div className={over ? 'text-rose-600 font-semibold' : ''}>
                              {attended} / {expected}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-amber-300 border border-amber-500 rounded"></span> Extra (no esperado)
              </div>
            </div>
          </div>

          {/* Modal: Editar periodo de matrícula */}
          {showEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={()=>setShowEdit(false)} />
              <div className="relative z-10 bg-white rounded-2xl shadow-xl w-[95%] max-w-lg p-4">
                <div className="text-lg font-semibold">Editar periodo</div>
                <div className="text-sm text-gray-700">Actualiza fechas de inicio y fin.</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Inicio</div>
                    <input type="date" className="w-full border rounded px-3 py-2" value={editStartDate} onChange={e=>setEditStartDate(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Fin</div>
                    <input type="date" className="w-full border rounded px-3 py-2" value={editEndDate} onChange={e=>setEditEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Método de pago</div>
                    <input type="text" className="w-full border rounded px-3 py-2" placeholder="efectivo / transferencia / ..." value={editMethod} onChange={e=>setEditMethod(e.target.value)} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Monto</div>
                    <input type="number" className="w-full border rounded px-3 py-2" placeholder="25000" value={editAmount} onChange={e=>setEditAmount(e.target.value)} />
                  </div>
                </div>

                {editError && <div className="mt-2 text-sm text-rose-700">{editError}</div>}

                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-2 rounded-lg border" onClick={()=>setShowEdit(false)} disabled={editSaving}>Cancelar</button>
                  <button
                    className="px-3 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                    disabled={editSaving || !editEnrollmentId}
                    onClick={async()=>{
                      try{
                        if(!editEnrollmentId) return
                        setEditSaving(true); setEditError(null)
                        await api.patch(`/api/pms/enrollments/${editEnrollmentId}`, {
                          start_date: editStartDate || null,
                          end_date: editEndDate || null,
                        })
                        if (editPaymentId) {
                          await api.patch(`/api/pms/payments/${editPaymentId}`, {
                            method: editMethod || undefined,
                            amount: Number(editAmount || 0)
                          })
                        }
                        // refrescar portal e historial (periodo
                        if(id){ const res = await api.get(`/api/pms/students/${id}/portal`); setData(res.data) }
                        await fetchCalendar()
                        setShowEdit(false)
                      }catch(e:any){ setEditError(e?.message || 'No se pudo guardar') } finally { setEditSaving(false) }
                    }}
                  >Guardar</button>
                </div>
              </div>
            </div>
          )}

          {/* Calendario de asistencia */}
          <div className="rounded-2xl border p-4 bg-gradient-to-b from-purple-50 to-white">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-medium">Asistencia por mes</div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 rounded-lg text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700" onClick={()=>{ const m = calMonth-1; if(m<1){ setCalMonth(12); setCalYear(y=>y-1) } else { setCalMonth(m) } }} aria-label="Mes anterior">&lt;</button>
                <div className="text-sm text-gray-700 w-28 text-center">{new Date(calYear, calMonth-1, 1).toLocaleDateString('es-CL', { month:'long', year:'numeric' })}</div>
                <button className="px-2 py-1 rounded-lg text-white bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700" onClick={()=>{ const m = calMonth+1; if(m>12){ setCalMonth(1); setCalYear(y=>y+1) } else { setCalMonth(m) } }} aria-label="Mes siguiente">&gt;</button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs text-gray-600 mb-1">
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
                <div key={d} className="text-center py-1">{d}</div>
              ))}
            </div>

            {calLoading ? (
              <div className="text-sm text-gray-500">Cargando calendario...</div>
            ) : (
              (() => {
                const first = new Date(calYear, calMonth-1, 1)
                const offset = first.getDay()
                const boxes:any[] = []
                for(let i=0;i<offset;i++) boxes.push(<div key={'b'+i} className="p-3" />)

                const daysInMonth = new Date(calYear, calMonth, 0).getDate()
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = toYMDInTZ(new Date(calYear, calMonth - 1, d), CL_TZ)
                  const rec = calDays.find(x => x.date === dateStr)
                  const expected = !!rec?.expected
                  const attended = !!rec?.attended
                  const expectedIds = (rec?.expected_course_ids ?? []) as number[]
                  const attendedIds = (rec?.attended_course_ids ?? []) as number[]
                  const extraIds = attendedIds.filter(id => !expectedIds.includes(id))
                  const hasExtra = attended && extraIds.length > 0

                  let cls = 'border bg-white'
                  if (hasExtra) cls = 'bg-amber-100 border border-amber-300'
                  else if (attended) cls = 'bg-green-100 border border-green-300'
                  else if (expected && !attended) cls = 'bg-red-100 border border-red-300'

                  boxes.push(
                    <button
                      key={dateStr}
                      type="button"
                      className={`p-2 rounded relative text-left ${cls} ${expected ? 'hover:ring-2 hover:ring-emerald-200' : ''}`}
                      onClick={async () => {
                        try {
                          if (!id || !data) return
                          const rec = calDays.find(x => x.date === dateStr)
                          const expectedIds = (rec?.expected_course_ids ?? []) as number[]
                          const attendedIds = (rec?.attended_course_ids ?? []) as number[]

                          if ((attendedIds?.length || 0) === 1) {
                            const cid = attendedIds[0]
                            setAttendError(null)
                            setAttendDate(dateStr)
                            setAttendCourseId(String(cid))
                            setShowAttend(true)
                            return
                          }
                          if ((expectedIds?.length || 0) === 1 && !attended) {
                            const cid = expectedIds[0]
                            await api.post('/api/pms/attendance', { student_id: Number(id), course_id: cid, date: dateStr })
                            await fetchCalendar()
                            return
                          }

                          setAttendError(null)
                          setAttendDate(dateStr)
                          const dt = new Date(dateStr)
                          const mon0 = (dt.getDay() + 6) % 7 // 0=Lun..6=Dom
                          let candidates = (data.enrollments||[]).filter(e => {
                            const within = (!e.start_date || dateStr >= e.start_date) && (!e.end_date || dateStr <= e.end_date)
                            return (e.course.day_of_week ?? -1) === mon0 && within
                          })
                          if (candidates.length === 0) candidates = (data.enrollments||[])
                          const firstId = candidates[0]?.course?.id
                          setAttendCourseId(firstId ? String(firstId) : '')
                          setShowAttend(true)
                        } catch (e:any) {
                          alert(e?.message || 'No se pudo actualizar asistencia')
                        }
                      }}
                      title={(function(){
                        const base = attended ? 'Click para ajustar asistencia' : (expected ? 'Click para marcar asistencia' : 'Click para gestionar asistencia')
                        if (extraIds.length > 0) {
                          const idToName = new Map((data?.enrollments||[]).map((e:any)=>[e.course.id, e.course.name]))
                          const names = extraIds.map(id => idToName.get(id) || `Curso ${id}`)
                          return `${base} — Extra: ${names.join(', ')}`
                        }
                        return base
                      })()}
                    >
                      <div className="text-xs text-gray-700">{d}</div>
                      {attended && (
                        <div className={`absolute bottom-1 right-1 text-[10px] leading-none font-bold ${hasExtra ? 'text-amber-700' : 'text-green-800'}`}>V</div>
                      )}
                    </button>
                  )
                }
                return <div className="grid grid-cols-7 gap-1">{boxes}</div>
              })()
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-green-300 border border-green-500 rounded"></span> Asistió <span className="ml-1 text-[10px] font-bold text-green-800">V</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 bg-red-300 border border-red-500 rounded"></span> No asistió
              </div>
            </div>
          </div>

          {/* Historial de pagos (agrupado) */}
          {(data.payments?.recent?.length ?? 0) > 0 && (
            <div className="rounded-2xl border p-4 bg-white">
              <div className="text-lg font-medium mb-2">Historial de pagos (agrupado)</div>
              {(() => {
                const all = [...(data.payments?.recent || [])]
                const sortFn = (a:any,b:any) => (b.payment_date||'').localeCompare(a.payment_date||'')
                const monthly = all.filter(p => p.type === 'monthly').sort(sortFn)
                const single  = all.filter(p => p.type === 'single_class').sort(sortFn)
                const others  = all.filter(p => p.type !== 'monthly' && p.type !== 'single_class').sort(sortFn)
                const Table = ({rows, getRowClass}:{rows:any[], getRowClass?:(p:any)=>string}) => (
                  <div className="overflow-auto rounded-xl border">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-left">
                        <tr>
                          <th className="px-3 py-2">Fecha</th>
                          <th className="px-3 py-2">Concepto</th>
                          <th className="px-3 py-2">Periodo</th>
                          <th className="px-3 py-2">M\u00E9todo</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((p:any) => (
                          <tr key={p.id} className={`border-t ${getRowClass ? getRowClass(p) : ''}`}>
                            <td className="px-3 py-2">{p.payment_date ? ymdToCL(p.payment_date) : '-'}</td>
                            <td className="px-3 py-2">{buildPaymentConcept(p, data?.enrollments)}</td>
                            <td className="px-3 py-2">{buildPaymentPeriod(p, data?.enrollments)}</td>
                            <td className="px-3 py-2">{p.method || '-'}</td>
                            <td className="px-3 py-2 text-right">{fmtCLP.format(Number(p.amount||0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
                return (
                  <div className="space-y-3">
                    {monthly.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 my-1">
                          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Mensualidad</div>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Table rows={monthly} getRowClass={() => 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white'} />
                      </div>
                    )}
                    {single.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 my-1">
                          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Clases sueltas</div>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Table rows={single} getRowClass={() => 'bg-yellow-50'} />
                      </div>
                    )}
                    {others.length > 0 && (
                      <div>
                        <div className="flex items-center gap-3 my-1">
                          <div className="text-sm font-semibold text-gray-700 whitespace-nowrap">Otros</div>
                          <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <Table rows={others} getRowClass={(p:any) => (p.type === 'normal' || p.type === 'coreografia') ? 'bg-gradient-to-r from-fuchsia-50 to-purple-50' : ''} />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          

          {/* Modal asistencia */}
          {showAttend && data && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={()=>setShowAttend(false)} />
              <div className="relative z-10 bg-white rounded-2xl shadow-xl w-[95%] max-w-lg p-4">
                <div className="text-lg font-semibold">Ajustar asistencia</div>
                <div className="text-sm text-gray-700">Fecha: {ymdToCL(attendDate)}</div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Curso</div>
                    <select className="w-full border rounded px-3 py-2" value={attendCourseId} onChange={e=>setAttendCourseId(e.target.value)}>
                      <option value="">Seleccione curso</option>
                      {(() => {
                        const base = (data.enrollments||[]).filter(e=>{
                          if(!attendDate) return true
                          const dt = new Date(attendDate)
                          const mon0 = (dt.getDay() + 6) % 7
                          const within = (!e.start_date || attendDate >= e.start_date) && (!e.end_date || attendDate <= e.end_date)
                          return (e.course.day_of_week ?? -1) === mon0 && within
                        })
                        const list = base.length ? base : (data.enrollments||[])
                        return list.map(e => (
                          <option key={e.id} value={String(e.course.id)}>{e.course.name}</option>
                        ))
                      })()}
                    </select>
                  </div>
                  <div className="text-xs text-gray-600">Seleccione un curso para esta fecha y use las acciones para marcar o quitar la asistencia.</div>
                </div>

                {attendError && <div className="mt-2 text-sm text-rose-700">{attendError}</div>}

                <div className="mt-4 flex justify-end gap-2">
                  <button className="px-3 py-2 rounded-lg border" onClick={()=>setShowAttend(false)} disabled={attendSaving}>Cerrar</button>
                  <button className="px-3 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60" disabled={attendSaving || !attendCourseId}
                    onClick={async()=>{
                      try{
                        setAttendSaving(true); setAttendError(null)
                        if(!id) throw new Error('Sin alumno')
                        await api.post('/api/pms/attendance', { student_id: Number(id), course_id: Number(attendCourseId), date: attendDate })
                        await fetchCalendar(); setShowAttend(false)
                      }catch(e:any){ setAttendError(e?.message||'No se pudo marcar') } finally { setAttendSaving(false) }
                    }}
                  >Marcar presente</button>
                  <button className="px-3 py-2 rounded-lg text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60" disabled={attendSaving || !attendCourseId}
                    onClick={async()=>{
                      try{
                        setAttendSaving(true); setAttendError(null)
                        if(!id) throw new Error('Sin alumno')
                        await api.delete('/api/pms/attendance', { params: { student_id: Number(id), course_id: Number(attendCourseId), attended_date: attendDate } })
                        await fetchCalendar(); setShowAttend(false)
                      }catch(e:any){ setAttendError(e?.message||'No se pudo quitar') } finally { setAttendSaving(false) }
                    }}
                  >Quitar asistencia</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
