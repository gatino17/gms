import { useEffect, useMemo, useState } from 'react'
import { HiOutlineBell, HiOutlineCake, HiOutlineCash, HiOutlineChartBar, HiOutlineCheckCircle, HiOutlineSparkles, HiOutlineSpeakerphone } from 'react-icons/hi'
import { Link } from 'react-router-dom'
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
  courses?: Array<{
    id: number
    name: string
    students?: Array<{
      id: number
      first_name: string
      last_name: string
      birthdate?: string | null
      photo_url?: string | null
    }>
  }>
}

interface Announcement {
  id: number
  title: string
  subtitle?: string | null
  body?: string | null
  announcement_type?: string | null
  audience?: string | null
  image_url?: string | null
  link_url?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

const ANNOUNCEMENT_TYPE_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  important: { label: 'Aviso importante', badge: 'bg-slate-950 text-white', icon: 'mobile-bg-primary-soft mobile-text-primary' },
  promotion: { label: 'Promocion', badge: 'bg-emerald-600 text-white', icon: 'bg-emerald-50 text-emerald-600' },
  event: { label: 'Evento', badge: 'bg-blue-600 text-white', icon: 'bg-blue-50 text-blue-600' },
  schedule: { label: 'Cambio de horario', badge: 'bg-amber-500 text-white', icon: 'bg-amber-50 text-amber-600' },
  payment: { label: 'Recordatorio de pago', badge: 'bg-purple-600 text-white', icon: 'bg-purple-50 text-purple-600' },
  holiday: { label: 'Feriado', badge: 'bg-rose-600 text-white', icon: 'bg-rose-50 text-rose-600' },
}

const announcementTypeConfig = (value?: string | null) =>
  ANNOUNCEMENT_TYPE_CONFIG[value || 'important'] || ANNOUNCEMENT_TYPE_CONFIG.important

const parseAnnouncementDate = (value?: string | null) => {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const endOfDay = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
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
  const end = parseAnnouncementDate(announcement.end_date)
  if (end && endOfDay(end) < now) return false
  const anchor = start || parseAnnouncementDate(announcement.created_at)
  if (!anchor) return true
  const minimumUntil = addMonths(anchor, 2)
  const visibleUntil = end && endOfDay(end) > minimumUntil ? endOfDay(end) : minimumUntil
  return visibleUntil >= now
}

const isMobileAnnouncementVisible = (announcement: Announcement, role?: string) => {
  if (role === 'teacher') return isTeacherAnnouncementVisible(announcement)
  return isStudentAnnouncementVisible(announcement)
}

const sortAnnouncementsNewestFirst = (items: Announcement[]) =>
  [...items].sort((a, b) => {
    const aTime = parseAnnouncementDate(a.created_at)?.getTime() || 0
    const bTime = parseAnnouncementDate(b.created_at)?.getTime() || 0
    if (bTime !== aTime) return bTime - aTime
    return (b.id || 0) - (a.id || 0)
  })

const announcementValidityText = (announcement: Announcement, role?: string) => {
  if (announcement.end_date) return `Vigente hasta ${announcement.end_date}`
  if (role === 'teacher') return 'Visible minimo 2 meses'
  return 'Vigente este mes'
}

const isBirthdayToday = (birthdate?: string | null) => {
  if (!birthdate) return false
  const [year, month, day] = birthdate.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return false
  const now = new Date()
  return month === now.getMonth() + 1 && day === now.getDate()
}

const initials = (first?: string, last?: string) =>
  `${first?.trim()?.[0] || ''}${last?.trim()?.[0] || ''}`.toUpperCase() || 'AL'

