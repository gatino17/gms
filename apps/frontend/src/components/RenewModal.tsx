import React, { useEffect, useState } from 'react'
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

// ===================== Props =====================
type RenewModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  studentId: number
  courseId: number
  enrollmentId: number
}

// ===================== Componente =====================
export default function RenewModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  courseId,
  enrollmentId
}: RenewModalProps) {
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

  // Carga inicial
  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setEnrollment(null)
      setCourse(null)
      setStudentName('')
      setRenewMode('monthly')
      setRenewStartDate('')
      setComputedEndDate('')
      setSingleDate('')
      setPayAmount('')
      setPayMethod('efectivo')
      setPayReference('')
      setOutOfPlanDates([])
      setShowOutOfPlanOptions(false)
      setOutOfPlanOption(null)
      setError(null)
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [studentRes, courseRes] = await Promise.all([
          api.get(`/api/pms/students/${studentId}/portal`),
          api.get(`/api/pms/courses/${courseId}`)
        ])

        const student = studentRes.data.student
        setStudentName(`${student.first_name} ${student.last_name}`)

        const enrollments = studentRes.data.enrollments || []
        const enroll = enrollments.find((e: Enrollment) => e.id === Number(enrollmentId))
        if (!enroll) {
          setError('Matrícula no encontrada')
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
        setPayReference('Renovación mensual (4 clases)')

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
        setError(e?.message || 'No se pudo cargar la información')
        setLoading(false)
      }
    }

    load()
  }, [isOpen, studentId, courseId, enrollmentId])

  // Actualizar fechas cuando cambie el modo o fecha de inicio
  useEffect(() => {
    if (renewMode === 'monthly' && renewStartDate) {
      setComputedEndDate(calculate4thOccurrence(renewStartDate))
      if (course?.price_monthly && !payAmount) {
        setPayAmount(String(course.price_monthly))
      }
      if (!payReference) {
        setPayReference('Renovación mensual (4 clases)')
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
          reference: payReference || 'Renovación mensual (4 clases)',
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

      onSuccess()
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar la renovación')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => !saving && onClose()}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header (Gradient) */}
        <div className="bg-gradient-to-br from-fuchsia-600 to-purple-700 px-6 py-5 sm:px-8 sm:py-6 flex-shrink-0 flex items-start justify-between">
          <div className="text-white">
            <h2 className="text-2xl font-black tracking-tight">Renovar Curso</h2>
            <p className="text-fuchsia-100 font-medium mt-1">
              {studentName ? `${studentName} — ${course?.name || ''}` : 'Cargando...'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            disabled={saving}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar space-y-8 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
              <p className="text-xs font-black text-fuchsia-600 uppercase tracking-widest">Cargando datos...</p>
            </div>
          ) : error && !enrollment ? (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex flex-col items-center justify-center py-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-rose-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-rose-800 font-medium text-center">{error}</p>
            </div>
          ) : (
            <>
              {/* Información del periodo anterior */}
              {enrollment && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Periodo Anterior</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100/50">
                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Inicio</span>
                      <span className="font-semibold text-gray-900">{enrollment.start_date ? ymdToCL(enrollment.start_date) : '—'}</span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100/50">
                      <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Fin</span>
                      <span className="font-semibold text-gray-900">{enrollment.end_date ? ymdToCL(enrollment.end_date) : '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerta de clases fuera de plan */}
              {showOutOfPlanOptions && outOfPlanDates.length > 0 && (
                <div className="p-5 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-amber-900 text-lg">Clases fuera de plan detectadas</h4>
                      <p className="text-sm text-amber-800/80 mt-1">
                        El alumno asistió en {outOfPlanDates.length} fecha(s) después del periodo anterior.
                      </p>
                      
                      <div className="mt-3 flex flex-wrap gap-2">
                        {outOfPlanDates.map(d => (
                          <span key={d} className="px-3 py-1.5 rounded-lg bg-amber-200/50 text-amber-900 text-xs font-bold border border-amber-200/50">
                            {ymdToCL(d)}
                          </span>
                        ))}
                      </div>
                      
                      <div className="mt-5 space-y-3">
                        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${outOfPlanOption === 'convert' ? 'bg-white border-amber-400 shadow-md' : 'bg-white/50 border-amber-100 hover:bg-white hover:border-amber-200'}`}>
                          <div className="pt-0.5">
                            <input type="radio" name="outOfPlanOption" value="convert" checked={outOfPlanOption === 'convert'} onChange={() => setOutOfPlanOption('convert')} className="w-4 h-4 text-amber-600 border-amber-300 focus:ring-amber-500" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">Convertir a clases sueltas</div>
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                              Se crearán pagos individuales por cada asistencia extra.
                            </div>
                          </div>
                        </label>
                        
                        <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${outOfPlanOption === 'adjust' ? 'bg-white border-amber-400 shadow-md' : 'bg-white/50 border-amber-100 hover:bg-white hover:border-amber-200'}`}>
                          <div className="pt-0.5">
                            <input type="radio" name="outOfPlanOption" value="adjust" checked={outOfPlanOption === 'adjust'} onChange={() => setOutOfPlanOption('adjust')} className="w-4 h-4 text-amber-600 border-amber-300 focus:ring-amber-500" />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">Ajustar periodo hacia atrás</div>
                            <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                              El nuevo periodo iniciará desde <strong className="text-amber-800">{ymdToCL(outOfPlanDates.sort()[0])}</strong> cubriendo las faltas.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulario principal */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Modo de Renovación</label>
                  <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto self-start">
                    <button 
                      type="button"
                      onClick={() => { setRenewMode('monthly'); setPayAmount(''); setPayReference(''); }}
                      className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${renewMode === 'monthly' ? 'bg-white text-fuchsia-600 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                    >
                      Mensual (4 clases)
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setRenewMode('single_class'); setPayAmount(''); setPayReference(''); }}
                      className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${renewMode === 'single_class' ? 'bg-white text-fuchsia-600 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                    >
                      Clase Suelta
                    </button>
                  </div>
                </div>

                {/* Fechas */}
                {renewMode === 'monthly' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fecha de inicio</label>
                      <input type="date" value={renewStartDate} onChange={e => setRenewStartDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all" />
                      <p className="text-[10px] text-gray-400 font-medium">Próximo día según periodo anterior</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fecha de fin <span className="text-gray-300 font-normal tracking-normal">(4ta clase)</span></label>
                      <input type="date" value={computedEndDate} readOnly className="w-full bg-gray-50/50 border border-transparent rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed" />
                      <p className="text-[10px] text-gray-400 font-medium">Calculado automáticamente (+3 semanas)</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5 md:w-1/2">
                      <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fecha de la clase</label>
                      <input type="date" value={singleDate} onChange={e => setSingleDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all" />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" checked={markAttendance} onChange={e => setMarkAttendance(e.target.checked)} className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded focus:ring-fuchsia-500 focus:ring-offset-1 checked:bg-fuchsia-500 checked:border-fuchsia-500 transition-all cursor-pointer" />
                        <svg className="absolute w-3 h-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Marcar asistencia automáticamente</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Pago */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Información de Pago</div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Monto a Pagar</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-gray-400 font-bold">$</span>
                      </div>
                      <input
                        type="number"
                        placeholder={renewMode === 'monthly' ? (course?.price_monthly ? `${course?.price_monthly}` : '25000') : (course?.price_single ? `${course?.price_single}` : '5000')}
                        value={payAmount}
                        onChange={e => setPayAmount(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Método</label>
                    <div className="relative">
                      <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all cursor-pointer">
                        <option value="efectivo">Efectivo</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="transferencia">Transferencia</option>
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Referencia</label>
                    <input
                      type="text"
                      placeholder="Opcional..."
                      value={payReference}
                      onChange={e => setPayReference(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all"
                    />
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-rose-800 font-medium text-sm">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 sm:px-8 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row items-center justify-end gap-3 flex-shrink-0 rounded-b-3xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 hover:text-gray-900 transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              saving ||
              (renewMode === 'monthly'
                ? !renewStartDate || (showOutOfPlanOptions && !outOfPlanOption)
                : !singleDate) ||
              !payAmount
            }
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-white font-black tracking-wide bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Procesando...
              </>
            ) : (
              <>
                Confirmar Pago
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
