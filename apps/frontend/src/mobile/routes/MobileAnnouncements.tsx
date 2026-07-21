import { useEffect, useState } from 'react'
import { HiOutlineCalendar, HiOutlineSpeakerphone } from 'react-icons/hi'
import { toAbsoluteUrl } from '../../lib/api'
import MobileCard from '../components/MobileCard'
import { mobileApi } from '../services/mobileApi'

type Announcement = {
  id: number
  title: string
  subtitle?: string | null
  body?: string | null
  announcement_type?: string | null
  image_url?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at?: string | null
}

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  important: { label: 'Aviso importante', badge: 'bg-slate-950 text-white', icon: 'bg-fuchsia-50 text-fuchsia-600' },
  promotion: { label: 'Promocion', badge: 'bg-emerald-600 text-white', icon: 'bg-emerald-50 text-emerald-600' },
  event: { label: 'Evento', badge: 'bg-blue-600 text-white', icon: 'bg-blue-50 text-blue-600' },
  schedule: { label: 'Cambio de horario', badge: 'bg-amber-500 text-white', icon: 'bg-amber-50 text-amber-600' },
  payment: { label: 'Recordatorio de pago', badge: 'bg-purple-600 text-white', icon: 'bg-purple-50 text-purple-600' },
  holiday: { label: 'Feriado', badge: 'bg-rose-600 text-white', icon: 'bg-rose-50 text-rose-600' },
}

const typeConfig = (value?: string | null) => TYPE_CONFIG[value || 'important'] || TYPE_CONFIG.important

const formatDate = (value?: string | null) => value ? value.split('-').reverse().join('/') : ''

const isCurrentMonthAnnouncement = (announcement: Announcement) => {
  if (announcement.end_date) return true
  const anchor = announcement.start_date || announcement.created_at
  if (!anchor) return true
  const date = new Date(anchor)
  if (Number.isNaN(date.getTime())) return true
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export default function MobileAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    mobileApi
      .get<Announcement[]>('/api/pms/announcements', { params: { active_only: true, limit: 50 } })
      .then((res) => setItems((res.data || []).filter(isCurrentMonthAnnouncement)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-fuchsia-100 border-t-fuchsia-600" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Cargando avisos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MobileCard eyebrow="Anuncios" title="Novedades del estudio">
        <p className="text-sm font-semibold leading-6 text-slate-600">
          Revisa comunicados, promociones, eventos y cambios importantes.
        </p>
      </MobileCard>

      {items.length ? items.map((item) => {
        const image = toAbsoluteUrl(item.image_url)
        const config = typeConfig(item.announcement_type)
        return (
          <article key={item.id} className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-xl shadow-slate-200/70">
            {image ? <img src={image} alt={item.title} className="h-40 w-full object-cover" /> : null}
            <div className="relative p-4">
              <div className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl ${config.icon}`}>
                <HiOutlineSpeakerphone size={20} />
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${config.badge}`}>
                {config.label}
              </span>
              <h3 className="mt-3 pr-12 text-lg font-black leading-tight text-slate-950">{item.title}</h3>
              {item.subtitle ? <p className="mt-1 text-sm font-bold text-fuchsia-600">{item.subtitle}</p> : null}
              {item.body ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.body}</p> : null}
              <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <HiOutlineCalendar className="text-fuchsia-500" />
                {item.end_date ? `Hasta ${formatDate(item.end_date)}` : 'Vigente este mes'}
              </div>
            </div>
          </article>
        )
      }) : (
        <MobileCard accent="dark" eyebrow="Avisos" title="Sin novedades activas">
          <p className="text-sm font-semibold leading-6 text-slate-300">
            Cuando el estudio publique un aviso activo, aparecera aqui.
          </p>
        </MobileCard>
      )}
    </div>
  )
}