const TEACHER_DAILY_MESSAGES = [
  'Cada clase puede ser el impulso que un alumno necesitaba hoy.',
  'Tu energia marca el ritmo antes de que empiece la musica.',
  'Una buena clase tambien se construye con orden y presencia.',
  'Hoy tienes una nueva oportunidad para inspirar disciplina.',
  'Los pequenos avances tambien cuentan cuando se sostienen.',
  'Tu constancia ayuda a que tus alumnos confien en su proceso.',
  'Ensenar tambien es observar, ajustar y acompanar.',
  'Una clase clara deja alumnos mas seguros y motivados.',
  'El progreso se nota cuando cada detalle tiene intencion.',
  'Hoy puedes convertir una correccion en una mejora real.',
  'La actitud del profesor define mucho antes del primer paso.',
  'Cada asistencia marcada tambien cuenta una historia de compromiso.',
  'Un alumno motivado empieza muchas veces con una guia cercana.',
  'La tecnica mejora cuando existe paciencia y direccion.',
  'Tu clase puede ser el mejor momento del dia para alguien.',
  'La energia correcta transforma un grupo en comunidad.',
  'Ordenar la clase tambien es cuidar la experiencia del alumno.',
  'Hoy enfocate en que cada alumno se lleve algo concreto.',
  'Una indicacion simple puede cambiar todo el resultado.',
  'La mejor clase combina estructura, energia y escucha.',
  'Tu liderazgo se nota en como el grupo avanza unido.',
  'Cada alumno progresa a su ritmo; tu guia le da direccion.',
  'Hoy es buen dia para reforzar confianza y tecnica.',
  'La presencia del profesor tambien ensena.',
  'Una clase bien guiada deja ganas de volver.',
  'El compromiso se contagia cuando se trabaja con proposito.',
  'Cada horario es una oportunidad para elevar el nivel.',
  'La disciplina se construye mejor con una guia constante.',
  'Tu forma de ensenar tambien crea identidad para el estudio.',
  'Hoy deja una clase que se recuerde por su energia y claridad.',
]

const teacherDailyMessage = () => {
  const today = new Date()
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  return TEACHER_DAILY_MESSAGES[seed % TEACHER_DAILY_MESSAGES.length]
}

