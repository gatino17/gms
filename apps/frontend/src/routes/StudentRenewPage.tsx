import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'

// ===================== Tipos =====================
type Enrollment = {
  id: number
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  course: {
    id: number
    name: string
    level?: string | null
    day_of_week?: number | null
    start_time?: string | null
    end_time?: string | null
    teacher_id?: number | null
  }
}

type CourseInfo = {
  id: number
  name: string
  teacher_name?: string | null
  price_monthly?: number | null
  price_single?: number | null
}

type DayCoding = 'ISO1' | 'MON0'

// ===================== Constantes / Utils =====================
const CL_TZ = 'America/Santiago'

function toYMDInTZ(d: Date, tz = CL_TZ): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(d)
    .reduce<Record<string,string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

function ymdToCL(ymd?: string | null): string {
  if (!ymd) return ''
  const [y,m,d] = ymd.split('-').map(Number)
  const dt = new Date(y, (m||1)-1, d||1)
  return dt.toLocaleDateString('es-CL')
}

function addDays(ymd: string, days: number): string {
  const [y,m,d] = ymd.split('-').map(Number)
  const dt = new Date(y, (m||1)-1, d||1)
  dt.setDate(dt.getDate() + days)
  return toYMDInTZ(dt)
}

function detectDayCoding(enrollments: Enrollment[] | undefined): DayCoding {
  const ds = (enrollments ?? [])
    .map(e => e.course.day_of_week)
    .filter((d): d is number => d !== null && d !== undefined)
  if (!ds.length) return 'MON0'
  const has7 = ds.some(d => d === 7)
  const min = Math.min(...ds)
  const max = Math.max(...ds)
  if (has7 || (min >= 1 && max <= 7)) return 'ISO1'
  return 'MON0'
}

function toUiDayIndex(d: number | null | undefined, mode: DayCoding): number | null {
  if (d === null || d === undefined) return null
  return mode === 'ISO1' ? (d - 1) : d
}

function getNextWeekday(fromYMD: string, targetWeekday: number): string {
  const [y, m, d] = fromYMD.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  const currentWeekday = (dt.getDay() + 6) % 7
  let daysToAdd = targetWeekday - currentWeekday
  if (daysToAdd <= 0) daysToAdd += 7
  dt.setDate(dt.getDate() + daysToAdd)
  return toYMDInTZ(dt)
}

function calculate4thOccurrence(startYMD: string): string {
  return addDays(startYMD, 21)
}

