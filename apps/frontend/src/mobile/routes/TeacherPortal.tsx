import { useEffect, useState } from 'react'
import { HiOutlineAcademicCap, HiOutlineCalendar, HiOutlineCheckCircle, HiOutlineLocationMarker, HiOutlineUserGroup } from 'react-icons/hi'
import { IoFemale, IoMale } from 'react-icons/io5'
import { toAbsoluteUrl } from '../../lib/api'
import MobileCard from '../components/MobileCard'
import { mobileApi } from '../services/mobileApi'

type StudentItem = {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  gender?: string | null
  photo_url?: string | null
  enrolled_since?: string | null
  renewal_date?: string | null
  enrollment_mode?: 'regular' | 'single_class' | string | null
  single_class_date?: string | null
  payment_status?: string | null
}

type CourseItem = {
  id: number
  name: string
  level?: string | null
  image_url?: string | null
  room_name?: string | null
  student_count: number
  attended_today_student_ids?: number[]
  students: StudentItem[]
  day_of_week?: number | null
  start_time?: string | null
  end_time?: string | null
  day_of_week_2?: number | null
  start_time_2?: string | null
  end_time_2?: string | null
  day_of_week_3?: number | null
  start_time_3?: string | null
  end_time_3?: string | null
  day_of_week_4?: number | null
  start_time_4?: string | null
  end_time_4?: string | null
  day_of_week_5?: number | null
  start_time_5?: string | null
  end_time_5?: string | null
}

type TeacherPortalSummary = {
  teacher?: { name?: string | null }
  tenant?: { name?: string | null }
  courses: CourseItem[]
  course_count: number
  student_count: number
}

const dayNames = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

const initials = (first?: string, last?: string) => {
  const a = first?.trim()?.[0] || ''
  const b = last?.trim()?.[0] || ''
  return `${a}${b}`.toUpperCase() || 'AL'
}

const timeText = (value?: string | null) => value ? value.slice(0, 5) : ''

const scheduleItems = (course: CourseItem) => {
  const blocks = [
    [course.day_of_week, course.start_time, course.end_time],
    [course.day_of_week_2, course.start_time_2, course.end_time_2],
    [course.day_of_week_3, course.start_time_3, course.end_time_3],
    [course.day_of_week_4, course.start_time_4, course.end_time_4],
    [course.day_of_week_5, course.start_time_5, course.end_time_5],
  ] as Array<[number | null | undefined, string | null | undefined, string | null | undefined]>
  return blocks
    .filter(([day, start]) => day != null && !!start)
    .map(([day, start, end]) => `${dayNames[Number(day)] || 'Dia'} ${timeText(start)}${end ? `-${timeText(end)}` : ''}`)
}

const genderCounts = (students: StudentItem[]) => {
  return students.reduce(
    (acc, student) => {
      const gender = (student.gender || '').trim().toLowerCase()
      if (gender.startsWith('f') || gender.startsWith('muj') || gender === 'female' || gender === 'femenino' || gender === 'mujer') {
        acc.female += 1
      } else if ((gender.startsWith('m') && !gender.startsWith('muj')) || gender === 'male' || gender === 'masculino' || gender === 'hombre') {
        acc.male += 1
      }
      return acc
    },
    { female: 0, male: 0 },
  )
}

const enrollmentLabel = (student: StudentItem) => {
  if (student.single_class_date) return 'Clase suelta'
  if (student.enrollment_mode === 'single_class') return 'Clase suelta'
  if (student.renewal_date && student.enrolled_since === student.renewal_date) return 'Clase suelta'
  return 'Mensualidad'
}