export default function MobileHome() {
  const user = getMobileUser()
  const [summary, setSummary] = useState<StudentSummary | null>(null)
  const [teacherSummary, setTeacherSummary] = useState<TeacherSummary | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementSlide, setAnnouncementSlide] = useState(0)

  const birthdayStudents = useMemo(() => {
    const byStudent = new Map<number, { id: number; name: string; photo_url?: string | null; courses: string[] }>()
    for (const course of teacherSummary?.courses || []) {
      for (const student of course.students || []) {
        if (!isBirthdayToday(student.birthdate)) continue
        const existing = byStudent.get(student.id)
        if (existing) {
          if (!existing.courses.includes(course.name)) existing.courses.push(course.name)
          continue
        }
        byStudent.set(student.id, {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`.trim(),
          photo_url: student.photo_url,
          courses: [course.name],
        })
      }
    }
    return Array.from(byStudent.values())
  }, [teacherSummary?.courses])

  useEffect(() => {
    if (user?.role === 'student') {
      mobileApi.get('/api/pms/students/portal/me').then((res) => setSummary(res.data)).catch(() => setSummary(null))
    }
    if (user?.role === 'teacher') {
      mobileApi.get('/api/pms/teachers/portal/me').then((res) => setTeacherSummary(res.data)).catch(() => setTeacherSummary(null))
    }
    if (user?.role) {
      const audience = user.role === 'teacher' ? 'teachers' : 'students'
      mobileApi
        .get<Announcement[]>('/api/pms/announcements', { params: { active_only: user.role !== 'teacher', limit: 50, audience } })
        .then((res) => {
          const visible = (res.data || []).filter((item) => isMobileAnnouncementVisible(item, user.role))
          setAnnouncements(sortAnnouncementsNewestFirst(visible))
        })
        .catch(() => setAnnouncements([]))
    }
  }, [user?.role])

  const sliderAnnouncements = announcements.slice(0, 3)
  const activeAnnouncementIndex = sliderAnnouncements.length ? Math.min(announcementSlide, sliderAnnouncements.length - 1) : 0
  const currentAnnouncement = sliderAnnouncements[activeAnnouncementIndex]
  const dailyMessage = teacherDailyMessage()
  const teacherFirstName = user?.first_name || mobileUserName(user).split(' ')[0] || 'Profesor'

  useEffect(() => {
    setAnnouncementSlide(0)
  }, [announcements.length, user?.role])

  useEffect(() => {
    if (sliderAnnouncements.length <= 1) return undefined
    const interval = window.setInterval(() => {
      setAnnouncementSlide((current) => (current + 1) % sliderAnnouncements.length)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [sliderAnnouncements.length])

  const announcementPanel = currentAnnouncement ? (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="mobile-text-primary text-[10px] font-black uppercase tracking-[0.24em]">Comunicados</p>
          <h2 className="text-lg font-black text-slate-950">Avisos activos</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black text-white">
            {activeAnnouncementIndex + 1} / {sliderAnnouncements.length}
          </span>
          <span className="mobile-bg-primary-soft mobile-text-primary rounded-full px-3 py-1 text-[10px] font-black">{announcements.length}</span>
        </div>
      </div>
      {(() => {
        const image = toAbsoluteUrl(currentAnnouncement.image_url)
        const typeConfig = announcementTypeConfig(currentAnnouncement.announcement_type)
        return (
          <article
            key={currentAnnouncement.id}
            className="mobile-announcement-slide overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_26px_52px_rgba(15,23,42,0.22),0_14px_26px_rgba(15,23,42,0.10)] ring-1 ring-slate-100"
          >
            <div className="relative min-h-[330px] overflow-hidden bg-slate-950">
              {image ? (
                <>
                  <img src={image} alt={currentAnnouncement.title} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/28 to-slate-950/10" />
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/60 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.7),transparent_34%),linear-gradient(135deg,#020617,#581c87_55%,#111827)]" />
              )}
              <div className="absolute left-4 top-4 flex items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-black/20 ${typeConfig.badge}`}>
                  {typeConfig.label}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur">
                  Nuevo
                </span>
              </div>
              <div className="mobile-text-primary absolute right-4 top-4 rounded-2xl bg-white/95 p-2 shadow-xl shadow-black/20">
                <HiOutlineSpeakerphone size={18} />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <h3 className="text-2xl font-black leading-tight drop-shadow-lg">{currentAnnouncement.title}</h3>
                {currentAnnouncement.subtitle ? <p className="mt-1 text-sm font-black text-white/90 drop-shadow">{currentAnnouncement.subtitle}</p> : null}
                {currentAnnouncement.body ? <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-white/85">{currentAnnouncement.body}</p> : null}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="rounded-full border border-white/15 bg-white/18 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-black/20 backdrop-blur-md">
                    {announcementValidityText(currentAnnouncement, user?.role)}
                  </p>
                  <span className="mobile-gradient-primary h-2 w-12 shrink-0 rounded-full" />
                </div>
              </div>
            </div>
          </article>
        )
      })()}
      {sliderAnnouncements.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {sliderAnnouncements.map((announcement, index) => (
            <button
              key={announcement.id}
              type="button"
              onClick={() => setAnnouncementSlide(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === activeAnnouncementIndex ? 'mobile-bg-primary mobile-shadow-primary w-8' : 'w-2.5 bg-slate-200'
              }`}
              aria-label={`Ver aviso ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
      {announcements.length > 3 ? (
        <Link
          to="/mobile/announcements"
          className="mobile-bg-primary-soft mobile-text-primary mobile-border-primary flex items-center justify-center rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest"
        >
          Ver todos los avisos
        </Link>
      ) : null}
    </section>
  ) : null

  if (user?.role === 'teacher') {
    return (
      <div className="space-y-4">
        <MobileCard eyebrow="Profesor" title={`Hola, ${teacherFirstName}`}>
          <div className="flex items-start gap-3">
              <span className="mobile-bg-header mobile-text-accent mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-slate-200">
              <HiOutlineSparkles size={18} />
            </span>
            <div>
              <p className="mobile-text-primary mb-1 text-[10px] font-black uppercase tracking-[0.22em]">Mensaje del dia</p>
              <p className="text-base font-black leading-6 text-slate-950">{dailyMessage}</p>
            </div>
          </div>
        </MobileCard>
        <div className="grid grid-cols-2 gap-3">
          <div className="mobile-border-primary rounded-[24px] border bg-white p-4 shadow-lg shadow-slate-200/70">
            <p className="mobile-text-primary text-[10px] font-black uppercase tracking-widest">Cursos</p>
            <p className="mt-1 text-3xl font-black">{teacherSummary?.course_count || 0}</p>
          </div>
          <div className="rounded-[24px] border border-slate-100 bg-slate-950 p-4 text-white shadow-lg shadow-slate-200/70">
            <p className="mobile-text-accent text-[10px] font-black uppercase tracking-widest">Alumnos</p>
            <p className="mt-1 text-3xl font-black">{teacherSummary?.student_count || 0}</p>
          </div>
        </div>
        {birthdayStudents.length ? (
          <section className="relative overflow-hidden rounded-[30px] border border-yellow-100 bg-gradient-to-br from-white via-rose-50/70 to-yellow-50 shadow-2xl shadow-rose-100/80">
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-yellow-200/50 blur-2xl" />
            <div className="mobile-auth-glow pointer-events-none absolute -bottom-8 left-6 h-24 w-24 rounded-full blur-3xl" />
            <HiOutlineSparkles className="pointer-events-none absolute left-5 top-5 text-2xl text-yellow-300 drop-shadow-[0_8px_10px_rgba(234,179,8,0.35)]" />
            <HiOutlineSparkles className="pointer-events-none absolute right-16 top-4 rotate-12 text-xl text-yellow-400 drop-shadow-[0_7px_9px_rgba(234,179,8,0.32)]" />
            <HiOutlineSparkles className="pointer-events-none absolute right-5 top-20 -rotate-12 text-3xl text-yellow-300 drop-shadow-[0_12px_14px_rgba(234,179,8,0.34)]" />
            <div className="relative flex items-center justify-between border-b border-yellow-100/80 bg-white/45 px-4 py-4 backdrop-blur-sm">
              <div className="pl-8">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Cumpleanos hoy</p>
                <h2 className="text-lg font-black text-slate-950">Alumnos de tus cursos</h2>
              </div>
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-500 shadow-lg shadow-yellow-200/80 ring-1 ring-yellow-100">
                <HiOutlineSparkles className="absolute -right-1 -top-1 text-sm text-yellow-400 drop-shadow-[0_5px_5px_rgba(234,179,8,0.35)]" />
                <HiOutlineCake size={22} />
              </div>
            </div>
            <div className="relative space-y-2 p-4">
              <HiOutlineSparkles className="pointer-events-none absolute left-3 top-1 text-sm text-yellow-300 drop-shadow-[0_5px_6px_rgba(234,179,8,0.3)]" />
              <HiOutlineSparkles className="pointer-events-none absolute bottom-3 right-7 text-lg text-yellow-300 drop-shadow-[0_7px_8px_rgba(234,179,8,0.3)]" />
              {birthdayStudents.map((student) => {
                const photo = toAbsoluteUrl(student.photo_url)
                const [first = '', ...rest] = student.name.split(' ')
                return (
                  <div key={student.id} className="relative flex items-center gap-3 rounded-2xl border border-white bg-white/90 p-3 shadow-lg shadow-yellow-100/50">
                    <HiOutlineSparkles className="absolute -left-1 -top-1 text-xs text-yellow-400 drop-shadow-[0_4px_4px_rgba(234,179,8,0.35)]" />
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-rose-50 text-sm font-black text-rose-600 shadow-inner">
                      {photo ? <img src={photo} alt={student.name} className="h-full w-full object-cover" /> : initials(first, rest.join(' '))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-950">{student.name}</p>
                      <p className="truncate text-xs font-bold text-slate-500">{student.courses.join(' - ')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}
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
        <div className="mobile-border-primary rounded-[24px] border bg-white p-4 shadow-lg shadow-slate-200/70">
          <HiOutlineChartBar className="mobile-text-primary mb-3" size={24} />
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