function monthsInRange(startYMD: string, endYMD: string) {
  const out: {year:number; month:number}[] = []
  const [sy, sm] = startYMD.split('-').map(Number)
  const [ey, em] = endYMD.split('-').map(Number)
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    out.push({ year: y, month: m })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

// ===================== Componente =====================
export default function StudentRenewPage() {
  const { id: studentId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const enrollmentId = searchParams.get('enrollment')
  const courseId = searchParams.get('course')

  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [studentName, setStudentName] = useState<string>('')
  
  const [renewMode, setRenewMode] = useState<'monthly'|'single_class'>('monthly')
  const [renewStartDate, setRenewStartDate] = useState<string>('')
  const [computedEndDate, setComputedEndDate] = useState<string>('')
  const [singleDate, setSingleDate] = useState<string>('')
  const [markAttendance, setMarkAttendance] = useState<boolean>(true)
  
  const [payAmount, setPayAmount] = useState<string>('')
  const [payMethod, setPayMethod] = useState<string>('efectivo')
  const [payReference, setPayReference] = useState<string>('')
  
  const [outOfPlanDates, setOutOfPlanDates] = useState<string[]>([])
  const [showOutOfPlanOptions, setShowOutOfPlanOptions] = useState(false)
  const [outOfPlanOption, setOutOfPlanOption] = useState<'convert'|'adjust'|null>(null)
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const fmtCLP = new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' })

  // Carga inicial
  useEffect(() => {
    const load = async () => {
      if (!studentId || !enrollmentId || !courseId) {
        setError('Parametros invalidos')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const [studentRes, courseRes] = await Promise.all([
          api.get(`/api/pms/students/${studentId}/portal`),
          api.get(`/api/pms/courses/${courseId}`)
        ])

        const student = studentRes.data.student
        setStudentName(`${student.first_name} ${student.last_name}`)

        const enrollments = studentRes.data.enrollments || []
        const enroll = enrollments.find((e: Enrollment) => e.id === Number(enrollmentId))
        if (!enroll) {
          setError('Matricula no encontrada')
          setLoading(false)
          return
        }
        setEnrollment(enroll)

        const courseInfo = (courseRes.data as any)?.course ?? (courseRes.data as any)?.item ?? (courseRes.data ?? null)
        if (!courseInfo || typeof courseInfo !== 'object' || courseInfo.id == null) {
          setError('Curso no encontrado')
          setLoading(false)
          return
        }
        setCourse({
          id: courseInfo.id,
          name: courseInfo.name,
          teacher_name: courseInfo.teacher_name ?? null,
          price_monthly: courseInfo.price_monthly ?? null,
          price_single: courseInfo.price_single ?? null,
        })

        // Calcular fechas sugeridas
        const dayCoding = detectDayCoding(enrollments)
        const dayOfWeek = enroll.course.day_of_week
        const uiIdx = toUiDayIndex(dayOfWeek ?? null, dayCoding)
        
        let startDefault = toYMDInTZ(new Date())
        if (enroll.end_date && uiIdx !== null) {
          startDefault = getNextWeekday(enroll.end_date, uiIdx)
        }
        
        setRenewStartDate(startDefault)
        setComputedEndDate(calculate4thOccurrence(startDefault))
        setPayAmount(courseInfo.price_monthly ? String(courseInfo.price_monthly) : '')
        setPayReference('Renovacion mensual (4 clases)')

        // Detectar clases fuera de plan
        if (enroll.end_date && uiIdx !== null) {
          try {
            const prevEnd = enroll.end_date
            const newStart = startDefault
            
            const monthsToCheck = monthsInRange(
              prevEnd.slice(0, 7) + '-01',
              newStart.slice(0, 7) + '-01'
            )
            
            const outOfPlanAttendances: string[] = []
            for (const mm of monthsToCheck) {
              const res = await api.get(`/api/pms/students/${studentId}/attendance_calendar`, {
                params: { year: mm.year, month: mm.month }
              })
              const days = (res.data?.days || []) as { date: string; attended_course_ids?: number[] }[]
              for (const d of days) {
                if (d.date > prevEnd && d.date < newStart && d.attended_course_ids?.includes(Number(courseId))) {
                  outOfPlanAttendances.push(d.date)
                }
              }
            }
            
            if (outOfPlanAttendances.length > 0) {
              setOutOfPlanDates(outOfPlanAttendances)
              setShowOutOfPlanOptions(true)
            }
          } catch (err) {
            console.error('Error detectando clases fuera de plan:', err)
          }
        }

        setLoading(false)
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar la informacion')
        setLoading(false)
      }
    }

    load()
  }, [studentId, enrollmentId, courseId])

  // Actualizar fechas cuando cambie el modo o fecha de inicio
  useEffect(() => {
    if (renewMode === 'monthly' && renewStartDate) {
      setComputedEndDate(calculate4thOccurrence(renewStartDate))
      if (course?.price_monthly && !payAmount) {
        setPayAmount(String(course.price_monthly))
      }
      if (!payReference) {
        setPayReference('Renovacion mensual (4 clases)')
      }
    }
    if (renewMode === 'single_class') {
      if (course?.price_single && !payAmount) {
        setPayAmount(String(course.price_single))
      }
      if (!payReference) {
        setPayReference('Clase suelta')
      }
    }
  }, [renewMode, renewStartDate, course, payAmount, payReference])

  const handleSubmit = async () => {
    try {
      if (!studentId || !enrollmentId || !courseId) return
      setSaving(true)
      setError(null)

      if (renewMode === 'monthly') {
        if (!renewStartDate) throw new Error('Seleccione fecha de inicio')
        
        let finalStartDate = renewStartDate
        let finalEndDate = computedEndDate

        if (showOutOfPlanOptions && outOfPlanDates.length > 0) {
          if (outOfPlanOption === 'convert') {
            for (const dateStr of outOfPlanDates) {
              await api.post('/api/pms/payments', {
                student_id: Number(studentId),
                type: 'single_class',
                method: payMethod,
                amount: Number(payAmount || 0),
                payment_date: dateStr,
                course_id: Number(courseId),
                enrollment_id: Number(enrollmentId),
                reference: 'Clase fuera de plan (convertida)',
              })
            }
          } else if (outOfPlanOption === 'adjust') {
            const earliestDate = outOfPlanDates.sort()[0]
            finalStartDate = earliestDate
            finalEndDate = calculate4thOccurrence(earliestDate)
          } else {
            throw new Error('Debe seleccionar cómo manejar las clases fuera de plan')
          }
        }

        await api.patch(`/api/pms/enrollments/${enrollmentId}`, {
          start_date: finalStartDate,
          end_date: finalEndDate,
        })

        await api.post('/api/pms/payments', {
          student_id: Number(studentId),
          type: 'monthly',
          method: payMethod,
          amount: Number(payAmount || 0),
          payment_date: toYMDInTZ(new Date()),
          course_id: Number(courseId),
          enrollment_id: Number(enrollmentId),
          reference: payReference || 'Renovacion mensual (4 clases)',
        })
      } else {
        if (!singleDate) throw new Error('Seleccione fecha de clase')
        
        await api.post('/api/pms/payments', {
          student_id: Number(studentId),
          type: 'single_class',
          method: payMethod,
          amount: Number(payAmount || 0),
          payment_date: singleDate,
          course_id: Number(courseId),
          enrollment_id: Number(enrollmentId),
          reference: payReference || 'Clase suelta',
        })

        if (markAttendance) {
          await api.post('/api/pms/attendance', {
            student_id: Number(studentId),
            course_id: Number(courseId),
            date: singleDate
          })
        }
      }

      navigate(`/students/${studentId}`)
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar la renovación')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Cargando...</div>
      </div>
    )
  }

  if (error && !enrollment) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border overflow-hidden">
          <div className="bg-gradient-to-r from-rose-500 to-red-600 px-5 py-4 text-white">
            <h1 className="text-xl md:text-2xl font-semibold">Error</h1>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50">
          <p className="text-rose-800">{error}</p>
        </div>
        <button
          onClick={() => navigate(`/students/${studentId}`)}
          className="px-4 py-2 rounded-lg border hover:bg-gray-50"
        >
          Volver
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-10 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-50 rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
               <button onClick={() => navigate(`/students/${studentId}`)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                  <HiOutlineArrowLeft size={18} md:size={20} />
               </button>
               <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Gestión Académica</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">Renovar Curso</h1>
            <p className="text-gray-500 font-medium text-sm md:text-base">
               <span className="text-fuchsia-600 font-black">{studentName}</span> — {course?.name}
            </p>
          </div>
          <button
            onClick={() => navigate(`/students/${studentId}`)}
            className="hidden sm:block px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 border border-gray-100 hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Información del periodo anterior */}
      {enrollment && (
        <div className="bg-fuchsia-50/30 p-5 rounded-[24px] border border-fuchsia-100/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Periodo Anterior</div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Inicio</span>
              <span className="font-black text-gray-700">{enrollment.start_date ? ymdToCL(enrollment.start_date) : '—'}</span>
            </div>
            <div className="w-8 h-px bg-fuchsia-200" />
            <div className="flex flex-col items-center sm:items-start">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Vencimiento</span>
              <span className="font-black text-gray-700">{enrollment.end_date ? ymdToCL(enrollment.end_date) : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de clases fuera de plan */}
      {showOutOfPlanOptions && outOfPlanDates.length > 0 && (
        <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-amber-200 shadow-xl shadow-amber-500/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
               <HiOutlineCalendar size={24} />
            </div>
            <div>
              <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Atención Requerida</div>
              <h3 className="text-lg md:text-xl font-black text-gray-900 leading-tight">Clases fuera de plan detectadas</h3>
            </div>
          </div>
          
          <div className="text-sm text-gray-500 font-medium">
            El alumno asistió en {outOfPlanDates.length} fecha(s) después del periodo anterior:
            <div className="mt-3 flex flex-wrap gap-2">
              {outOfPlanDates.map(d => (
                <span key={d} className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-700 uppercase">
                  {ymdToCL(d)}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group ${outOfPlanOption === 'convert' ? 'border-fuchsia-500 bg-fuchsia-50/30' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="outOfPlanOption"
                  value="convert"
                  checked={outOfPlanOption === 'convert'}
                  onChange={() => setOutOfPlanOption('convert')}
                  className="mt-1 w-5 h-5 accent-fuchsia-600"
                />
                <div className="min-w-0">
                  <div className="font-black text-gray-900 text-sm mb-1">Opción A: Clase Suelta</div>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">Se cobrarán como pagos individuales adicionales al plan mensual.</p>
                </div>
              </div>
            </label>
            <label className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group ${outOfPlanOption === 'adjust' ? 'border-fuchsia-500 bg-fuchsia-50/30' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name="outOfPlanOption"
                  value="adjust"
                  checked={outOfPlanOption === 'adjust'}
                  onChange={() => setOutOfPlanOption('adjust')}
                  className="mt-1 w-5 h-5 accent-fuchsia-600"
                />
                <div className="min-w-0">
                  <div className="font-black text-gray-900 text-sm mb-1">Opción B: Ajustar Inicio</div>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">El nuevo periodo iniciará desde {ymdToCL(outOfPlanDates.sort()[0])}.</p>
                </div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Formulario de renovación */}
      <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm space-y-8 md:space-y-12">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Esquema de Renovación</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {(['monthly', 'single_class'] as const).map(mode => (
                <button 
                  key={mode}
                  onClick={() => {
                    setRenewMode(mode)
                    setPayAmount('')
                    setPayReference('')
                  }}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${renewMode === mode ? 'border-fuchsia-500 bg-fuchsia-50/30' : 'border-gray-50 bg-gray-50 hover:bg-gray-100'}`}
                >
                   <div className="font-black text-gray-900 text-sm mb-1">{mode === 'monthly' ? 'Plan Mensual' : 'Clase Suelta'}</div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{mode === 'monthly' ? '4 Clases / Ciclo' : 'Pago por Asistencia'}</div>
                </button>
             ))}
          </div>
        </div>

        {renewMode === 'monthly' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Inicio</label>
              <input
                type="date"
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                value={renewStartDate}
                onChange={e => setRenewStartDate(e.target.value)}
              />
              <p className="text-[10px] font-bold text-fuchsia-400/70 px-2 italic">
                Sugerido: Próxima clase disponible
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fin del Ciclo</label>
              <input
                type="date"
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-300 border-2 border-transparent outline-none cursor-not-allowed"
                value={computedEndDate}
                readOnly
              />
              <p className="text-[10px] font-bold text-gray-400/70 px-2 italic">
                Cálculo automático (3 semanas)
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de la Clase</label>
              <input
                type="date"
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
              />
            </div>
            <div className="pb-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${markAttendance ? 'bg-fuchsia-600 border-fuchsia-600' : 'border-gray-200 group-hover:border-fuchsia-200'}`}>
                   {markAttendance && <HiOutlineCheckCircle className="text-white" />}
                   <input
                    type="checkbox"
                    checked={markAttendance}
                    onChange={e => setMarkAttendance(e.target.checked)}
                    className="hidden"
                  />
                </div>
                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Asistencia automática</span>
              </label>
            </div>
          </div>
        )}

        <div className="pt-8 border-t border-gray-50">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-6">Detalles del Cobro</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Monto</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-gray-400">$</span>
                <input
                  type="number"
                  className="w-full pl-10 pr-5 py-4 bg-gray-50 rounded-2xl font-black text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="0"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Medio de Pago</label>
              <select
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none appearance-none"
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Glosa / Ref</label>
              <input
                type="text"
                className="w-full px-5 py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="Referencia interna..."
                value={payReference}
                onChange={e => setPayReference(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-600 text-xs font-black uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-6">
          <button
            onClick={() => navigate(`/students/${studentId}`)}
            className="flex-1 sm:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all"
            disabled={saving}
          >
            Volver
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 sm:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all"
            disabled={
              saving ||
              (renewMode === 'monthly'
                ? !renewStartDate || (showOutOfPlanOptions && !outOfPlanOption)
                : !singleDate) ||
              !payAmount
            }
          >
            {saving ? 'Procesando...' : 'Guardar y Finalizar'}
          </button>
        </div>
      </div>
    </div>
  )
}
