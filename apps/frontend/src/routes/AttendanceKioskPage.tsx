import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { HiOutlineLockClosed, HiOutlineCheckCircle, HiOutlineUserGroup, HiOutlineX } from 'react-icons/hi'
import { useTenant } from '../lib/tenant'

type KioskCourse = {
  course: { id: number; name: string; level?: string }
  teacher?: { name?: string | null } | null
  students: {
    id: number;
    first_name: string;
    last_name: string;
    photo_url?: string | null;
  }[]
}

export default function AttendanceKioskPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  
  const [courses, setCourses] = useState<KioskCourse[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedCourse, setSelectedCourse] = useState<KioskCourse | null>(null)
  
  // Security Modal
  const [showExitModal, setShowExitModal] = useState(false)
  const [exitPin, setExitPin] = useState('')
  const [exitError, setExitError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  
  // Success feedback
  const [successMsg, setSuccessMsg] = useState<{ studentName: string; courseName: string } | null>(null)

  useEffect(() => {
    loadTodayCourses()
  }, [tenantId])

  const loadTodayCourses = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      // get today's day of week (1=Mon, 7=Sun)
      const d = new Date().getDay()
      const dayOfWeek = d === 0 ? 7 : d
      
      const { data } = await api.get<KioskCourse[]>('/api/pms/course_status', { 
        params: { day_of_week: dayOfWeek },
        headers: { 'X-Tenant-ID': tenantId }
      })
      setCourses(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const markAttendance = async (studentId: number, studentName: string) => {
    if (!selectedCourse || !tenantId) return
    try {
      await api.post('/api/pms/attendance', {
        student_id: studentId,
        course_id: selectedCourse.course.id
      }, {
        headers: { 'X-Tenant-ID': tenantId }
      })
      
      // Show success
      setSuccessMsg({ studentName, courseName: selectedCourse.course.name })
      setSelectedCourse(null) // go back to course list
      
      setTimeout(() => {
        setSuccessMsg(null)
      }, 3000)
    } catch (e) {
      alert("Error al marcar asistencia. Por favor, intenta nuevamente.")
    }
  }

  const handleExitSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!exitPin.trim()) return
    setIsVerifying(true)
    setExitError('')
    try {
      await api.post('/api/pms/tenants/verify_unlock', { code: exitPin }, {
        headers: { 'X-Tenant-ID': tenantId }
      })
      // Success! Go back to dashboard
      navigate('/')
    } catch (err: any) {
      setExitError(err.response?.data?.detail || 'PIN o clave incorrectos')
    } finally {
      setIsVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <p className="text-cyan-500 font-black uppercase tracking-[0.3em] text-sm">Iniciando Modo Asistencia</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      
      {/* Kiosk Header */}
      <header className="h-24 bg-slate-800/50 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-10 sticky top-0 z-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Auto-Asistencia</h1>
          <p className="text-cyan-400 font-bold uppercase tracking-widest text-sm mt-1">Selecciona tu clase para registrarte</p>
        </div>
        <button 
          onClick={() => setShowExitModal(true)}
          className="w-14 h-14 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-slate-700/50"
          title="Salir del Modo Kiosko"
        >
          <HiOutlineLockClosed size={28} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-10 flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Success Overlay */}
        {successMsg && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
            <HiOutlineCheckCircle className="text-emerald-400 text-9xl mb-6 animate-bounce" />
            <h2 className="text-5xl font-black text-white mb-4 text-center">¡Hola {successMsg.studentName}!</h2>
            <p className="text-2xl text-emerald-400 font-bold tracking-widest uppercase">Asistencia Registrada Correctamente</p>
            <p className="text-lg text-slate-400 mt-4">Disfruta tu clase de {successMsg.courseName}</p>
          </div>
        )}

        {/* Step 1: Select Course */}
        {!selectedCourse && !successMsg && (
          <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-500">
            {courses.length === 0 ? (
              <div className="text-center space-y-6">
                <HiOutlineUserGroup className="text-slate-700 mx-auto" size={100} />
                <h2 className="text-3xl font-black text-slate-500">No hay clases programadas para hoy.</h2>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {courses.map((row) => (
                  <button
                    key={row.course.id}
                    onClick={() => setSelectedCourse(row)}
                    className="bg-slate-800 border border-slate-700 rounded-[32px] p-8 text-left hover:bg-slate-700 hover:border-cyan-500/50 transition-all hover:-translate-y-2 group shadow-2xl shadow-black/50 flex flex-col justify-between min-h-[200px]"
                  >
                    <div>
                      <h3 className="text-3xl font-black text-white group-hover:text-cyan-400 transition-colors">{row.course.name}</h3>
                      {row.teacher?.name && (
                        <p className="text-slate-400 text-lg mt-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-500" />
                          Prof: {row.teacher.name}
                        </p>
                      )}
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                      <div className="bg-slate-900/50 px-4 py-2 rounded-xl text-cyan-400 font-bold uppercase tracking-widest text-sm border border-slate-700/50">
                        {row.students.length} Inscritos
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Student */}
        {selectedCourse && !successMsg && (
          <div className="w-full max-w-6xl animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-6 mb-12">
              <button 
                onClick={() => setSelectedCourse(null)}
                className="w-16 h-16 bg-slate-800 hover:bg-slate-700 rounded-2xl flex items-center justify-center text-white text-2xl transition-all shadow-lg border border-slate-700"
              >
                &larr;
              </button>
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight">{selectedCourse.course.name}</h2>
                <p className="text-cyan-400 font-bold uppercase tracking-widest mt-2">¿Cuál es tu nombre?</p>
              </div>
            </div>

            {selectedCourse.students.length === 0 ? (
               <div className="text-center py-20 bg-slate-800/50 rounded-[40px] border border-slate-700/50">
                 <p className="text-2xl text-slate-500 font-black">No hay alumnos inscritos en este curso.</p>
               </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {selectedCourse.students.map(s => {
                  const initial = s.first_name ? s.first_name[0].toUpperCase() : '?'
                  return (
                    <button
                      key={s.id}
                      onClick={() => markAttendance(s.id, `${s.first_name} ${s.last_name}`)}
                      className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-cyan-600 hover:border-cyan-400 transition-all group active:scale-95 shadow-xl"
                    >
                      <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-black text-slate-400 group-hover:bg-cyan-500 group-hover:text-white transition-colors overflow-hidden border-2 border-transparent group-hover:border-white">
                        {s.photo_url ? (
                          <img src={s.photo_url} className="w-full h-full object-cover" alt="" />
                        ) : initial}
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-black text-white group-hover:text-white line-clamp-1">{s.first_name}</div>
                        <div className="text-sm text-slate-400 group-hover:text-cyan-100 font-medium line-clamp-1">{s.last_name}</div>
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-[40px] p-10 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => { setShowExitModal(false); setExitPin(''); setExitError(''); }}
              className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors"
            >
              <HiOutlineX size={24} />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <HiOutlineLockClosed size={40} />
              </div>
              <h3 className="text-2xl font-black text-white">Salir del Kiosko</h3>
              <p className="text-slate-400 text-sm mt-2">Ingresa el PIN de seguridad o tu contraseña de administrador para volver al panel.</p>
            </div>

            <form onSubmit={handleExitSubmit} className="space-y-6">
              <div>
                <input
                  type="password"
                  autoFocus
                  className="w-full px-6 py-5 bg-slate-800 border-2 border-slate-700 focus:border-rose-500 focus:bg-slate-900 rounded-2xl text-center text-3xl tracking-[0.3em] font-black text-white outline-none transition-all placeholder:text-slate-600"
                  placeholder="****"
                  value={exitPin}
                  onChange={e => setExitPin(e.target.value)}
                  disabled={isVerifying}
                />
              </div>
              {exitError && (
                <div className="text-center text-rose-400 font-bold text-sm bg-rose-500/10 py-3 rounded-xl">
                  {exitError}
                </div>
              )}
              <button
                type="submit"
                disabled={isVerifying || !exitPin.trim()}
                className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50 active:scale-95"
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
