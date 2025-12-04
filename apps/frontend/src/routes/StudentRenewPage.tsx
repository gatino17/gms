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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                Renovar Curso
              </h1>
              <div className="text-sm/relaxed opacity-90">
                {studentName} — {course?.name}
              </div>
            </div>
            <button
              onClick={() => navigate(`/students/${studentId}`)}
              className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-white/10 hover:bg-white/20"
            >
              Volver
            </button>
          </div>
        </div>
      </div>

      {/* Información del periodo anterior */}
      {enrollment && (
        <div className="p-4 rounded-xl border bg-gradient-to-b from-blue-50 to-white">
          <div className="text-sm font-semibold text-gray-700 mb-2">Periodo anterior</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Inicio:</span>{' '}
              <span className="font-medium">{enrollment.start_date ? ymdToCL(enrollment.start_date) : '—'}</span>
            </div>
            <div>
              <span className="text-gray-600">Fin:</span>{' '}
              <span className="font-medium">{enrollment.end_date ? ymdToCL(enrollment.end_date) : '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de clases fuera de plan */}
      {showOutOfPlanOptions && outOfPlanDates.length > 0 && (
        <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-amber-900 text-lg">Clases fuera de plan detectadas</div>
              <div className="text-sm text-amber-800 mt-2">
                El alumno asistió en {outOfPlanDates.length} fecha(s) después del periodo anterior:
                <div className="mt-2 flex flex-wrap gap-2">
                  {outOfPlanDates.map(d => (
                    <span key={d} className="px-3 py-1 rounded-lg bg-amber-200 text-sm font-medium">
                      {ymdToCL(d)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 bg-white hover:bg-gray-50 transition">
                  <input
                    type="radio"
                    name="outOfPlanOption"
                    value="convert"
                    checked={outOfPlanOption === 'convert'}
                    onChange={() => setOutOfPlanOption('convert')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Opción A: Convertir a clases sueltas</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Se crearán pagos individuales por cada una de estas asistencias, tratándolas como clases sueltas.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 bg-white hover:bg-gray-50 transition">
                  <input
                    type="radio"
                    name="outOfPlanOption"
                    value="adjust"
                    checked={outOfPlanOption === 'adjust'}
                    onChange={() => setOutOfPlanOption('adjust')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Opción B: Ajustar periodo hacia atrás</div>
                    <div className="text-sm text-gray-600 mt-1">
                      El nuevo periodo iniciará desde <strong>{ymdToCL(outOfPlanDates.sort()[0])}</strong> para cubrir estas fechas.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de renovación */}
      <div className="p-6 rounded-2xl border bg-white space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Modo de renovación</label>
          <select
            className="w-full md:w-64 border rounded-lg px-4 py-2.5 text-base"
            value={renewMode}
            onChange={e => {
              setRenewMode(e.target.value as any)
              setPayAmount('')
              setPayReference('')
            }}
          >
            <option value="monthly">Mensual (4 clases / 1 por semana)</option>
            <option value="single_class">Clase suelta</option>
          </select>
        </div>

        {renewMode === 'monthly' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de inicio</label>
              <input
                type="date"
                className="w-full border rounded-lg px-4 py-2.5"
                value={renewStartDate}
                onChange={e => setRenewStartDate(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Sugerido: próximo día de semana del curso después del periodo anterior
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de fin (4ta ocurrencia)</label>
              <input
                type="date"
                className="w-full border rounded-lg px-4 py-2.5 bg-gray-50"
                value={computedEndDate}
                readOnly
              />
              <p className="text-xs text-gray-500 mt-1">
                Calculado automáticamente (+3 semanas desde el inicio)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de la clase</label>
              <input
                type="date"
                className="w-full md:w-80 border rounded-lg px-4 py-2.5"
                value={singleDate}
                onChange={e => setSingleDate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={markAttendance}
                onChange={e => setMarkAttendance(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="text-sm text-gray-700">Marcar asistencia automáticamente</span>
            </label>
          </div>
        )}

        <div className="border-t pt-6">
          <div className="text-sm font-medium text-gray-700 mb-4">Información de pago</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto {renewMode === 'monthly' ? '(mensual)' : '(clase suelta)'}
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-4 py-2.5"
                placeholder={renewMode === 'monthly'
                  ? (course?.price_monthly ? fmtCLP.format(course.price_monthly) : 'Ej: 25000')
                  : (course?.price_single ? fmtCLP.format(course.price_single) : 'Ej: 5000')}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
              <select
                className="w-full border rounded-lg px-4 py-2.5"
                value={payMethod}
                onChange={e => setPayMethod(e.target.value)}
              >
                <option value="efectivo">Efectivo</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Referencia (opcional)</label>
              <input
                type="text"
                className="w-full border rounded-lg px-4 py-2.5"
                placeholder="Ej: Renovacion mensual"
                value={payReference}
                onChange={e => setPayReference(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50">
          <p className="text-rose-800">{error}</p>
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate(`/students/${studentId}`)}
          className="px-6 py-3 rounded-lg border hover:bg-gray-50 transition"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-3 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          disabled={
            saving ||
            (renewMode === 'monthly'
              ? !renewStartDate || (showOutOfPlanOptions && !outOfPlanOption)
              : !singleDate) ||
            !payAmount
          }
        >
          {saving ? 'Guardando...' : 'Guardar y cobrar'}
        </button>
      </div>
    </div>
  )
}
