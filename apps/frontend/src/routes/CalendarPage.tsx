import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { HiOutlineCalendar, HiOutlineClock, HiOutlineUser, HiOutlineTag } from 'react-icons/hi'

type Course = {
  id: number
  name: string
  day_of_week?: number | null // 0=Lunes ... 6=Domingo
  start_time?: string | null  // "HH:mm"
  end_time?: string | null    // "HH:mm"
  start_date?: string | null
  teacher_name?: string | null
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
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

// Premium Gradient Palette for Teachers
const THEME_GRADIENTS: { from: string; to: string }[] = [
  { from: '#3b82f6', to: '#8b5cf6' }, // Blue to Purple
  { from: '#ec4899', to: '#d946ef' }, // Pink to Fuchsia
  { from: '#0ea5e9', to: '#3b82f6' }, // Sky to Blue
  { from: '#10b981', to: '#059669' }, // Emerald to Green
  { from: '#f59e0b', to: '#ef4444' }, // Amber to Red
  { from: '#14b8a6', to: '#8b5cf6' }, // Teal to Purple
]

const hashString = (s: string) => { let h=0; for (let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0 } return Math.abs(h) }
const teacherGradient = (name: string | null | undefined) => {
  const { from, to } = THEME_GRADIENTS[hashString(name || 'teacher') % THEME_GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

export default function CalendarPage() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return
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
        setError(e?.message ?? 'Error al cargar el calendario')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId])

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

  const groupedMobile = useMemo(() => {
    const map = new Map<number | 'nd', { label: string, items: Course[] }>()
    for (const c of data) {
      const k = (typeof c.day_of_week === 'number' ? c.day_of_week : 'nd') as number | 'nd'
      if (!map.has(k)) {
        map.set(k, { label: k === 'nd' ? 'Horario a Definir' : DAY_NAMES[k], items: [] })
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
    <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h1 className="text-4xl font-black text-gray-900 tracking-tight">Calendario Semanal</h1>
           <p className="text-gray-500 font-medium mt-1">Horarios y distribución de programas académicos.</p>
        </div>
        <div className="px-6 py-3 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
           <HiOutlineCalendar className="text-fuchsia-600" size={20} />
           <span className="font-black text-gray-700 uppercase tracking-widest text-[10px]">
              {new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
           </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
          <span className="text-fuchsia-600 font-black tracking-widest text-[10px] uppercase">Cargando Horarios...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-[30px] text-rose-600 font-bold text-center">
          {error}
        </div>
      ) : (
        <>
          {/* ===== Vista Desktop (Grilla) ===== */}
          <div className="hidden lg:block bg-white rounded-[40px] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
            <div className="w-full overflow-x-auto custom-scrollbar">
              <div className="min-w-[1200px]">
                {/* Cabecera Días */}
                <div className="grid sticky top-0 z-10 border-b border-gray-100 bg-gray-50/80 backdrop-blur-md" style={{ gridTemplateColumns: `100px repeat(7, 1fr)` }}>
                  <div className="p-4 flex items-center justify-center border-r border-gray-100">
                    <HiOutlineClock className="text-gray-400" size={24} />
                  </div>
                  {DAY_NAMES.map((d, i) => (
                    <div key={i} className="p-4 flex flex-col items-center justify-center gap-1 border-r border-gray-100 last:border-0">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{d}</span>
                      <div className="w-8 h-1 rounded-full" style={{ backgroundColor: THEME_GRADIENTS[i % THEME_GRADIENTS.length].from, opacity: 0.5 }} />
                    </div>
                  ))}
                </div>

                {/* Cuerpo del Calendario */}
                <div className="bg-white">
                  {hoursAsc.map((h, rowIdx) => {
                    const label = `${pad2(h)}:00`
                    return (
                      <div key={h} className="grid border-b border-gray-50 last:border-0" style={{ gridTemplateColumns: `100px repeat(7, 1fr)` }}>
                        {/* Gutter Horas */}
                        <div className="p-3 border-r border-gray-50 flex items-start justify-center">
                          <div className="px-3 py-1.5 bg-gray-50 rounded-xl text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">
                            {label}
                          </div>
                        </div>

                        {/* Celdas */}
                        {DAY_NAMES.map((_, dayIdx) => {
                          const items = (matrix[h]?.[dayIdx] ?? [])
                          return (
                            <div key={dayIdx} className={`p-3 border-r border-gray-50 last:border-0 min-h-[120px] transition-colors ${items.length > 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                              <div className="flex flex-col gap-3">
                                {items.map((c) => (
                                  <div
                                    key={c.id}
                                    className="p-4 rounded-[20px] text-white shadow-lg transform transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl group"
                                    style={{ background: teacherGradient(c.teacher_name) }}
                                  >
                                    <h4 className="text-sm font-black leading-tight drop-shadow-sm line-clamp-2">{c.name}</h4>
                                    
                                    <div className="mt-3 space-y-1.5">
                                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/90">
                                        <HiOutlineClock size={12} className="opacity-70" />
                                        <span>{hhmm(c.start_time)} - {hhmm(c.end_time)}</span>
                                      </div>
                                      
                                      {c.teacher_name && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/90">
                                          <HiOutlineUser size={12} className="opacity-70" />
                                          <span className="truncate">{c.teacher_name}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
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

          {/* ===== Vista Mobile (Lista Agrupada) ===== */}
          <div className="block lg:hidden space-y-6">
            {groupedMobile.map((g, gi) => (
              <div key={gi} className="bg-white rounded-[30px] border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">{g.label}</h3>
                  <span className="px-3 py-1 bg-white rounded-full text-[10px] font-black text-gray-400 uppercase shadow-sm border border-gray-100">
                    {g.items.length} {g.items.length === 1 ? 'Clase' : 'Clases'}
                  </span>
                </div>
                
                <div className="p-4 space-y-4">
                  {g.items.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 font-medium text-sm">No hay clases programadas</div>
                  ) : (
                    g.items.map((c) => (
                      <div
                        key={c.id}
                        className="p-5 rounded-[24px] text-white shadow-md relative overflow-hidden"
                        style={{ background: teacherGradient(c.teacher_name) }}
                      >
                        <div className="relative z-10">
                          <h4 className="text-base font-black leading-tight drop-shadow-sm">{c.name}</h4>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-black/10 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                              <HiOutlineClock size={14} />
                              <span>{hhmm(c.start_time)} - {hhmm(c.end_time)}</span>
                            </div>
                            {c.teacher_name && (
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-black/10 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                                <HiOutlineUser size={14} />
                                <span className="truncate max-w-[120px]">{c.teacher_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
