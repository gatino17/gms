import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toAbsoluteUrl } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import {
  HiOutlineLockClosed,
  HiOutlineCheckCircle,
  HiOutlineUserGroup,
  HiOutlineX,
  HiOutlineArrowLeft,
  HiOutlineSearch,
} from 'react-icons/hi'
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi'
import { useTenant } from '../lib/tenant'

type KioskCourse = {
  course: {
    id: number
    name: string
    level?: string
    day_of_week?: number | null
    day_of_week_2?: number | null
    day_of_week_3?: number | null
    day_of_week_4?: number | null
    day_of_week_5?: number | null
    start_time?: string | null
    start_time_2?: string | null
    start_time_3?: string | null
    start_time_4?: string | null
    start_time_5?: string | null
  }
  teacher?: { name?: string | null } | null
  students: {
    id: number
    first_name: string
    last_name: string
    photo_url?: string | null
  }[]
}

export default function AttendanceKioskPage() {
  const FEEDBACK_DURATION_MS = 4000
  const navigate = useNavigate()
  const { tenantId } = useTenant()

  const [courses, setCourses] = useState<KioskCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<KioskCourse | null>(null)
  const [courseQuery, setCourseQuery] = useState('')
  const [studentQuery, setStudentQuery] = useState('')

  // Security Modal
  const [showExitModal, setShowExitModal] = useState(false)
  const [exitPin, setExitPin] = useState('')
  const [exitError, setExitError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [todayMarkedIds, setTodayMarkedIds] = useState<number[]>([])

  // Success feedback
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'ok' | 'already' | 'renewal' | 'last_day'
    studentName: string
    courseName: string
    attendedAt?: string
    renewalMessage?: string
    lastDayMessage?: string
  } | null>(null)

  const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  const hhmm = (t?: string | null) => (t ? String(t).slice(0, 5) : '--:--')

  const getScheduleLabel = (course: KioskCourse['course']) => {
    const slots = [
      { d: course.day_of_week, st: course.start_time },
      { d: course.day_of_week_2, st: course.start_time_2 },
      { d: course.day_of_week_3, st: course.start_time_3 },
      { d: course.day_of_week_4, st: course.start_time_4 },
      { d: course.day_of_week_5, st: course.start_time_5 },
    ].filter((s) => s.d != null && s.st)

    if (!slots.length) return 'Horario por confirmar'
    return slots
      .map((s) => `${DAY_NAMES[s.d as number]} ${hhmm(s.st)}`)
      .join(' · ')
  }

  const getWeeklyFrequencyLabel = (course: KioskCourse['course']) => {
    const count = [
      course.day_of_week,
      course.day_of_week_2,
      course.day_of_week_3,
      course.day_of_week_4,
      course.day_of_week_5,
    ].filter((d) => d != null).length
    if (count <= 1) return null
    return `${count} veces por semana`
  }

  const formatAttendanceTime = (iso?: string) => {
    if (!iso) return ''
    const dt = new Date(iso)
    if (Number.isNaN(dt.getTime())) return ''
    return new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(dt)
  }

  useEffect(() => {
    loadTodayCourses()
  }, [tenantId])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const loadTodayCourses = async () => {
    if (!tenantId) {
      setCourses([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // JS: 0=Sunday..6=Saturday, backend: 0=Monday..6=Sunday
      const jsDay = new Date().getDay()
      const dayOfWeek = (jsDay + 6) % 7
      const { data } = await api.get<KioskCourse[]>('/api/pms/course_status', {
        params: { day_of_week: dayOfWeek },
        headers: { 'X-Tenant-ID': tenantId },
      })
      setCourses(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const refreshTodayAttendance = async (courseId?: number) => {
    if (!tenantId || !courseId) {
      setTodayMarkedIds([])
      return
    }
    try {
      const { data } = await api.get('/api/pms/attendance/today', {
        params: { course_id: courseId },
        headers: { 'X-Tenant-ID': tenantId },
      })
      setTodayMarkedIds(Array.isArray(data?.student_ids) ? data.student_ids : [])
    } catch (e) {
      console.error('No se pudo cargar asistencia del día', e)
    }
  }

  const markAttendance = async (studentId: number, studentName: string) => {
    if (!selectedCourse || !tenantId) return
    try {
      const res = await api.post(
        '/api/pms/attendance',
        { student_id: studentId, course_id: selectedCourse.course.id },
        { headers: { 'X-Tenant-ID': tenantId } }
      )
      if (res.data?.status === 'already_marked') {
        setFeedbackMsg({
          type: 'already',
          studentName,
          courseName: selectedCourse.course.name,
          attendedAt: res.data?.attended_at,
        })
      } else {
        if (res.data?.renewal_required) {
          setFeedbackMsg({
            type: 'renewal',
            studentName,
            courseName: selectedCourse.course.name,
            renewalMessage: res.data?.renewal_message || 'Está en proceso de renovación, favor pasar por recepción.',
          })
        } else if (res.data?.last_class_today) {
          setFeedbackMsg({
            type: 'last_day',
            studentName,
            courseName: selectedCourse.course.name,
            lastDayMessage: res.data?.last_class_message || 'Hoy es tu última clase, recuerda pasar a renovar.',
          })
        } else {
          setFeedbackMsg({
            type: 'ok',
            studentName,
            courseName: selectedCourse.course.name,
          })
        }
        setTodayMarkedIds((prev) => (prev.includes(studentId) ? prev : [...prev, studentId]))
      }
      setTimeout(() => {
        setFeedbackMsg(null)
        setSelectedCourse(null)
        setStudentQuery('')
      }, FEEDBACK_DURATION_MS)
    } catch {
      alert('Error al marcar asistencia. Por favor, intenta nuevamente.')
    }
  }
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (e) {
      console.error('No se pudo cambiar a pantalla completa', e)
    }
  }

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exitPin.trim()) return
    setIsVerifying(true)
    setExitError('')
    try {
      await api.post(
        '/api/pms/tenants/verify_unlock',
        { code: exitPin },
        { headers: { 'X-Tenant-ID': tenantId } }
      )
      navigate('/')
    } catch (err: any) {
      setExitError(err.response?.data?.detail || 'PIN o clave incorrectos')
    } finally {
      setIsVerifying(false)
    }
  }

  const nowLabel = (() => {
    const datePart = new Intl.DateTimeFormat('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
    const timePart = new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now)
    return `${datePart.charAt(0).toUpperCase()}${datePart.slice(1)}, ${timePart} hrs`
  })()

  const filteredCourses = courses.filter((row) => {
    const q = courseQuery.trim().toLowerCase()
    if (!q) return true
    const target = `${row.course.name} ${row.teacher?.name ?? ''}`.toLowerCase()
    return target.includes(q)
  })

  const filteredStudents = (selectedCourse?.students || []).filter((s) => {
    const q = studentQuery.trim().toLowerCase()
    if (!q) return true
    const target = `${s.first_name} ${s.last_name}`.toLowerCase()
    return target.includes(q)
  })

  useEffect(() => {
    const courseId = selectedCourse?.course.id
    if (!courseId) {
      setTodayMarkedIds([])
      return
    }

    refreshTodayAttendance(courseId)
    const id = setInterval(() => refreshTodayAttendance(courseId), 8000)
    const onFocus = () => refreshTodayAttendance(courseId)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshTodayAttendance(courseId)
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tenantId, selectedCourse?.course.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-fuchsia-400/30 border-t-fuchsia-500 rounded-full animate-spin" />
        <p className="text-fuchsia-400 font-black uppercase tracking-[0.3em] text-sm">Iniciando Modo Asistencia</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-zinc-100 flex flex-col font-sans overflow-hidden">
      {/* Kiosk Header */}
      <header className="h-20 md:h-24 bg-black/45 backdrop-blur-md border-b border-zinc-800/70 flex items-center justify-between px-4 md:px-10 shrink-0 sticky top-0 z-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Auto-Asistencia</h1>
          <p className="text-fuchsia-400 font-bold uppercase tracking-widest text-sm mt-1">
            Selecciona tu clase para registrarte
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFullscreen}
            className="w-14 h-14 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-fuchsia-300 transition-colors border border-zinc-700/60"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Expandir a pantalla completa'}
          >
            {isFullscreen ? <FiMinimize2 size={20} /> : <FiMaximize2 size={20} />}
          </button>
          <button
            onClick={() => setShowExitModal(true)}
            className="w-14 h-14 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-fuchsia-300 transition-colors border border-zinc-700/60"
            title="Salir del Modo Asistencia"
          >
            <HiOutlineLockClosed size={28} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 min-h-0 p-4 md:p-6 lg:p-8 flex flex-col items-center relative overflow-hidden ${
          selectedCourse ? 'justify-start pt-4 md:pt-6' : 'justify-center'
        }`}
      >
        {/* Success Overlay */}
        {feedbackMsg && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center">
            <HiOutlineCheckCircle className={`${feedbackMsg.type === 'renewal' ? 'text-red-400' : feedbackMsg.type === 'last_day' ? 'text-orange-400' : feedbackMsg.type === 'already' ? 'text-amber-300' : 'text-fuchsia-400'} mb-6`} size={120} />
            <h2 className="text-5xl font-black text-white mb-4 text-center">
              {'\u00a1'}Hola {feedbackMsg.studentName}!
            </h2>
            {feedbackMsg.type === 'already' ? (
              <>
                <p className="text-2xl text-amber-200 font-bold tracking-widest uppercase">
                  Ya marcaste asistencia hoy
                </p>
                <p className="text-lg text-zinc-300 mt-4">
                  Registro previo: {formatAttendanceTime(feedbackMsg.attendedAt)} hrs
                </p>
              </>
            ) : feedbackMsg.type === 'renewal' ? (
              <>
                <p className="text-2xl text-red-300 font-extrabold tracking-widest uppercase">
                  Asistencia registrada
                </p>
                <p className="text-xl text-red-100 mt-4 text-center max-w-2xl bg-red-900/40 border border-red-500/60 rounded-2xl px-6 py-4 font-bold">
                  {feedbackMsg.renewalMessage}
                </p>
              </>
            ) : feedbackMsg.type === 'last_day' ? (
              <>
                <p className="text-2xl text-orange-300 font-extrabold tracking-widest uppercase">
                  Asistencia registrada
                </p>
                <p className="text-xl text-orange-100 mt-4 text-center max-w-2xl bg-orange-900/40 border border-orange-500/70 rounded-2xl px-6 py-4 font-black shadow-lg shadow-orange-900/30">
                  {feedbackMsg.lastDayMessage}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl text-fuchsia-300 font-bold tracking-widest uppercase">
                  Asistencia Registrada Correctamente
                </p>
                <p className="text-lg text-zinc-300 mt-4">Disfruta tu clase de {feedbackMsg.courseName}</p>
              </>
            )}
          </div>
        )}

        {/* Step 1: Select Course */}
        {!selectedCourse && !feedbackMsg && (
          <div className="w-full max-w-7xl h-full min-h-0 flex flex-col">
            <div className="mb-3 md:mb-4 text-center shrink-0">
              <h2 className="text-lg md:text-2xl font-black text-white tracking-tight">{nowLabel}</h2>
            </div>
            <div className="mb-3 md:mb-4 shrink-0">
              <div className="relative">
                <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder="Buscar curso o profesor..."
                  className="w-full h-12 md:h-14 bg-zinc-900/85 border border-zinc-700 text-white rounded-2xl pl-11 pr-4 text-sm md:text-base outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 shadow-lg shadow-black/20"
                />
              </div>
            </div>
            {filteredCourses.length === 0 ? (
              <div className="text-center space-y-6">
                <HiOutlineUserGroup className="text-zinc-700 mx-auto" size={100} />
                <h2 className="text-3xl font-black text-zinc-400">No hay cursos que coincidan con la búsqueda.</h2>
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start auto-rows-max overflow-visible pt-1">
                {filteredCourses.map((row) => (
                  <button
                    key={row.course.id}
                    onClick={() => setSelectedCourse(row)}
                    className="group relative bg-zinc-50 border border-zinc-300 rounded-2xl md:rounded-[24px] p-4 md:p-5 text-left hover:border-fuchsia-300 transition-all hover:-translate-y-1 shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 flex flex-col justify-between min-h-[180px] overflow-hidden"
                  >
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-zinc-200 via-zinc-100 to-white" />
                    <div className="relative">
                      <div className="inline-flex items-center rounded-full bg-fuchsia-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 mb-4">
                        Modo Asistencia
                      </div>
                      <h3 className="text-xl md:text-2xl font-black text-zinc-900 group-hover:text-fuchsia-700 transition-colors leading-tight line-clamp-2">
                        {row.course.name}
                      </h3>
                      {row.teacher?.name && (
                        <p className="text-zinc-600 text-sm md:text-base mt-2 flex items-center gap-2 font-semibold line-clamp-1">
                          <span className="w-2 h-2 rounded-full bg-fuchsia-500 inline-block" />
                          Prof: {row.teacher.name}
                        </p>
                      )}
                    </div>
                    <div className="relative mt-3 flex items-center gap-3">
                      <div className="bg-zinc-200 px-3 py-1.5 rounded-xl text-zinc-800 font-black uppercase tracking-widest text-[11px] border border-zinc-300">
                        {row.students.length} Inscritos
                      </div>
                    </div>
                    <p className="relative mt-2 text-xs md:text-sm text-zinc-700 font-bold line-clamp-2">
                      {getScheduleLabel(row.course)}
                    </p>
                    {getWeeklyFrequencyLabel(row.course) && (
                      <p className="relative mt-1 text-xs md:text-sm text-fuchsia-700 font-black uppercase tracking-wide">
                        {getWeeklyFrequencyLabel(row.course)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Student */}
        {selectedCourse && !feedbackMsg && (
          <div className="w-full max-w-7xl h-full min-h-0 flex flex-col">
            <div className="flex items-center gap-4 mb-4 md:mb-6 shrink-0">
              <button
                onClick={() => {
                  setSelectedCourse(null)
                  setStudentQuery('')
                }}
                className="w-12 h-12 md:w-14 md:h-14 bg-zinc-900 hover:bg-zinc-800 rounded-2xl flex items-center justify-center text-white transition-all shadow-lg border border-zinc-700"
              >
                <HiOutlineArrowLeft size={24} />
              </button>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight line-clamp-1">{selectedCourse.course.name}</h2>
                <p className="text-fuchsia-400 font-bold uppercase tracking-widest mt-1 text-xs md:text-sm">
                  {'\u00bf'}Cu{'\u00e1'}l es tu nombre?
                </p>
              </div>
            </div>
            <div className="mb-3 md:mb-4 shrink-0">
              <div className="relative">
                <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Buscar alumno por nombre..."
                  className="w-full h-12 md:h-14 bg-zinc-900/85 border border-zinc-700 text-white rounded-2xl pl-11 pr-4 text-sm md:text-base outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 shadow-lg shadow-black/20"
                />
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="text-center py-20 bg-zinc-900/70 rounded-[40px] border border-zinc-700/60">
                <p className="text-2xl text-zinc-400 font-black">No hay alumnos que coincidan con la búsqueda.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 content-start auto-rows-max overflow-hidden">
                {filteredStudents.map((s) => {
                  const initial = s.first_name ? s.first_name[0].toUpperCase() : '?'
                  const isMarkedToday = todayMarkedIds.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => markAttendance(s.id, `${s.first_name} ${s.last_name}`)}
                      className={`relative rounded-2xl md:rounded-3xl p-3 md:p-4 flex flex-col items-center justify-center gap-2 md:gap-3 transition-all group active:scale-95 shadow-xl border min-h-[150px] ${
                        isMarkedToday
                          ? 'bg-emerald-800/80 border-emerald-400 hover:bg-emerald-700'
                          : 'bg-zinc-900/85 border-zinc-700 hover:bg-fuchsia-700 hover:border-fuchsia-400'
                      }`}
                    >
                      {isMarkedToday && (
                        <div className="absolute top-2 right-2 bg-amber-400 text-zinc-900 text-[9px] font-black uppercase px-2 py-1 rounded-full border border-amber-300 flex items-center gap-1 shadow-md">
                          <span className="w-3.5 h-3.5 rounded-full bg-zinc-900 text-amber-300 flex items-center justify-center text-[10px] leading-none">
                            {'\u2713'}
                          </span>
                          <span>Asistencia</span>
                        </div>
                      )}
                      <div
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-2xl md:text-3xl font-black transition-colors overflow-hidden border-2 ${
                          isMarkedToday
                            ? 'bg-emerald-600 text-white border-emerald-300'
                            : 'bg-zinc-700 text-zinc-300 border-transparent group-hover:bg-fuchsia-500 group-hover:text-white group-hover:border-white'
                        }`}
                      >
                        {s.photo_url ? (
                          <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" alt="" />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className="text-center">
                        <div className="text-base md:text-lg font-black text-white line-clamp-1">{s.first_name}</div>
                        <div
                          className={`text-xs md:text-sm font-medium line-clamp-1 ${
                            isMarkedToday ? 'text-emerald-100' : 'text-zinc-400 group-hover:text-fuchsia-100'
                          }`}
                        >
                          {s.last_name}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Exit Security Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-[40px] p-10 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => {
                setShowExitModal(false)
                setExitPin('')
                setExitError('')
              }}
              className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
            >
              <HiOutlineX size={24} />
            </button>

            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-fuchsia-500/10 text-fuchsia-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <HiOutlineLockClosed size={40} />
              </div>
              <h3 className="text-2xl font-black text-white">Salir del Kiosko</h3>
              <p className="text-zinc-400 text-sm mt-2">
                Ingresa el PIN de seguridad o tu contrase{'\u00f1'}a de administrador para volver al panel.
              </p>
            </div>

            <form onSubmit={handleExitSubmit} className="space-y-6">
              <input
                type="password"
                autoFocus
                className="w-full px-6 py-5 bg-zinc-800 border-2 border-zinc-700 focus:border-fuchsia-500 focus:bg-zinc-900 rounded-2xl text-center text-3xl tracking-[0.3em] font-black text-white outline-none transition-all placeholder:text-zinc-600"
                placeholder="****"
                value={exitPin}
                onChange={(e) => setExitPin(e.target.value)}
                disabled={isVerifying}
              />
              {exitError && (
                <div className="text-center text-fuchsia-300 font-bold text-sm bg-fuchsia-500/10 py-3 rounded-xl">
                  {exitError}
                </div>
              )}
              <button
                type="submit"
                disabled={isVerifying || !exitPin.trim()}
                className="w-full py-5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50 active:scale-95"
              >
                {isVerifying ? 'Verificando...' : 'Desbloquear'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}




