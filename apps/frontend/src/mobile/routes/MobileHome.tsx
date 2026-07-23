import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineCake, HiOutlineCheckCircle, HiOutlineClock, HiOutlineSparkles, HiOutlineSpeakerphone, HiOutlineX } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { toAbsoluteUrl } from '../../lib/api'
import MobileCard from '../components/MobileCard'
import { getMobileUser, mobileApi, mobileUserName } from '../services/mobileApi'

interface StudentSummary {
  student?: {
    is_active?: boolean
  }
  attendance?: { percent?: number }
  classes_active?: number
  payments?: { total_last_90?: number }
  enrollments?: Array<{
    id: number
    is_active?: boolean
    payment_status?: string | null
    start_date?: string | null
    end_date?: string | null
    course?: {
      id: number
      name: string
      teacher_name?: string | null
      day_of_week?: number | null
      start_time?: string | null
      day_of_week_2?: number | null
      start_time_2?: string | null
      day_of_week_3?: number | null
      start_time_3?: string | null
      day_of_week_4?: number | null
      start_time_4?: string | null
      day_of_week_5?: number | null
      start_time_5?: string | null
    }
  }>
}

type StudentCourseSummary = NonNullable<NonNullable<StudentSummary['enrollments']>[number]['course']>

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
  promotion: { label: 'Promoción', badge: 'bg-emerald-600 text-white', icon: 'bg-emerald-50 text-emerald-600' },
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
  if (role === 'teacher') return 'Visible mínimo 2 meses'
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

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const courseSlots = (course?: StudentCourseSummary) => {
  if (!course) return []
  return [
    [course.day_of_week, course.start_time],
    [course.day_of_week_2, course.start_time_2],
    [course.day_of_week_3, course.start_time_3],
    [course.day_of_week_4, course.start_time_4],
    [course.day_of_week_5, course.start_time_5],
  ]
    .filter(([day, time]) => day != null && time)
    .map(([day, time]) => ({ day: Number(day), time: String(time).slice(0, 5) }))
}

const nextClassFromEnrollments = (enrollments?: StudentSummary['enrollments']) => {
  const activeEnrollments = (enrollments || []).filter((item) => item.is_active !== false)
  const now = new Date()
  const todayMonFirst = (now.getDay() + 6) % 7
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  let best: {
    courseName: string
    teacherName?: string | null
    dayLabel: string
    shortLabel: string
    time: string
    daysAway: number
  } | null = null

  for (const enrollment of activeEnrollments) {
    for (const slot of courseSlots(enrollment.course)) {
      const [hour, minute] = slot.time.split(':').map(Number)
      const slotMinutes = (hour || 0) * 60 + (minute || 0)
      let daysAway = (slot.day - todayMonFirst + 7) % 7
      if (daysAway === 0 && slotMinutes < currentMinutes) daysAway = 7
      const candidate = {
        courseName: enrollment.course?.name || 'Curso',
        teacherName: enrollment.course?.teacher_name,
        dayLabel: daysAway === 0 ? 'Hoy' : daysAway === 1 ? 'Mañana' : DAY_LABELS[slot.day] || 'Próxima clase',
        shortLabel: DAY_SHORT[slot.day] || 'Clase',
        time: slot.time,
        daysAway,
      }
      if (!best || candidate.daysAway < best.daysAway || (candidate.daysAway === best.daysAway && candidate.time < best.time)) {
        best = candidate
      }
    }
  }

  return best
}

const nextClassReminderText = (nextClass: NonNullable<ReturnType<typeof nextClassFromEnrollments>>) => {
  const day = nextClass.dayLabel.toLowerCase()
  if (nextClass.dayLabel === 'Hoy') return 'Recuerda que hoy es tu curso a las'
  if (nextClass.dayLabel === 'Mañana') return 'Recuerda que mañana tienes clase a las'
  return `Recuerda que este ${day} tienes clase a las`
}