export default function TeacherPortal() {
  const [summary, setSummary] = useState<TeacherPortalSummary | null>(null)
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null)
  const [markingStudentId, setMarkingStudentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = async (silent = false) => {
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const res = await mobileApi.get<TeacherPortalSummary>('/api/pms/teachers/portal/me')
      setSummary(res.data)
      setExpandedCourseId((current) => {
        if (current && res.data?.courses?.some((course) => course.id === current)) return current
        return null
      })
    } catch (err: any) {
      if (!silent) setError(err?.message || 'No se pudo cargar tus cursos.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    const id = window.setInterval(() => loadSummary(true), 8000)
    const onFocus = () => loadSummary(true)
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadSummary(true)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const markPresent = async (courseId: number, studentId: number) => {
    setMarkingStudentId(studentId)
    setError('')
    try {
      await mobileApi.post('/api/pms/teachers/portal/attendance', {
        course_id: courseId,
        student_id: studentId,
      })
      setSummary((current) => {
        if (!current) return current
        return {
          ...current,
          courses: current.courses.map((course) => {
            if (course.id !== courseId) return course
            const ids = new Set(course.attended_today_student_ids || [])
            ids.add(studentId)
            return { ...course, attended_today_student_ids: Array.from(ids) }
          }),
        }
      })
    } catch (err: any) {
      setError(err?.message || 'No se pudo marcar asistencia.')
    } finally {
      setMarkingStudentId(null)
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="mobile-spinner mx-auto h-10 w-10 animate-spin rounded-full border-4" />
        <p className="mobile-text-primary mt-4 text-[10px] font-black uppercase tracking-widest">Cargando cursos...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="px-1 pt-1">
        <p className="mobile-text-primary mb-2 text-[10px] font-black uppercase tracking-[0.24em]">Cursos</p>
        <h2 className="text-2xl font-black leading-tight text-slate-950">Mis cursos</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          Selecciona un curso para revisar alumnos y marcar asistencia.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="mobile-bg-primary relative overflow-hidden rounded-[24px] border border-white/20 p-4 text-white shadow-xl shadow-slate-300/70">
            <div className="relative flex items-center gap-3">
              <HiOutlineAcademicCap className="shrink-0 text-white" size={28} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white">Cursos</p>
                <p className="mt-0.5 text-2xl font-black leading-none">{summary?.course_count || 0}</p>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[24px] border border-slate-900 bg-slate-950 p-4 text-white shadow-xl shadow-slate-300/70">
            <div className="mobile-bg-primary absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-25 blur-sm" />
            <div className="relative flex items-center gap-3">
              <HiOutlineUserGroup className="shrink-0 text-white" size={28} />
              <div>
                <p className="mobile-text-accent text-[10px] font-black uppercase tracking-widest">Alumnos</p>
                <p className="mt-0.5 text-2xl font-black leading-none">{summary?.student_count || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p> : null}

      {summary?.courses?.length ? summary.courses.map((course) => {
        const expanded = expandedCourseId === course.id
        const courseImage = toAbsoluteUrl(course.image_url)
        const counts = genderCounts(course.students)
        return (
          <section key={course.id} className="overflow-hidden rounded-[30px] border border-slate-100 bg-white shadow-xl shadow-slate-200/70">
            <button
              type="button"
              onClick={() => setExpandedCourseId(expanded ? null : course.id)}
              className="w-full p-4 text-left"
            >
              <div className="flex gap-4">
                <div className="mobile-bg-primary h-20 w-20 shrink-0 overflow-hidden rounded-3xl text-white shadow-lg shadow-slate-300/70">
                  {courseImage ? <img src={courseImage} alt={course.name} className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-black">{course.name.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="mobile-text-primary text-[10px] font-black uppercase tracking-[0.22em]">Curso</p>
                  <h3 className="mt-1 text-lg font-black leading-tight text-slate-950">{course.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                      <HiOutlineUserGroup /> {course.student_count} alumnos
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black text-pink-600">
                      <IoFemale /> {counts.female}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black text-sky-600">
                      <IoMale /> {counts.male}
                    </span>
                    {course.room_name ? (
                      <span className="mobile-bg-primary-soft mobile-text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black">
                        <HiOutlineLocationMarker /> {course.room_name}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {scheduleItems(course).map((item) => (
                  <span key={item} className="mobile-bg-primary-soft mobile-text-primary mobile-border-primary inline-flex items-center gap-1 rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider">
                    <HiOutlineCalendar /> {item}
                  </span>
                ))}
              </div>
            </button>

            {expanded ? (
              <div className="border-t border-slate-100 bg-slate-50/70 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Alumnos inscritos</p>
                <div className="space-y-2">
                  {course.students.length ? course.students.map((student) => {
                    const photo = toAbsoluteUrl(student.photo_url)
                    const isPresent = (course.attended_today_student_ids || []).includes(student.id)
                    return (
                      <div key={student.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
                        <div className="mobile-bg-primary-soft mobile-text-primary flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-black">
                          {photo ? <img src={photo} alt={`${student.first_name} ${student.last_name}`} className="h-full w-full object-cover" /> : initials(student.first_name, student.last_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-950">{student.first_name} {student.last_name}</p>
                          <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                            enrollmentLabel(student) === 'Clase suelta'
                              ? 'bg-amber-50 text-amber-600'
                              : 'mobile-bg-primary-soft mobile-text-primary'
                          }`}>
                            {enrollmentLabel(student)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isPresent || markingStudentId === student.id}
                          onClick={() => markPresent(course.id, student.id)}
                          className={`shrink-0 rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                            isPresent
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'mobile-bg-primary text-white shadow-lg shadow-slate-200 hover:brightness-95'
                          } disabled:opacity-80`}
                        >
                          <span className="inline-flex items-center gap-1">
                            <HiOutlineCheckCircle />
                            {isPresent ? 'Presente' : markingStudentId === student.id ? '...' : 'Presente'}
                          </span>
                        </button>
                      </div>
                    )
                  }) : (
                    <p className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500">No hay alumnos activos inscritos.</p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        )
      }) : (
        <MobileCard accent="dark" eyebrow="Cursos" title="Sin cursos asignados">
          <p className="text-sm font-semibold leading-6 text-slate-300">
            Aun no tienes cursos activos asignados en este estudio.
          </p>
        </MobileCard>
      )}
    </div>
  )
}
