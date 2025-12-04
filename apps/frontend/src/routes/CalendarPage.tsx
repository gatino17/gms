import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'

type Course = {
  id: number
  name: string
  day_of_week?: number | null // 0=Lunes ... 6=Domingo
  start_time?: string | null  // "HH:mm"
  end_time?: string | null    // "HH:mm"
  start_date?: string | null
  teacher_name?: string | null
}

const DAY_NAMES = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo']
const hhmm = (t?: string | null) => (t ? String(t).slice(0,5) : '--:--')
const fmtDateISO = (d?: string | null) => {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CL', { day:'2-digit', month:'short', year:'numeric' }).replace('.', '')
}
const toHour = (t?: string | null) => {
  if (!t) return null
  const [hh] = t.split(':'); const n = Number(hh)
  return Number.isFinite(n) ? n : null
}
const pad2 = (n:number) => String(n).padStart(2,'0')

// Paleta de degradés (un color por profesor)
const THEME_GRADIENTS: { from: string; to: string }[] = [
  { from: 'hsl(220 90% 60%)', to: 'hsl(290 85% 60%)' }, // azul→púrpura
  { from: 'hsl(300 90% 60%)', to: 'hsl(255 90% 60%)' }, // fucsia→violeta
  { from: 'hsl(190 95% 50%)', to: 'hsl(225 90% 55%)' }, // cian→azul
  { from: 'hsl(90 80% 55%)',  to: 'hsl(150 80% 50%)' }, // lima→verde
  { from: 'hsl(20 95% 55%)',  to: 'hsl(335 90% 60%)' }, // naranja→rosa
  { from: 'hsl(170 80% 45%)', to: 'hsl(265 85% 60%)' }, // teal→violeta
]
const hashString = (s: string) => { let h=0; for (let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0 } return Math.abs(h) }
const teacherGradient = (name: string | null | undefined) => {
  const { from, to } = THEME_GRADIENTS[hashString(name || 'teacher') % THEME_GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

export default function CalendarWeekResponsive() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load cursos
  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const res = await api.get('/api/pms/courses', { params: { limit: 500 } })
        const list = (res.data as any)?.items ?? res.data ?? []
        const norm: Course[] = list.map((c:any) => ({
          id: c.id,
          name: c.name,
          day_of_week: c.day_of_week == null ? null : Number(c.day_of_week),
          start_time: c.start_time ? String(c.start_time).slice(0,5) : null,
          end_time: c.end_time ? String(c.end_time).slice(0,5) : null,
          start_date: c.start_date ?? null,
          teacher_name: c.teacher_name ?? null,
        }))
        setData(norm)
      } catch (e:any) {
        setError(e?.message ?? 'Error cargando calendario')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId])

  // Rangos y matrices para vista semanal
  const { hoursAsc } = useMemo(() => {
    let minH = 23, maxH = 0
    for (const c of data) {
      const a = toHour(c.start_time)
      const b = toHour(c.end_time)
      if (a != null) minH = Math.min(minH, a)
      if (b != null) maxH = Math.max(maxH, Math.max(a ?? b ?? 0, b ?? a ?? 0))
    }
    if (minH === 23 && maxH === 0) { minH = 8; maxH = 22 }
    minH = Math.max(0, minH)
    maxH = Math.min(23, Math.max(maxH, (minH+1)))
    const asc = Array.from({length: (maxH - minH)}, (_,i)=> minH + i)
    return { hoursAsc: asc }
  }, [data])

  const matrix = useMemo(() => {
    const m: Record<number, Record<number, Course[]>> = {}
    for (const h of hoursAsc) { m[h] = {}; for (let d=0; d<7; d++) m[h][d] = [] }
    for (const c of data) {
      const d = (c.day_of_week ?? -1)
      const h = toHour(c.start_time)
      if (d >= 0 && d <= 6 && h != null && m[h]) m[h][d].push(c)
    }
    for (const h of hoursAsc) for (let d=0; d<7; d++)
      m[h][d].sort((a,b)=> (a.start_time||'') < (b.start_time||'') ? -1 : 1)
    return m
  }, [data, hoursAsc])

  // Agrupado por día para vista listado (móvil)
  const groupedMobile = useMemo(() => {
    const map = new Map<number | 'nd', { label: string, items: Course[] }>()
    for (const c of data) {
      const k = (typeof c.day_of_week === 'number' ? c.day_of_week : 'nd') as number | 'nd'
      if (!map.has(k)) {
        map.set(k, { label: k === 'nd' ? 'Sin día' : DAY_NAMES[k], items: [] })
      }
      map.get(k)!.items.push(c)
    }
    return Array.from(map.entries())
      .sort((a,b)=> (a[0] === 'nd' ? 99 : (a[0] as number)) - (b[0] === 'nd' ? 99 : (b[0] as number)))
      .map(([, v]) => ({
        label: v.label,
        items: v.items.sort((a,b)=> (a.start_time||'') < (b.start_time||'') ? -1 : 1)
      }))
  }, [data])

  return (
    <div className="space-y-5">
      {/* Header estilo "Crear curso" */}
      <div className="rounded-2xl shadow overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-semibold tracking-tight">
            Calendario — Semana
          </h1>
          <div className="text-sm md:text-base font-medium">
            {new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border bg-white p-6 animate-pulse shadow-sm">
          <div className="h-4 w-48 bg-gray-200 rounded mb-4" />
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      )}
      {error && <div className="text-red-600">{error}</div>}

      {/* ===== Vista Semana (desktop / lg+) ===== */}
      {!loading && !error && (
        <div className="hidden lg:block">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1100px] rounded-2xl border shadow-sm overflow-hidden bg-white">
              {/* Cabecera días (suave) */}
              <div className="grid sticky top-0 z-10" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
                <div className="px-3 py-3 bg-white border-b">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[12px] text-slate-700">
                    Horario
                  </div>
                </div>
                {DAY_NAMES.map((d, i) => (
                  <div key={i} className="px-3 py-3 bg-white border-b text-sm font-semibold text-slate-700 text-center">
                    <div className="inline-flex items-center gap-2">
                      <span>{d}</span>
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${(i*38)%360} 70% 55%)`, opacity: 0.35 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Cuerpo */}
              <div className="bg-white">
                {hoursAsc.map((h, rowIdx) => {
                  const label = `${pad2(h)}:00 – ${pad2(h+1)}:00`
                  return (
                    <div key={h} className="grid" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
                      {/* Gutter de horas */}
                      <div className={`px-3 py-2 border-r ${rowIdx===0 ? '' : 'border-t'}`}>
                        <div className="flex items-center justify-center">
                          <div className="rounded-full px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 text-[12px] font-mono">
                            {label}
                          </div>
                        </div>
                      </div>

                      {/* Celdas diarias */}
                      {DAY_NAMES.map((_, dayIdx) => {
                        const items = (matrix[h]?.[dayIdx] ?? [])
                        return (
                          <div
                            key={dayIdx}
                            className={`px-2 py-2 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${rowIdx===0 ? 'border-t' : ''} ${dayIdx===6 ? '' : 'border-r'} border-slate-100`}
                          >
                            {items.length === 0 ? (
                              <div className="h-12 rounded-xl border border-dashed border-slate-200 bg-white/70" />
                            ) : (
                              <div className="flex flex-col gap-2">
                                {items.map((c) => (
                                  <div
                                    key={c.id}
                                    className="px-3 py-2 rounded-2xl text-white shadow-sm border border-white/20 hover:shadow-md transition"
                                    style={{ background: teacherGradient(c.teacher_name) }}
                                    title={`${c.name} · ${hhmm(c.start_time)}${c.end_time ? `–${hhmm(c.end_time)}` : ''}`}
                                  >
                                    {/* Sin hora adentro (hora va en el gutter) */}
                                    <div className="text-[13px] font-semibold leading-5 truncate">{c.name}</div>
                                    <div className="mt-1 text-[12px] opacity-95 space-x-3 flex items-center flex-wrap">
                                      {c.teacher_name && (
                                        <span className="inline-flex items-center gap-1">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" fill="currentColor"/></svg>
                                          {c.teacher_name}
                                        </span>
                                      )}
                                      {c.start_date && (
                                        <span className="inline-flex items-center gap-1">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2Zm14 8H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Zm-12 3h2v2H9Zm4 0h2v2h-2Zm-4 4h2v2H9Zm4 0h2v2h-2Z" fill="currentColor"/></svg>
                                          Inicio: {fmtDateISO(c.start_date)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Vista Listado (móvil) ===== */}
      {!loading && !error && (
        <div className="block lg:hidden">
          <div className="space-y-4">
            {groupedMobile.map((g, gi) => (
              <div key={gi} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                {/* Encabezado de día (neutro) */}
                <div className="px-4 py-2 border-b bg-white flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">{g.label}</div>
                  <div className="text-xs text-slate-500">
                    {g.items.length} {g.items.length === 1 ? 'curso' : 'cursos'}
                  </div>
                </div>

                {/* Listado de tarjetas por curso (sin hora adentro) */}
                <div className="p-3 space-y-3">
                  {g.items.length === 0 ? (
                    <div className="text-slate-500 text-sm">Sin cursos</div>
                  ) : g.items.map((c) => (
                    <div
                      key={c.id}
                      className="px-3 py-2 rounded-2xl text-white shadow-sm border border-white/20"
                      style={{ background: teacherGradient(c.teacher_name) }}
                    >
                      <div className="text-[14px] font-semibold leading-5">{c.name}</div>
                      <div className="mt-1 text-[12px] opacity-95 space-x-3 flex items-center flex-wrap">
                        {c.teacher_name && (
                          <span className="inline-flex items-center gap-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5Z" fill="currentColor"/></svg>
                            {c.teacher_name}
                          </span>
                        )}
                        {c.start_date && (
                          <span className="inline-flex items-center gap-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 2v2H5a2 2 0 0 0-2 2v2h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2Zm14 8H3v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Zm-12 3h2v2H9Zm4 0h2v2h-2Zm-4 4h2v2H9Zm4 0h2v2h-2Z" fill="currentColor"/></svg>
                            Inicio: {fmtDateISO(c.start_date)}
                          </span>
                        )}
                        {/* Si quieres mostrar hora en móvil, descomenta:
                        {c.start_time && (
                          <span className="inline-flex items-center gap-1">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 1a11 11 0 1 0 11 11A11 11 0 0 0 12 1Zm1 11H7v-2h4V5h2Z" fill="currentColor"/></svg>
                            {hhmm(c.start_time)}{c.end_time ? `–${hhmm(c.end_time)}` : ''}
                          </span>
                        )} */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


