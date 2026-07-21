import { useEffect, useState } from 'react'
import { HiOutlineBell, HiOutlineCash, HiOutlineChartBar, HiOutlineCheckCircle, HiOutlineSpeakerphone } from 'react-icons/hi'
import { toAbsoluteUrl } from '../../lib/api'
import MobileCard from '../components/MobileCard'
import { getMobileUser, mobileApi, mobileUserName } from '../services/mobileApi'

interface StudentSummary {
  attendance?: { percent?: number }
  classes_active?: number
  payments?: { total_last_90?: number }
}

interface TeacherSummary {
  course_count?: number
  student_count?: number
  tenant?: { name?: string | null }
}

interface Announcement {
  id: number
  title: string
  subtitle?: string | null
  body?: string | null
  announcement_type?: string | null
  image_url?: string | null
  link_url?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at?: string | null
}

const ANNOUNCEMENT_TYPE_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  important: { label: 'Aviso importante', badge: 'bg-slate-950 text-white', icon: 'bg-fuchsia-50 text-fuchsia-600' },
  promotion: { label: 'Promocion', badge: 'bg-emerald-600 text-white', icon: 'bg-emerald-50 text-emerald-600' },
  event: { label: 'Evento', badge: 'bg-blue-600 text-white', icon: 'bg-blue-50 text-blue-600' },
  schedule: { label: 'Cambio de horario', badge: 'bg-amber-500 text-white', icon: 'bg-amber-50 text-amber-600' },
  payment: { label: 'Recordatorio de pago', badge: 'bg-purple-600 text-white', icon: 'bg-purple-50 text-purple-600' },
  holiday: { label: 'Feriado', badge: 'bg-rose-600 text-white', icon: 'bg-rose-50 text-rose-600' },
}

const announcementTypeConfig = (value?: string | null) =>
  ANNOUNCEMENT_TYPE_CONFIG[value || 'important'] || ANNOUNCEMENT_TYPE_CONFIG.important

const isCurrentMonthAnnouncement = (announcement: Announcement) => {
  if (announcement.end_date) return true
  const anchor = announcement.start_date || announcement.created_at
  if (!anchor) return true
  const date = new Date(anchor)
  if (Number.isNaN(date.getTime())) return true
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export default function MobileHome() {
  const user = getMobileUser()
  const [summary, setSummary] = useState<StudentSummary | null>(null)
  const [teacherSummary, setTeacherSummary] = useState<TeacherSummary | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    if (user?.role === 'student') {
      mobileApi.get('/api/pms/students/portal/me').then((res) => setSummary(res.data)).catch(() => setSummary(null))
    }
    if (user?.role === 'teacher') {
      mobileApi.get('/api/pms/teachers/portal/me').then((res) => setTeacherSummary(res.data)).catch(() => setTeacherSummary(null))
    }
    if (user?.role) {
      mobileApi
        .get<Announcement[]>('/api/pms/announcements', { params: { active_only: true, limit: 8 } })
        .then((res) => setAnnouncements((res.data || []).filter(isCurrentMonthAnnouncement).slice(0, 3)))
        .catch(() => setAnnouncements([]))
    }
  }, [user?.role])

  const announcementPanel = announcements.length ? (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-600">Comunicados</p>
          <h2 className="text-lg font-black text-slate-950">Avisos activos</h2>
        </div>
        <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-[10px] font-black text-fuchsia-600">{announcements.length}</span>
      </div>
      {announcements.map((announcement) => {
        const image = toAbsoluteUrl(announcement.image_url)
        const typeConfig = announcementTypeConfig(announcement.announcement_type)
        return (
          <article key={announcement.id} className="overflow-hidden rounded-[28px] border border-fuchsia-100 bg-white shadow-xl shadow-slate-200/70">
            {image ? <img src={image} alt={announcement.title} className="h-36 w-full object-cover" /> : null}
            <div className="relative p-4">
              <div className={`absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl ${typeConfig.icon}`}>
                <HiOutlineSpeakerphone size={20} />
              </div>
              <p className={`mb-2 w-fit rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${typeConfig.badge}`}>
                {typeConfig.label}
              </p>
              <h3 className="pr-12 text-base font-black leading-tight text-slate-950">{announcement.title}</h3>
              {announcement.subtitle ? <p className="mt-1 text-sm font-bold text-fuchsia-600">{announcement.subtitle}</p> : null}
              {announcement.body ? <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{announcement.body}</p> : null}
              {announcement.end_date ? (
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Vigente hasta {announcement.end_date}
                </p>
              ) : (
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Vigente este mes</p>
              )}
            </div>
          </article>
        )
      })}
    </section>
  ) : null

  if (user?.role === 'teacher') {
    return (
      <div className="space-y-4">
        <MobileCard eyebrow="Profesor" title={`Hola, ${mobileUserName(user)}`}>
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Gestiona tus cursos y revisa alumnos inscritos desde tu celular.
          </p>
        </MobileCard>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-fuchsia-100 bg-white p-4 shadow-lg shadow-slate-200/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Cursos</p>
            <p className="mt-1 text-3xl font-black">{teacherSummary?.course_count || 0}</p>
          </div>
          <div className="rounded-[24px] border border-slate-100 bg-slate-950 p-4 text-white shadow-lg shadow-slate-200/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-200">Alumnos</p>
            <p className="mt-1 text-3xl font-black">{teacherSummary?.student_count || 0}</p>
          </div>
        </div>
        {announcementPanel}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MobileCard eyebrow="Alumno" title={`Hola, ${mobileUserName(user)}`}>
        <p className="text-sm font-semibold leading-6 text-slate-600">
          Revisa tu avance, pagos y anuncios importantes desde tu celular.
        </p>
      </MobileCard>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] border border-fuchsia-100 bg-white p-4 shadow-lg shadow-slate-200/70">
          <HiOutlineChartBar className="mb-3 text-fuchsia-600" size={24} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asistencia</p>
          <p className="mt-1 text-2xl font-black">{Math.round(summary?.attendance?.percent || 0)}%</p>
        </div>
        <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-lg shadow-slate-200/70">
          <HiOutlineCheckCircle className="mb-3 text-emerald-500" size={24} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cursos</p>
          <p className="mt-1 text-2xl font-black">{summary?.classes_active || 0}</p>
        </div>
        <div className="rounded-[24px] border border-blue-100 bg-white p-4 shadow-lg shadow-slate-200/70">
          <HiOutlineCash className="mb-3 text-blue-500" size={24} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pagos 90d</p>
          <p className="mt-1 text-xl font-black">${Number(summary?.payments?.total_last_90 || 0).toLocaleString('es-CL')}</p>
        </div>
        <div className="rounded-[24px] border border-orange-100 bg-white p-4 shadow-lg shadow-slate-200/70">
          <HiOutlineBell className="mb-3 text-orange-500" size={24} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avisos</p>
          <p className="mt-1 text-2xl font-black">{announcements.length}</p>
        </div>
      </div>
      {announcementPanel}
    </div>
  )
}
