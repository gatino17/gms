import { useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import { Link, useNavigate } from 'react-router-dom'
import { MdEmail, MdClose } from 'react-icons/md'
import { FaWhatsapp, FaBirthdayCake } from 'react-icons/fa'
import { useTenant } from '../lib/tenant'
import CourseStatusByGenderPage from '../routes/CourseStatusByGenderPage'

type CourseRow = {
  course: { id: number; name: string; level?: string; start_date?: string | null; price?: number | null; classes_per_week?: number | null }
  teacher?: { id: number | null; name?: string | null } | null
  counts?: { total: number; female: number; male: number }
  students: {
    id: number;
    photo_url?: string | null;
    first_name: string;
    last_name: string;
    email?: string | null;
    email_ok?: boolean;
    gender?: string | null;
    phone?: string | null;
    enrolled_since?: string | null;
    renewal_date?: string | null;
    notes?: string | null;
    payment_status?: 'activo' | 'pendiente';
    attendance_count?: number;
    birthday_today?: boolean;
  }[]
}

export default function CourseStatusPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const [data, setData] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courseQ, setCourseQ] = useState('')
  const [studentQ, setStudentQ] = useState('')
  const [day, setDay] = useState<string>('') // '' = todos; 0..6 especificos
  const [teacherQ, setTeacherQ] = useState('')
  const [attendanceDays, setAttendanceDays] = useState<string>('30')
  const [sortBy, setSortBy] = useState<'none' | 'att_desc' | 'att_asc'>('none')

  // Modal de renovacion
  const [showRenew, setShowRenew] = useState(false)
  const [renewForm, setRenewForm] = useState({
    course_id: 0,
    student_id: 0,
    enrollment_id: 0,
    mode: "monthly" as "monthly" | "custom",
    start_date: "",
    end_date: "",
    amount: "",
    method: "cash" as "cash" | "card" | "transfer" | "agreement",
  })
  const [renewSaving, setRenewSaving] = useState(false)
  const [renewError, setRenewError] = useState<string | null>(null)
 
  function addDays(ymd: string, days: number): string {
    if (!ymd) return ""
    const [y, m, d] = ymd.split("-").map(Number)
    const dt = new Date(y, (m || 1) - 1, d || 1)
    dt.setDate(dt.getDate() + days)
    const yy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, "0")
    const dd = String(dt.getDate()).padStart(2, "0")
    return `${yy}-${mm}-${dd}`
  }
  const fmtDisplayDate = (iso?: string | null) => {
    if (!iso) return "-"
    const parts = iso.split("-")
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return iso
  }

  async function openRenew(courseId: number, studentId: number, start: string, end: string, price?: number | null) {
    try {
      setRenewError(null)
      const res = await api.get('/api/pms/enrollments', { params: { course_id: courseId, student_id: studentId, active_only: true } })
      const enr = (res.data || [])[0]
      const start_date = start || (enr?.start_date || '')
      const end_date = end || (enr?.end_date || '')
      setRenewForm({
        course_id: courseId,
        student_id: studentId,
        enrollment_id: enr?.id || 0,
        mode: 'monthly',
        start_date,
        end_date: end_date || (start_date ? addDays(start_date, 28) : ''),
        amount: price != null ? String(Number(price)) : '',
        method: 'cash',
      })
      setShowRenew(true)
    } catch (e: any) {
      setRenewError(e?.message || 'No se pudo cargar inscripcion')
      setShowRenew(true)
    }
  }

  const load = async () => {
    if (tenantId == null) { setError('Seleccione un tenant'); return }
    setLoading(true)
    setError(null)
    try {
      const params: any = {}
      if (courseQ) params.course_q = courseQ
      if (studentQ) params.student_q = studentQ
      if (day !== '') params.day_of_week = Number(day)
      if (teacherQ) params.teacher_q = teacherQ
      if (attendanceDays) params.attendance_days = Number(attendanceDays)
      const res = await api.get('/api/pms/course_status', { params })
      setData(res.data)
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando estado de cursos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  // Busqueda rapida por curso/alumno con debounce ligero
  useEffect(() => {
    const id = setTimeout(() => { load() }, 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseQ, studentQ])

  // ====== Crear alumno rapido (estados y handlers) ======
  const DEFAULT_MONTHLY = 25000
  const DEFAULT_SINGLE = 7000

  const [showCreate, setShowCreate] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string|null>(null)
  const [createCourseName, setCreateCourseName] = useState<string>('')
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
    joined_at: '',
    notes: '',
  })
  const [createEnroll, setCreateEnroll] = useState({
    courseId: 0,
    start: '',
    end: '',
    planType: 'monthly' as 'monthly'|'single_class',
    lessonsPerWeek: '1' as '1'|'2',
    amount: '' as string,
    method: '' as ''|'cash'|'card'|'transfer'|'agreement',
  })

  function todayISO() { return new Date().toISOString().slice(0,10) }
  function computeEndDate(startISO?: string, planType?: 'monthly'|'single_class', lessonsPerWeek?: '1'|'2'){
    if (!startISO) return ''
    if (planType === 'single_class') return startISO
    const perWeek = Number(lessonsPerWeek || '1')
    const weeks = Math.max(1, Math.ceil(4 / perWeek))
    const d = new Date(startISO)
    const end = new Date(d.getTime())
    end.setDate(end.getDate() + (weeks-1)*7)
    return end.toISOString().slice(0,10)
  }

  function openCreate(courseId:number, courseName:string){
    setCreateError(null)
    const start = todayISO()
    const planType: 'monthly'|'single_class' = 'monthly'
    const lessonsPerWeek: '1'|'2' = '1'
    setCreateCourseName(courseName)
    setCreateForm({ first_name:'', last_name:'', email:'', phone:'', gender:'', joined_at: start, notes:'' })
    setCreateEnroll({
      courseId,
      start,
      end: computeEndDate(start, planType, lessonsPerWeek),
      planType,
      lessonsPerWeek,
      amount: String(DEFAULT_MONTHLY),
      method: ''
    })
    setShowCreate(true)
  }

  async function saveCreate(){
    setCreateSaving(true)
    setCreateError(null)
    try{
      const payload:any = {
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        gender: createForm.gender || undefined,
        joined_at: createForm.joined_at || undefined,
        is_active: true,
        notes: createForm.notes || undefined,
      }
      const res = await api.post('/api/pms/students', payload)
      const studentId = res.data?.id
      if (!studentId) throw new Error('No se obtuvo ID de alumno')

      const ePayload:any = {
        student_id: studentId,
        course_id: Number(createEnroll.courseId),
        start_date: createEnroll.start || undefined,
        end_date: createEnroll.planType === 'single_class' ? createEnroll.start : (createEnroll.end || undefined),
      }
      await api.post('/api/pms/enrollments', ePayload)

      const amount = Number(createEnroll.amount || '0')
      if (createEnroll.method && Number.isFinite(amount) && amount > 0) {
        await api.post('/api/pms/payments', {
          student_id: studentId,
          course_id: Number(createEnroll.courseId),
          amount,
          payment_date: todayISO(),
          method: createEnroll.method,
          type: createEnroll.planType === 'single_class' ? 'single_class' : 'monthly',
          notes: createEnroll.planType === 'single_class' ? 'Clase suelta' : 'Mensualidad'
        })
      }

      setShowCreate(false)
      // Solo refrescar la tabla de cursos; no aplicar busquedas adicionales
      await load()
    }catch(e:any){
      setCreateError(e?.response?.data?.detail || e?.message || 'Error al crear alumno')
    }finally{
      setCreateSaving(false)
    }
  }

  // Agrupar por dia de la semana del curso (0=Lun..6=Dom). Los sin dia van al final.
  const dayNames = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']
  const groups = (() => {
    const map = new Map<number | 'nd', { key: number | 'nd'; label: string; items: CourseRow[] }>()
    for (const row of data) {
      // @ts-ignore
      const d: number | undefined = (row as any).course?.day_of_week
      const key = (d ?? 'nd') as number | 'nd'
      if (!map.has(key)) {
        const label = typeof d === 'number' && d >= 0 && d <= 6 ? dayNames[d] : 'Sin dia asignado'
        map.set(key, { key, label, items: [] })
      }
      map.get(key)!.items.push(row)
    }
    const ordered = Array.from(map.values()).sort((a, b) => {
      const av = a.key === 'nd' ? 99 : (a.key as number)
      const bv = b.key === 'nd' ? 99 : (b.key as number)
      return av - bv
    })
    return ordered
  })()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-fuchsia-600 to-purple-600 text-transparent bg-clip-text">
          Estado de cursos
        </h1>
        <p className="text-sm text-gray-600">
          Vista general por curso, con filtros y asistencia.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            to="/course-status"
            className="px-3 py-1.5 rounded-lg border border-fuchsia-200 bg-white text-sm text-fuchsia-700 shadow-sm"
          >
            Por curso (actual)
          </Link>
          <Link
            to="/course-status-gender"
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 hover:border-fuchsia-200 hover:text-fuchsia-700"
          >
            Por genero
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border bg-white p-3 md:p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-start">
          <input
            className="border rounded-lg px-3 py-2 w-full sm:w-64 lg:w-72 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
            placeholder="Buscar por curso"
            value={courseQ}
            onChange={(e) => setCourseQ(e.target.value)}
          />
          <input
            className="border rounded-lg px-3 py-2 w-full sm:w-64 lg:w-72 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
            placeholder="Buscar por alumno (nombre o email)"
            value={studentQ}
            onChange={(e) => setStudentQ(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-lg px-3 py-2"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              title="Día"
            >
              <option value="">Todos los días</option>
              <option value="0">Lunes</option>
              <option value="1">Martes</option>
              <option value="2">Miércoles</option>
              <option value="3">Jueves</option>
              <option value="4">Viernes</option>
              <option value="5">Sábado</option>
              <option value="6">Domingo</option>
            </select>
            <select
              className="border rounded-lg px-3 py-2"
              value={attendanceDays}
              onChange={(e) => setAttendanceDays(e.target.value)}
              title="Ventana asistencia"
            >
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
            </select>
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Profesor"
              value={teacherQ}
              onChange={(e) => setTeacherQ(e.target.value)}
            />
            <button
              className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow-sm"
              onClick={load}
            >
              Buscar
            </button>
            <select
              className="border rounded-lg px-3 py-2"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              title="Orden"
            >
              <option value="none">Sin ordenar</option>
              <option value="att_desc">Asistencia (desc)</option>
              <option value="att_asc">Asistencia (asc)</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data.length === 0 && (
        <div className="text-gray-600">No hay resultados</div>
      )}

      <div className="space-y-8">
        {groups.map((g) => (
          <div key={String(g.key)}>
            <div className="flex items-center gap-3 my-2">
              <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                {g.label} - {g.items.length}{' '}
                {g.items.length === 1 ? 'curso' : 'cursos'}
              </div>
              <div className="flex-1 border-t border-fuchsia-200/60" />
            </div>

            <div className="space-y-4">
              {g.items.map((row) => {
                const expectedAttendance = Math.max(
                  1,
                  ((row.course as any).classes_per_week ?? 1) * 4,
                )

                const cmp = (a: any, b: any) => {
                  const av = a.attendance_count ?? 0
                  const bv = b.attendance_count ?? 0
                  if (sortBy === 'att_desc') return bv - av
                  if (sortBy === 'att_asc') return av - bv
                  return 0
                }

                const studentsSorted = [...row.students].sort(cmp)

                const counts =
                  row.counts ??
                  studentsSorted.reduce(
                    (acc, s) => {
                      acc.total += 1
                      const g = (s.gender ?? '').trim().toLowerCase()
                      if (g.startsWith('f') || g.startsWith('muj'))
                        acc.female += 1
                      else if (g.startsWith('m') && !g.startsWith('muj'))
                        acc.male += 1
                      return acc
                    },
                    { total: 0, female: 0, male: 0 },
                  )

                return (
                  <div
                    key={row.course.id}
                    className="rounded-2xl border border-fuchsia-200/60 bg-gradient-to-br from-white via-fuchsia-50 to-purple-50 overflow-hidden shadow-sm hover:shadow-md hover:ring-1 hover:ring-fuchsia-300 transition"
                  >
                    {/* HEADER DEL CURSO, DISTRIBUIDO UNIFORME */}
                    <div className="p-4 bg-gradient-to-r from-fuchsia-100 via-pink-100 to-purple-100 border-b border-fuchsia-200/60 grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-center md:text-left">
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {row.course.name}
                        </div>
                        <div className="text-sm text-gray-700">
                          Nivel: {row.course.level ?? '-'}
                        </div>
                      </div>
                      <div className="text-sm text-gray-800">
                        Profesor:{' '}
                        <span className="font-medium">
                          {row.teacher?.name ?? '-'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800">
                        Inicio:{' '}
                        <span className="font-medium">
                          {fmtDisplayDate(row.course.start_date)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800">
                        Valor:{' '}
                        <span className="font-medium">
                          {row.course.price !== null &&
                          row.course.price !== undefined &&
                          String(row.course.price) !== '' &&
                          !isNaN(Number(row.course.price))
                            ? new Intl.NumberFormat('es-CL', {
                                style: 'currency',
                                currency: 'CLP',
                              }).format(Number(row.course.price))
                            : '-'}
                        </span>
                      </div>
                      <div className="md:text-right">
                        <button
                          onClick={() =>
                            openCreate(row.course.id, row.course.name)
                          }
                          className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow-sm w-full md:w-auto"
                        >
                          Inscribir alumno
                        </button>
                      </div>

                      <div className="md:col-span-5 mt-2 flex flex-wrap justify-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full bg-white border border-fuchsia-200 text-gray-700">
                          Alumnos: {counts.total}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-white border text-pink-700 border-pink-200">
                          Mujeres: {counts.female}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-white border text-blue-700 border-blue-200">
                          Hombres: {counts.male}
                        </span>
                      </div>
                    </div>

                    {/* TABLA 100% ANCHO */}
                    <div className="p-4">
                      {row.students.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-gray-600 mb-3">
                            Sin alumnos inscritos
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                                <th className="px-3 py-2 text-center">#</th>
                                <th className="px-3 py-2 text-left">Alumno</th>
                                <th className="px-3 py-2 text-center">
                                  Teléfono
                                </th>
                                <th className="px-3 py-2 text-center">
                                  Email
                                </th>
                                <th className="px-3 py-2 text-center">
                                  Inicio
                                </th>
                                <th className="px-3 py-2 text-center">
                                  Renovación
                                </th>
                                <th className="px-3 py-2 text-center">Pago</th>
                                <th className="px-2 py-2 text-center">
                                  Asist.
                                </th>
                                <th className="px-2.5 py-2 text-center">
                                  Renovar
                                </th>
                                <th className="px-3 py-2 text-center">
                                  Acciones
                                </th>
                                <th className="px-3 py-2 text-left">Obs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {studentsSorted.map((s, idx) => {
                                const EmailIcon = MdEmail
                                const phoneTitle =
                                  s.phone ?? 'Sin teléfono'
                                const emailTitle = s.email ?? 'Sin correo'
                                const paid = s.payment_status === 'activo'
                                const att = s.attendance_count ?? 0
                                const attPct = Math.min(
                                  100,
                                  Math.round(
                                    (att / expectedAttendance) * 100,
                                  ),
                                )
                                const over = att > expectedAttendance
                                const isSingleClass =
                                  !!(
                                    s.enrolled_since &&
                                    s.renewal_date &&
                                    s.enrolled_since === s.renewal_date
                                  )

                                return (
                                  <tr
                                    key={s.id}
                                    className={`border-t hover:bg-fuchsia-50/40 ${
                                      isSingleClass ? 'bg-yellow-50' : ''
                                    }`}
                                    title={
                                      isSingleClass
                                        ? 'Clase suelta'
                                        : undefined
                                    }
                                  >
                                    <td className="px-3 py-2 text-center">
                                      {idx + 1}
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 text-gray-700 grid place-items-center text-xs font-semibold">
                                          {s.photo_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              src={toAbsoluteUrl(s.photo_url)}
                                              alt={`${s.first_name} ${s.last_name}`}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span>
                                              {`${s.first_name?.[0] ?? ''}${s.last_name?.[0] ?? ''}`
                                                .trim()
                                                .toUpperCase() || 'A'}
                                            </span>
                                          )}
                                        </div>
                                        {s.birthday_today && (
                                          <span
                                            title="Cumpleanos hoy"
                                            className="text-pink-600"
                                          >
                                            <FaBirthdayCake />
                                          </span>
                                        )}
                                        <span>
                                          {s.first_name} {s.last_name}
                                        </span>
                                        {isSingleClass && (
                                          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                            Clase suelta
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {s.phone ? (
                                        <span
                                          title={phoneTitle}
                                          className="inline-flex items-center justify-center text-green-600"
                                        >
                                          <FaWhatsapp />
                                        </span>
                                      ) : (
                                        <span
                                          title={phoneTitle}
                                          className="inline-flex items-center justify-center text-gray-400"
                                        >
                                          <FaWhatsapp />
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span
                                        title={emailTitle}
                                        className={`inline-flex items-center justify-center ${
                                          s.email_ok
                                            ? 'text-blue-600'
                                            : 'text-gray-400'
                                        }`}
                                      >
                                        <EmailIcon />
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {fmtDisplayDate(s.enrolled_since)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {fmtDisplayDate(s.renewal_date)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span
                                        className={`px-2 py-1 rounded-full text-xs font-semibold border shadow-sm ${
                                          paid
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-rose-50 text-rose-700 border-rose-300'
                                        }`}
                                      >
                                        {paid ? 'Activo' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div
                                        className={`inline-flex flex-col items-center text-[12px] ${
                                          over ? 'text-rose-600 font-semibold' : 'text-gray-700'
                                        }`}
                                        title={
                                          over
                                            ? 'Excedió lo contratado'
                                            : `Asistencias: ${att} de ${expectedAttendance}`
                                        }
                                      >
                                        <span className="font-medium flex items-center gap-1">
                                          {att} / {expectedAttendance}
                                          {over && (
                                            <span className="px-1 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] border border-rose-200">
                                              +extra
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-gray-500">
                                          ({attPct}%)
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        className="px-2 py-1 rounded border text-xs bg-white hover:bg-fuchsia-50 inline-flex items-center justify-center"
                                        onClick={() =>
                                          openRenew(
                                            row.course.id,
                                            s.id,
                                            s.enrolled_since || '',
                                            s.renewal_date || '',
                                            (row.course as any).price ?? null,
                                          )
                                        }
                                      >
                                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white grid place-items-center text-xs font-bold">
                                          $
                                        </span>
                                      </button>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        className="px-3 py-1.5 rounded border text-xs bg-white hover:bg-fuchsia-50"
                                        onClick={() => navigate(`/students/${s.id}`)}
                                      >
                                        Ver
                                      </button>
                                    </td>
                                    <td className="px-3 py-2">
                                      {s.notes ?? '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Crear */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative w-full max-w-xl md:max-w-2xl overflow-hidden rounded-2xl shadow-2xl">
            <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold">
                  Crear alumno
                </h2>
                <button
                  className="rounded-full hover:bg-white/10 px-2 py-1"
                  onClick={() => setShowCreate(false)}
                  aria-label="Cerrar"
                >
                  <MdClose size={20} />
                </button>
              </div>
            </div>
            <div className="bg-white p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Nombre
                  </label>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.first_name}
                    onChange={(e) =>
                      setCreateForm((v) => ({
                        ...v,
                        first_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Apellido
                  </label>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.last_name}
                    onChange={(e) =>
                      setCreateForm((v) => ({
                        ...v,
                        last_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((v) => ({
                        ...v,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Teléfono
                  </label>
                  <input
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((v) => ({
                        ...v,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Género
                  </label>
                  <select
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.gender}
                    onChange={(e) =>
                      setCreateForm((v) => ({
                        ...v,
                        gender: e.target.value,
                      }))
                    }
                  >
                    <option value="">-</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ingreso
                  </label>
                  <input
                    type="date"
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.joined_at}
                    onChange={(e) =>
                      setCreateForm((v) => ({
                        ...v,
                        joined_at: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mt-2">
                <div className="mb-2 text-sm font-semibold text-gray-800">
                  Inscripción
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Curso
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 bg-gray-50"
                      value={createCourseName || String(createEnroll.courseId)}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Plan
                    </label>
                    <select
                      className="w-full border rounded-md px-3 py-2"
                      value={createEnroll.planType}
                      onChange={(e) => {
                        const plan =
                          e.target.value as 'monthly' | 'single_class'
                        setCreateEnroll((v) => ({
                          ...v,
                          planType: plan,
                          lessonsPerWeek:
                            plan === 'single_class' ? '1' : v.lessonsPerWeek,
                          end: computeEndDate(
                            v.start,
                            plan,
                            plan === 'single_class'
                              ? '1'
                              : v.lessonsPerWeek,
                          ),
                          amount:
                            plan === 'single_class'
                              ? String(DEFAULT_SINGLE)
                              : String(DEFAULT_MONTHLY),
                        }))
                      }}
                    >
                      <option value="monthly">Mensualidad</option>
                      <option value="single_class">Clase suelta</option>
                    </select>
                  </div>
                  {createEnroll.planType === 'monthly' && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Clases/semana
                      </label>
                      <select
                        className="w-full border rounded-md px-3 py-2"
                        value={createEnroll.lessonsPerWeek}
                        onChange={(e) => {
                          const l = e.target.value as '1' | '2'
                          setCreateEnroll((v) => ({
                            ...v,
                            lessonsPerWeek: l,
                            end: computeEndDate(
                              v.start,
                              v.planType,
                              l,
                            ),
                          }))
                        }}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Inicio
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2"
                      value={createEnroll.start}
                      onChange={(e) => {
                        const start = e.target.value
                        setCreateEnroll((v) => ({
                          ...v,
                          start,
                          end: computeEndDate(
                            start,
                            v.planType,
                            v.lessonsPerWeek,
                          ),
                        }))
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Fin (auto)
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded-md px-3 py-2"
                      value={
                        createEnroll.planType === 'single_class'
                          ? createEnroll.start
                          : createEnroll.end
                      }
                      onChange={(e) =>
                        setCreateEnroll((v) => ({
                          ...v,
                          end: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Monto
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded-md px-3 py-2"
                      value={createEnroll.amount}
                      onChange={(e) =>
                        setCreateEnroll((v) => ({
                          ...v,
                          amount: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Método de pago
                    </label>
                    <select
                      className="w-full border rounded-md px-3 py-2"
                      value={createEnroll.method}
                      onChange={(e) =>
                        setCreateEnroll((v) => ({
                          ...v,
                          method: e.target.value as any,
                        }))
                      }
                    >
                      <option value="">Sin pago ahora</option>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                      <option value="agreement">Convenio</option>
                    </select>
                  </div>
                </div>
              </div>

              {createError && (
                <div className="text-sm text-red-600">
                  {createError}
                </div>
              )}
            </div>
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-2 border-t">
              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => setShowCreate(false)}
                disabled={createSaving}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 disabled:opacity-60"
                disabled={createSaving}
                onClick={saveCreate}
              >
                {createSaving ? 'Guardando...' : 'Crear e inscribir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Renovación */}
      {showRenew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowRenew(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-[95%] max-w-xl p-4">
            <div className="text-lg font-semibold mb-2">
              Renovar inscripción
            </div>
            {renewError && (
              <div className="text-sm text-rose-700 mb-2">
                {renewError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <div className="text-xs text-gray-600 mb-1">Modo</div>
                <div className="flex items-center gap-3 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={renewForm.mode === 'monthly'}
                      onChange={() =>
                        setRenewForm((f) => ({
                          ...f,
                          mode: 'monthly',
                          end_date: f.start_date
                            ? addDays(f.start_date, 28)
                            : f.end_date,
                        }))
                      }
                    />{' '}
                    Mensual (4 semanas)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="mode"
                      checked={renewForm.mode === 'custom'}
                      onChange={() =>
                        setRenewForm((f) => ({
                          ...f,
                          mode: 'custom',
                        }))
                      }
                    />{' '}
                    Personalizada
                  </label>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Inicio</div>
                <input
                  className="w-full border rounded px-3 py-2"
                  type="date"
                  value={renewForm.start_date}
                  onChange={(e) =>
                    setRenewForm((f) => ({
                      ...f,
                      start_date: e.target.value,
                      end_date:
                        f.mode === 'monthly' && e.target.value
                          ? addDays(e.target.value, 28)
                          : f.end_date,
                    }))
                  }
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Término</div>
                <input
                  className="w-full border rounded px-3 py-2"
                  type="date"
                  value={renewForm.end_date}
                  onChange={(e) =>
                    setRenewForm((f) => ({
                      ...f,
                      end_date: e.target.value,
                    }))
                  }
                  disabled={renewForm.mode === 'monthly'}
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">
                  Precio/Monto
                </div>
                <input
                  className="w-full border rounded px-3 py-2"
                  type="number"
                  min={0}
                  value={renewForm.amount}
                  onChange={(e) =>
                    setRenewForm((f) => ({
                      ...f,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Método</div>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={renewForm.method}
                  onChange={(e) =>
                    setRenewForm((f) => ({
                      ...f,
                      method: e.target.value as any,
                    }))
                  }
                >
                  <option value="cash">Efectivo</option>
                  <option value="debit">Débito</option>
                  <option value="transfer">Transferencia</option>
                  <option value="agreement">Convenio</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border"
                onClick={() => setShowRenew(false)}
                disabled={renewSaving}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-700 hover:to-purple-700 shadow-sm disabled:opacity-60"
                disabled={
                  renewSaving ||
                  !renewForm.enrollment_id ||
                  !renewForm.start_date ||
                  !renewForm.end_date
                }
                onClick={async () => {
                  try {
                    setRenewSaving(true)
                    setRenewError(null)
                    if (!renewForm.enrollment_id) {
                      const res = await api.get(
                        '/api/pms/enrollments',
                        {
                          params: {
                            course_id: renewForm.course_id,
                            student_id: renewForm.student_id,
                            active_only: true,
                          },
                        },
                      )
                      const enr = (res.data || [])[0]
                      if (!enr?.id)
                        throw new Error('Inscripción no encontrada')
                      renewForm.enrollment_id = enr.id
                    }
                    if (
                      !renewForm.start_date ||
                      !renewForm.end_date
                    )
                      throw new Error('Fechas incompletas')
                    await api.put(
                      `/api/pms/enrollments/${renewForm.enrollment_id}`,
                      {
                        start_date: renewForm.start_date,
                        end_date: renewForm.end_date,
                      },
                    )
                    await load()
                    setShowRenew(false)
                  } catch (e: any) {
                    setRenewError(
                      e?.message || 'No se pudo renovar',
                    )
                  } finally {
                    setRenewSaving(false)
                  }
                }}
              >
                {renewSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

