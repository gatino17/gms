import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { HiOutlineCalendar, HiOutlineClock, HiOutlineUser, HiOutlineTag, HiOutlineLocationMarker } from 'react-icons/hi'

type Course = {
  id: number
  name: string
  day_of_week?: number | null
  start_time?: string | null
  end_time?: string | null
  teacher_name?: string | null
  room_name?: string | null
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const hhmm = (t?: string | null) => (t ? String(t).slice(0,5) : '--:--')
const toHour = (t?: string | null) => t ? Number(t.split(':')[0]) : null

const THEME_COLORS = [
  { from: 'bg-fuchsia-500', to: 'bg-purple-600', text: 'text-fuchsia-600', light: 'bg-fuchsia-50' },
  { from: 'bg-blue-500', to: 'bg-indigo-600', text: 'text-blue-600', light: 'bg-blue-50' },
  { from: 'bg-emerald-500', to: 'bg-teal-600', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { from: 'bg-rose-500', to: 'bg-pink-600', text: 'text-rose-600', light: 'bg-rose-50' },
  { from: 'bg-amber-500', to: 'bg-orange-600', text: 'text-amber-600', light: 'bg-amber-50' },
]

const hash = (s: string) => { let h=0; for(let i=0; i<s.length; i++) h = (h<<5)-h+s.charCodeAt(i)|0; return Math.abs(h) }
const getTheme = (name: string | null) => THEME_COLORS[hash(name || 'teacher') % THEME_COLORS.length]

export default function CalendarPage() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get('/api/pms/courses', { params: { limit: 500 } })
        setData(res.data.items || [])
      } finally { setLoading(false) }
    }
    load()
  }, [tenantId])

  const hours = useMemo(() => {
    let min = 8, max = 22
    for(const c of data) {
      const h = toHour(c.start_time)
      if(h != null) { min = Math.min(min, h); max = Math.max(max, h + 1) }
    }
    return Array.from({length: max - min}, (_, i) => min + i)
  }, [data])

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-20 px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-2">
           <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Programación</span>
           <h1 className="text-5xl font-black text-gray-900 tracking-tight">Calendario Semanal</h1>
           <p className="text-gray-500 font-medium text-lg">Distribución horaria y ocupación de salas.</p>
        </div>
        <div className="px-8 py-4 bg-white rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4">
           <div className="p-3 bg-fuchsia-50 text-fuchsia-600 rounded-2xl">
              <HiOutlineCalendar size={24} />
           </div>
           <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes Actual</div>
              <div className="text-lg font-black text-gray-900 uppercase">{new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</div>
           </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-60 gap-4">
          <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
          <span className="text-fuchsia-600 font-black tracking-widest text-xs uppercase">Sincronizando horarios...</span>
        </div>
      ) : (
        <div className="bg-white rounded-[40px] shadow-2xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <div className="min-w-[1200px]">
              {/* Header Days */}
              <div className="grid border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20 backdrop-blur-xl" style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}>
                <div className="p-6 flex items-center justify-center border-r border-gray-100">
                  <HiOutlineClock className="text-gray-300" size={28} />
                </div>
                {DAY_NAMES.map((d, i) => (
                  <div key={i} className="p-6 text-center border-r border-gray-100 last:border-0">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{d}</div>
                    <div className={`h-1.5 w-12 mx-auto rounded-full ${THEME_COLORS[i % THEME_COLORS.length].from} opacity-20`} />
                  </div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="divide-y divide-gray-50">
                {hours.map((h) => (
                  <div key={h} className="grid group" style={{ gridTemplateColumns: '100px repeat(7, 1fr)' }}>
                    {/* Time Column */}
                    <div className="p-4 flex items-start justify-center border-r border-gray-100 bg-gray-50/20 group-hover:bg-fuchsia-50/30 transition-colors">
                      <span className="mt-2 px-3 py-1.5 bg-white rounded-xl text-[10px] font-black text-gray-500 shadow-sm border border-gray-100">
                        {String(h).padStart(2, '0')}:00
                      </span>
                    </div>

                    {/* Day Columns */}
                    {DAY_NAMES.map((_, dayIdx) => {
                      const classes = data.filter(c => c.day_of_week === dayIdx && toHour(c.start_time) === h)
                      return (
                        <div key={dayIdx} className="p-3 border-r border-gray-100 last:border-0 min-h-[140px] transition-colors hover:bg-gray-50/50 relative">
                          <div className="flex flex-col gap-3 h-full">
                            {classes.map(c => {
                              const theme = getTheme(c.teacher_name)
                              return (
                                <div 
                                  key={c.id} 
                                  onClick={() => window.location.href=`/courses/${c.id}`}
                                  className={`p-5 rounded-[24px] text-white shadow-lg cursor-pointer transform transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-2xl group/card relative overflow-hidden flex flex-col justify-between h-full bg-gradient-to-br ${theme.from} ${theme.to}`}
                                >
                                  <div className="absolute top-0 right-0 p-4 opacity-20 group-hover/card:opacity-40 transition-opacity">
                                     <HiOutlineTag size={40} />
                                  </div>
                                  <div className="relative z-10">
                                    <h4 className="text-sm font-black leading-tight mb-4 drop-shadow-md">{c.name}</h4>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-white/90 bg-black/10 px-2 py-1 rounded-lg w-fit">
                                        <HiOutlineClock size={12} />
                                        {hhmm(c.start_time)} - {hhmm(c.end_time)}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-white/90 bg-black/10 px-2 py-1 rounded-lg w-fit">
                                        <HiOutlineUser size={12} />
                                        <span className="truncate max-w-[80px]">{c.teacher_name || 'Sin Instr.'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] font-bold text-white/90 bg-black/10 px-2 py-1 rounded-lg w-fit">
                                        <HiOutlineLocationMarker size={12} />
                                        <span className="truncate max-w-[80px]">{c.room_name || 'Gral.'}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
