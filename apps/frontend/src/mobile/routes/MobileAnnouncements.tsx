import { useEffect, useState } from 'react'
import { HiOutlineCalendar, HiOutlineSpeakerphone } from 'react-icons/hi'
import { toAbsoluteUrl } from '../../lib/api'
import MobileCard from '../components/MobileCard'
import { getMobileUser, mobileApi } from '../services/mobileApi'

type Announcement = {
  id: number
  title: string
  subtitle?: string | null
  body?: string | null
  announcement_type?: string | null
  audience?: string | null
  image_url?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at?: string | null
  is_active?: boolean | null
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

const parseAnnouncementDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const addMonths = (date: Date, months: number) => {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

const isStudentAnnouncementVisible = (announcement: Announcement) => {
  if (announcement.is_active === false) return false
  if (announcement.end_date) return true
  const anchor = announcement.start_date || announcement.created_at
  if (!anchor) return true
  const date = parseAnnouncementDate(anchor)
  if (!date) return true
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

const isTeacherAnnouncementVisible = (announcement: Announcement) => {
  if (announcement.is_active === false) return false
  const now = new Date()
  const start = parseAnnouncementDate(announcement.start_date)
  if (start && start > now) return false
  const anchor = start || parseAnnouncementDate(announcement.created_at)
  if (!anchor) return true
  const minimumUntil = addMonths(anchor, 2)
  const end = parseAnnouncementDate(announcement.end_date)
  const visibleUntil = end && end > minimumUntil ? end : minimumUntil
  return visibleUntil >= now
}

const isMobileAnnouncementVisible = (announcement: Announcement, role?: string) => {
  if (role === 'teacher') return isTeacherAnnouncementVisible(announcement)
  return isStudentAnnouncementVisible(announcement)
}

const announcementValidityText = (announcement: Announcement, role?: string) => {
  if (announcement.end_date) return `Hasta ${formatDate(announcement.end_date)}`
  if (role === 'teacher') return 'Visible minimo 2 meses'
  return 'Vigente este mes'
}

export default function MobileAnnouncements() {
  const user = getMobileUser()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const audience = user?.role === 'teacher' ? 'teachers' : 'students'
    mobileApi
      .get<Announcement[]>('/api/pms/announcements', { params: { active_only: user?.role !== 'teacher', limit: 50, audience } })
      .then((res) => setItems((res.data || []).filter((item) => isMobileAnnouncementVisible(item, user?.role))))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [user?.role])

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
          <article key={item.id} className="overflow-hidden rounded-[26px] border border-slate-100 bg-white p-3 shadow-lg shadow-slate-200/60">
            <div className="flex gap-3">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] bg-slate-950 shadow-lg shadow-slate-200">
                {image ? (
                  <>
                    <img src={image} alt={item.title} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 to-transparent" />
                  </>
                ) : (
                  <div className={`flex h-full w-full items-center justify-center ${config.icon}`}>
                    <HiOutlineSpeakerphone size={24} />
                  </div>
                )}
                <span className="absolute bottom-2 left-2 h-2 w-10 rounded-full bg-gradient-to-r from-fuchsia-500 to-white" />
              </div>
              <div className="min-w-0 flex-1 py-1">
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${config.badge}`}>
                    {config.label}
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-base font-black leading-tight text-slate-950">{item.title}</h3>
                {item.subtitle ? <p className="mt-1 line-clamp-1 text-xs font-black text-fuchsia-600">{item.subtitle}</p> : null}
                {item.body ? <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">{item.body}</p> : null}
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <HiOutlineCalendar className="text-fuchsia-500" />
                  {announcementValidityText(item, user?.role)}
                </div>
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
