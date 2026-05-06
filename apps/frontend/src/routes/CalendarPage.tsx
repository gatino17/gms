import { useEffect, useMemo, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
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
  image_url?: string | null
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const hhmm = (t?: string | null) => (t ? String(t).slice(0,5) : '--:--')
const toHour = (t?: string | null) => t ? Number(t.split(':')[0]) : null

const THEME_COLORS = [
  { from: 'from-fuchsia-600', via: 'via-fuchsia-600/90', to: 'to-purple-700', text: 'text-fuchsia-600', light: 'bg-fuchsia-50' },
  { from: 'from-blue-600', via: 'via-blue-600/90', to: 'to-indigo-700', text: 'text-blue-600', light: 'bg-blue-50' },
  { from: 'from-emerald-600', via: 'via-emerald-600/90', to: 'to-teal-700', text: 'text-emerald-600', light: 'bg-emerald-50' },
  { from: 'from-rose-600', via: 'via-rose-600/90', to: 'to-pink-700', text: 'text-rose-600', light: 'bg-rose-50' },
  { from: 'from-amber-600', via: 'via-amber-600/90', to: 'to-orange-700', text: 'text-amber-600', light: 'bg-amber-50' },
]

const hash = (s: string) => { let h=0; for(let i=0; i<s.length; i++) h = (h<<5)-h+s.charCodeAt(i)|0; return Math.abs(h) }
const getTheme = (c: Course) => THEME_COLORS[hash(c.name + c.id) % THEME_COLORS.length]

export default function CalendarPage() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) // 0=Mon, 6=Sun

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
    let min = 24, max = 0
    let hasValidHours = false

    for(const c of data) {
      const h = toHour(c.start_time)
      const endH = toHour(c.end_time)
      if(h != null) { 
        min = Math.min(min, h)
        max = Math.max(max, endH != null ? endH + 1 : h + 1)
        hasValidHours = true
      }
    }

    if (!hasValidHours) return Array.from({length: 14}, (_, i) => 8 + i)

    return Array.from({length: max - min}, (_, i) => min + i)
  }, [data])

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 pb-20 px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4 md:px-0">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Programación</span>
           <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-none">Calendario</h1>
           <p className="text-gray-500 font-medium text-sm md:text-lg">Distribución horaria y salas.</p>
        </div>
        <div className="flex px-5 py-3 md:px-8 md:py-4 bg-white rounded-2xl md:rounded-[24px] shadow-sm border border-gray-100 items-center justify-center sm:justify-start gap-4 mx-4 sm:mx-0">
           <div className="p-2 md:p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl md:rounded-2xl shrink-0">
              <HiOutlineCalendar size={18} md:size={20} />
           </div>
           <div>
              <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">Mes Actual</div>
              <div className="text-sm md:text-lg font-black text-gray-900 uppercase">{new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</div>
           </div>
        </div>
      </div>

      {/* Day Selector (Mobile Only) */}
      <div className="flex md:hidden bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar gap-1 mx-4">
         {DAY_NAMES.map((d, i) => (
            <button 
              key={i} 
              onClick={() => setSelectedDay(i)}
              className={`flex-1 min-w-[56px] py-2.5 rounded-xl transition-all flex flex-col items-center gap-0.5 ${selectedDay === i ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-100' : 'text-gray-400 hover:bg-gray-50'}`}
            >
               <span className="text-[7px] font-black uppercase tracking-widest">{d.slice(0,3)}</span>
               <span className="text-sm font-black">{i + 1}</span>
            </button>
         ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-60 gap-4">
          <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
          <span className="text-fuchsia-600 font-black tracking-widest text-xs uppercase">Sincronizando horarios...</span>
        </div>
      ) : (
        <div className="md:mx-0 bg-white rounded-none md:rounded-[40px] shadow-2xl shadow-gray-100/50 border-y md:border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar">
            <div className="min-w-full md:min-w-[1200px]">
              {/* Header Days */}
              <div className="grid border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20 backdrop-blur-xl grid-cols-[60px_1fr] md:grid-cols-[100px_repeat(7,1fr)]">
                <div className="p-3 md:p-6 flex items-center justify-center border-r border-gray-100">
                  <HiOutlineClock className="text-gray-300" size={20} md:size={24} />
                </div>
                {DAY_NAMES.map((d, i) => (
                  <div key={i} className={`p-3 md:p-6 text-center border-r border-gray-100 last:border-0 ${selectedDay !== i ? 'hidden md:block' : 'block'}`}>
                    <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{d}</div>
                    <div className={`h-1 w-6 md:h-1.5 md:w-12 mx-auto rounded-full bg-fuchsia-600 opacity-20`} />
                  </div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="divide-y divide-gray-50">
                {hours.map((h) => (
                  <div key={h} className="grid group grid-cols-[60px_1fr] md:grid-cols-[100px_repeat(7,1fr)]">
                    {/* Time Column */}
                    <div className="p-2 md:p-4 flex items-start justify-center border-r border-gray-100 bg-gray-50/20 group-hover:bg-fuchsia-50/30 transition-colors">
                      <span className="mt-1 md:mt-2 px-1.5 py-1 md:px-3 md:py-1.5 bg-white rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black text-gray-500 shadow-sm border border-gray-100">
                        {String(h).padStart(2, '0')}:00
                      </span>
                    </div>

                    {/* Day Columns */}
                    {DAY_NAMES.map((_, dayIdx) => {
                      const classes = data.filter(c => c.day_of_week === dayIdx && toHour(c.start_time) === h)
                      return (
                        <div key={dayIdx} className={`p-2 md:p-3 border-r border-gray-100 last:border-0 min-h-[80px] md:min-h-[140px] transition-colors hover:bg-gray-50/50 relative ${selectedDay !== dayIdx ? 'hidden md:block' : 'block'}`}>
                          <div className="flex flex-col gap-2 md:gap-3 h-full">
                            {classes.map(c => {
                              const theme = getTheme(c)
                              return (
                                <div 
                                  key={c.id} 
                                  onClick={() => window.location.href=`/courses/${c.id}`}
                                  className={`p-4 md:p-5 rounded-2xl md:rounded-[24px] text-white shadow-lg cursor-pointer transform transition-all duration-500 hover:scale-[1.03] active:scale-95 group/card relative overflow-hidden flex flex-col justify-between h-full bg-gradient-to-br ${theme.from} ${theme.via} ${theme.to}`}
                                >
                                  {/* Blurred Background Image */}
                                  {c.image_url && (
                                    <div className="absolute inset-0 opacity-20 group-hover/card:opacity-40 transition-opacity duration-500">
                                      <img src={toAbsoluteUrl(c.image_url)} className="w-full h-full object-cover blur-[3px] scale-125 origin-center" />
                                      <div className={`absolute inset-0 bg-gradient-to-br ${theme.from} ${theme.to} mix-blend-overlay`} />
                                    </div>
                                  )}

                                  <div className="relative z-10 space-y-3">
                                    <h4 className="text-xs md:text-sm font-black leading-tight drop-shadow-md">{c.name}</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                      <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-bold text-white bg-black/20 backdrop-blur-sm px-2 py-1 rounded-lg w-fit shrink-0 border border-white/10">
                                        <HiOutlineClock size={10} md:size={12} />
                                        {hhmm(c.start_time)}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-bold text-white bg-black/20 backdrop-blur-sm px-2 py-1 rounded-lg w-fit shrink-0 border border-white/10">
                                        <HiOutlineUser size={10} md:size={12} />
                                        <span className="truncate max-w-[60px] md:max-w-[80px]">{c.teacher_name || 'Sin Instr.'}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[8px] md:text-[10px] font-bold text-white bg-black/20 backdrop-blur-sm px-2 py-1 rounded-lg w-fit shrink-0 border border-white/10">
                                        <HiOutlineLocationMarker size={10} md:size={12} />
                                        <span className="truncate max-w-[60px] md:max-w-[80px]">{c.room_name || 'Gral.'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Glassy detail indicator */}
                                  <div className="relative z-10 mt-2 flex justify-end">
                                     <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                        <HiOutlineTag size={12} />
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