const formatShortDate = (value?: string | null) => {
  if (!value) return null
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}-${month}-${year}`
}

const pendingEnrollmentFromSummary = (enrollments?: StudentSummary['enrollments']) =>
  (enrollments || []).find((item) => item.is_active !== false && item.payment_status !== 'activo')

const TEACHER_DAILY_MESSAGES = [
  'Cada clase puede ser el impulso que un alumno necesitaba hoy.',
  'Tu energía marca el ritmo antes de que empiece la música.',
  'Una buena clase también se construye con orden y presencia.',
  'Hoy tienes una nueva oportunidad para inspirar disciplina.',
  'Los pequeños avances también cuentan cuando se sostienen.',
  'Tu constancia ayuda a que tus alumnos confíen en su proceso.',
  'Enseñar también es observar, ajustar y acompañar.',
  'Una clase clara deja alumnos más seguros y motivados.',
  'El progreso se nota cuando cada detalle tiene intención.',
  'Hoy puedes convertir una corrección en una mejora real.',
  'La actitud del profesor define mucho antes del primer paso.',
  'Cada asistencia marcada también cuenta una historia de compromiso.',
  'Un alumno motivado empieza muchas veces con una guía cercana.',
  'La técnica mejora cuando existe paciencia y dirección.',
  'Tu clase puede ser el mejor momento del día para alguien.',
  'La energía correcta transforma un grupo en comunidad.',
  'Ordenar la clase también es cuidar la experiencia del alumno.',
  'Hoy enfócate en que cada alumno se lleve algo concreto.',
  'Una indicación simple puede cambiar todo el resultado.',
  'La mejor clase combina estructura, energía y escucha.',
  'Tu liderazgo se nota en cómo el grupo avanza unido.',
  'Cada alumno progresa a su ritmo; tu guía le da dirección.',
  'Hoy es buen día para reforzar confianza y técnica.',
  'La presencia del profesor también enseña.',
  'Una clase bien guiada deja ganas de volver.',
  'El compromiso se contagia cuando se trabaja con propósito.',
  'Cada horario es una oportunidad para elevar el nivel.',
  'La disciplina se construye mejor con una guía constante.',
  'Tu forma de enseñar también crea identidad para el estudio.',
  'Hoy deja una clase que se recuerde por su energía y claridad.',
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
  const [expandedAnnouncementImage, setExpandedAnnouncementImage] = useState<{ src: string; title: string } | null>(null)

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
  const studentFirstName = user?.first_name || mobileUserName(user).split(' ')[0] || 'Alumno'
  const nextClass = useMemo(() => nextClassFromEnrollments(summary?.enrollments), [summary?.enrollments])
  const studentNextClassTeacherFirstName = nextClass?.teacherName?.trim().split(/\s+/)[0]
  const studentIsActive = summary?.student?.is_active !== false
  const pendingEnrollment = useMemo(() => pendingEnrollmentFromSummary(summary?.enrollments), [summary?.enrollments])
  const studentStatus = !studentIsActive
    ? { label: 'Inactivo', textClass: 'text-rose-600', iconClass: 'bg-rose-50 text-rose-500', borderClass: 'border-rose-100' }
    : pendingEnrollment
      ? { label: 'Pendiente', textClass: 'text-amber-600', iconClass: 'bg-amber-50 text-amber-500', borderClass: 'border-amber-100' }
      : { label: 'Activo', textClass: 'text-emerald-600', iconClass: 'bg-emerald-50 text-emerald-500', borderClass: 'border-emerald-100' }
  const pendingCourseName = pendingEnrollment?.course?.name || 'tu curso'
  const pendingPeriodText = pendingEnrollment
    ? [formatShortDate(pendingEnrollment.start_date), formatShortDate(pendingEnrollment.end_date)].filter(Boolean).join(' / ')
    : ''

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
        const openAnnouncementImage = () => {
          if (image) setExpandedAnnouncementImage({ src: image, title: currentAnnouncement.title })
        }
        return (
          <article
            key={currentAnnouncement.id}
            className="mobile-announcement-slide overflow-hidden rounded-[32px] border border-white bg-white shadow-[0_26px_52px_rgba(15,23,42,0.22),0_14px_26px_rgba(15,23,42,0.10)] ring-1 ring-slate-100"
          >
            <button
              type="button"
              onClick={openAnnouncementImage}
              onTouchStart={openAnnouncementImage}
              disabled={!image}
              className="relative block min-h-[330px] w-full overflow-hidden bg-slate-950 text-left disabled:cursor-default"
              aria-label={image ? 'Ver imagen del aviso en grande' : currentAnnouncement.title}
            >
              {image ? (
                <>
                  <img src={image} alt={currentAnnouncement.title} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/28 to-slate-950/10" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/60 to-transparent" />
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.7),transparent_34%),linear-gradient(135deg,#020617,#581c87_55%,#111827)]" />
              )}
              <div className="pointer-events-none absolute left-4 top-4 z-[2] flex items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-black/20 ${typeConfig.badge}`}>
                  {typeConfig.label}
                </span>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur">
                  Nuevo
                </span>
              </div>
              <div className="mobile-text-primary pointer-events-none absolute right-4 top-4 z-[2] rounded-2xl bg-white/95 p-2 shadow-xl shadow-black/20">
                <HiOutlineSpeakerphone size={18} />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-5 text-white">
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
            </button>
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

  const expandedImageModal = expandedAnnouncementImage && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md">
      <button
        type="button"
        onClick={() => setExpandedAnnouncementImage(null)}
        className="absolute inset-0 cursor-zoom-out"
        aria-label="Cerrar imagen ampliada"
      />
      <div className="relative z-10 w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setExpandedAnnouncementImage(null)}
          className="absolute -right-2 -top-12 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-xl backdrop-blur hover:bg-white/20"
          aria-label="Cerrar"
        >
          <HiOutlineX size={20} />
        </button>
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-2xl shadow-black/40">
          <img src={expandedAnnouncementImage.src} alt={expandedAnnouncementImage.title} className="max-h-[82vh] w-full object-contain" />
        </div>
        <p className="mt-3 text-center text-sm font-black text-white">{expandedAnnouncementImage.title}</p>
      </div>
    </div>,
    document.body
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
              <p className="mobile-text-primary mb-1 text-[10px] font-black uppercase tracking-[0.22em]">Mensaje del día</p>
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
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">Cumpleaños hoy</p>
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
        {expandedImageModal}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MobileCard accent="plain" eyebrow="Alumno" title={`Hola, ${studentFirstName}`}>
        {nextClass ? (
          <div className="mt-2 space-y-5">
            <div>
              <p className="text-lg font-medium leading-7 text-slate-950">{nextClassReminderText(nextClass)}</p>
              <p className="text-lg font-black leading-7 text-slate-400">
                {nextClass.time} hrs{studentNextClassTeacherFirstName ? ` con ${studentNextClassTeacherFirstName}.` : '.'}
              </p>
            </div>
            <div
              className="relative mb-5 rounded-[22px] px-5 pb-10 pt-5 text-white shadow-2xl"
              style={{
                backgroundImage: 'linear-gradient(135deg, var(--mobile-primary, #c026d3), var(--mobile-primary-dark, #a21caf))',
                boxShadow: '0 14px 26px color-mix(in srgb, var(--mobile-primary-shadow, rgba(192, 38, 211, 0.28)) 55%, transparent)',
              }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/75">Tu curso</p>
              <p className="mt-2 text-xl font-black leading-tight">{nextClass.courseName}</p>
              <span
                className="absolute -bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/25 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-xl"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--mobile-primary, #c026d3) 88%, white)',
                  boxShadow: '0 8px 18px color-mix(in srgb, var(--mobile-primary-shadow, rgba(192, 38, 211, 0.28)) 50%, transparent)',
                }}
              >
                <HiOutlineClock size={13} /> {nextClass.shortLabel} {nextClass.time}
              </span>
            </div>
            {pendingEnrollment ? (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">Curso pendiente</p>
                <p className="mt-1 text-sm font-black leading-5 text-slate-950">
                  Recuerda actualizar tu curso {pendingCourseName}.
                </p>
                {pendingPeriodText ? (
                  <p className="mt-1 text-xs font-bold text-amber-700">Periodo: {pendingPeriodText}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Revisa tu avance, pagos y anuncios importantes desde tu celular.
          </p>
        )}
      </MobileCard>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[24px] border border-emerald-100 bg-white p-4 shadow-lg shadow-slate-200/70">
          <div className="flex min-h-[76px] items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cursos</p>
              <p className="mt-1 text-3xl font-black text-slate-950">{summary?.classes_active || 0}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <HiOutlineCheckCircle size={24} />
            </span>
          </div>
        </div>
        <div className={`rounded-[24px] border bg-white p-4 shadow-lg shadow-slate-200/70 ${studentStatus.borderClass}`}>
          <div className="flex min-h-[76px] items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</p>
              <p className={`mt-1 text-xl font-black ${studentStatus.textClass}`}>{studentStatus.label}</p>
            </div>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${studentStatus.iconClass}`}>
              <HiOutlineCheckCircle size={24} />
            </span>
          </div>
        </div>
      </div>
      {announcementPanel}
      {expandedImageModal}
    </div>
  )
}

