import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import { 
  HiOutlineX, 
  HiOutlineSearch, 
  HiOutlinePlus,
  HiOutlineCalendar,
  HiOutlineUserCircle,
  HiOutlineCheckCircle
} from 'react-icons/hi'

type Course = {
  id: number
  name: string
  level?: string | null
  day_of_week?: number | null
  start_time?: string | null
  end_time?: string | null
  teacher_name?: string | null
  price_monthly?: number | null
}

type Props = {
  studentId: number
  studentName: string
  onClose: () => void
  onSuccess: (courseId: number, enrollmentId: number) => void
}

const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

export default function EnrollStudentModal({ studentId, studentName, onClose, onSuccess }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<number[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [coursesRes, studentRes] = await Promise.all([
          api.get('/api/pms/courses'),
          api.get(`/api/pms/students/${studentId}/portal`)
        ])
        setCourses(coursesRes.data.items || [])
        
        // Extract enrolled course IDs
        const enrollments = studentRes.data.enrollments || []
        setEnrolledCourseIds(enrollments.map((e: any) => e.course.id))
      } catch (e) {
        console.error('Error loading data', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentId])

  const filteredCourses = useMemo(() => {
    const q = searchQ.toLowerCase()
    return courses.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.teacher_name || '').toLowerCase().includes(q)
    )
  }, [courses, searchQ])

  const handleEnroll = async (courseId: number) => {
    setEnrolling(true)
    try {
      const { data } = await api.post('/api/pms/enrollments/', {
        student_id: studentId,
        course_id: courseId,
        start_date: new Date().toISOString().split('T')[0]
      })
      onSuccess(courseId, data.id)
    } catch (e: any) {
      alert('Error al inscribir: ' + (e.response?.data?.detail || e.message))
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop - full screen always */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      {/* Scrollable container */}
      <div className="relative overflow-y-auto h-full flex items-start justify-center p-4">
      <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="p-8 border-b border-gray-50 bg-gray-50/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900">Inscribir en Curso</h2>
              <div className="flex items-center gap-2 mt-1">
                <HiOutlineUserCircle size={14} className="text-fuchsia-500" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">{studentName}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
              <HiOutlineX size={24} className="text-gray-400" />
            </button>
          </div>
          
          <div className="mt-6 relative">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar curso por nombre o profesor..." 
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoFocus
              className="w-full pl-12 pr-6 py-4 bg-white rounded-[24px] border-2 border-transparent focus:border-fuchsia-100 shadow-sm font-bold text-gray-700 transition-all outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-fuchsia-50 border-t-fuchsia-600 rounded-full animate-spin" />
              <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest animate-pulse">Cargando cursos...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredCourses.map(c => {
                const isEnrolled = enrolledCourseIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    disabled={enrolling || isEnrolled}
                    onClick={() => handleEnroll(c.id)}
                    className={`p-5 border rounded-[32px] transition-all group text-left flex flex-col justify-between h-full shadow-sm ${isEnrolled ? 'bg-emerald-50/50 border-emerald-100 cursor-not-allowed' : 'bg-white border-gray-100 hover:shadow-md hover:border-fuchsia-200 hover:bg-fuchsia-50/30'}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black transition-transform ${isEnrolled ? 'bg-emerald-100 text-emerald-600' : 'bg-fuchsia-100 text-fuchsia-600 group-hover:scale-110'}`}>
                          {c.name[0]}
                        </div>
                        {isEnrolled ? (
                          <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 text-[8px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                             <HiOutlineCheckCircle size={12} /> Ya inscrito
                          </div>
                        ) : (
                          <div className="p-2 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-fuchsia-600 group-hover:text-white transition-all">
                             <HiOutlinePlus size={18} />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className={`font-black transition-colors ${isEnrolled ? 'text-gray-400' : 'text-gray-900 group-hover:text-fuchsia-600'}`}>{c.name}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{c.teacher_name || 'Sin profesor'}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-4 text-gray-500">
                      <div className="flex items-center gap-1">
                        <HiOutlineCalendar size={14} className={isEnrolled ? 'text-gray-300' : 'text-fuchsia-400'} />
                        <span className="text-[10px] font-black uppercase">{c.day_of_week ? DAYS[c.day_of_week % 7] : '-'}</span>
                      </div>
                      {c.start_time && (
                        <span className="text-[10px] font-black">{c.start_time.slice(0, 5)}</span>
                      )}
                    </div>
                  </button>
                )
              })}
              {filteredCourses.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase text-[10px] tracking-widest italic">
                  No se encontraron cursos
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 text-center">
          <button onClick={onClose} className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] hover:text-gray-600 transition-colors">Cancelar</button>
        </div>
      </div>
      </div>
    </div>
  )
}
