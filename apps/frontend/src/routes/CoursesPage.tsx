import { useEffect, useMemo, useRef, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import {
  HiOutlineClock,
  HiOutlineUser,
  HiOutlineCalendar,
  HiOutlineTag,
  HiOutlinePencil,
  HiOutlineTrash
} from 'react-icons/hi'
import { useTenant } from '../lib/tenant'

type Course = {
  id: number
  name: string
  level?: string
  image_url?: string | null
  course_type?: string | null
  classes_per_week?: number | null
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
  start_date?: string | null
  price?: number | string | null       // mensualidad
  class_price?: number | string | null // por clase
  is_active?: boolean
  teacher_name?: string | null
  room_name?: string | null
  // max_capacity?: number | null
}

/* ===== Helpers UI ===== */
function Badge({ children, tone='indigo'}:{children:React.ReactNode; tone?:'indigo'|'emerald'|'gray'|'fuchsia'}) {
  const tones:any = {
    indigo:  'bg-indigo-100 text-indigo-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    gray:    'bg-gray-200 text-gray-700',
    fuchsia: 'bg-fuchsia-100 text-fuchsia-700',
  }
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${tones[tone]}`}>{children}</span>
}

const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const fmtCLP = (n:number) => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }).format(n)
const hhmm = (t?:string|null) => (t ? String(t).slice(0,5) : '--:--')
const PAGE_SIZE = 24

/* Normaliza precio que puede venir string/number/null */
const hasMoney = (v: unknown) => v !== null && v !== undefined && !Number.isNaN(Number(v))
const money    = (v: unknown) => fmtCLP(Number(v ?? 0))

// Paleta de degradados por profesor (tipo la imagen que muestras)
const TEACHER_GRADS = [
  'from-purple-500 to-pink-500',
  'from-fuchsia-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-red-500',
]

// Hash simple de string → número
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// Decide el fondo de la tarjeta según profesor / estado / idx
function getCourseGradient(c: Course, idx: number): string {
  // Inactivo → gris
  if (c.is_active === false) {
    return 'bg-gradient-to-br from-gray-300 to-gray-500'
  }

  // Si no hay profesor, usa alternancia básica
  if (!c.teacher_name) {
    return idx % 2 === 0
      ? 'bg-gradient-to-br from-purple-500 to-pink-500'
      : 'bg-gradient-to-br from-fuchsia-500 to-violet-500'
  }

  // Con profesor → un degradado “propio”
  const h = hashString(c.teacher_name)
  const grad = TEACHER_GRADS[h % TEACHER_GRADS.length]
  return `bg-gradient-to-br ${grad}`
}



/* ===== Card de Curso ===== */
type CourseCardProps = {
  c: Course
  idx: number
  onEdit: () => void
  onDelete: () => void
  onOpen: () => void
}

function CourseCard({ c, idx, onEdit, onDelete, onOpen }: CourseCardProps) {
  const activo = c.is_active !== false
  const headerGrad = getCourseGradient(c, idx)
  const showMens = hasMoney(c.price)
  const showClass = hasMoney(c.class_price)
  const capacity: number | undefined = (c as any)?.max_capacity ?? undefined

  // Construimos todos los horarios (hasta 5) para mostrarlos como en tu ejemplo
  type Slot = { day: string; time: string }
  const slots: Slot[] = []

  const pushSlot = (
    dow?: number | null,
    st?: string | null,
    et?: string | null
  ) => {
    if (typeof dow === 'number') {
      slots.push({
        day: DAY_NAMES[dow],
        time: `${hhmm(st || undefined)} – ${hhmm(et || undefined)}`,
      })
    }
  }

  pushSlot(c.day_of_week ?? null, c.start_time ?? null, c.end_time ?? null)
  pushSlot(
    (c as any).day_of_week_2 ?? null,
    (c as any).start_time_2 ?? null,
    (c as any).end_time_2 ?? null
  )
  pushSlot(
    (c as any).day_of_week_3 ?? null,
    (c as any).start_time_3 ?? null,
    (c as any).end_time_3 ?? null
  )
  pushSlot(
    (c as any).day_of_week_4 ?? null,
    (c as any).start_time_4 ?? null,
    (c as any).end_time_4 ?? null
  )
  pushSlot(
    (c as any).day_of_week_5 ?? null,
    (c as any).start_time_5 ?? null,
    (c as any).end_time_5 ?? null
  )

  return (
    <div
      className="rounded-2xl bg-white shadow-md hover:shadow-xl overflow-hidden cursor-pointer flex flex-col transition"
      onClick={(e) => {
        const el = e.target as HTMLElement
        if (el && el.closest('button')) return
        onOpen()
      }}
    >
      {/* HEADER: imagen + degradado + título + profe + chips + estado */}
      <div
        className={`relative h-24 md:h-28 ${
          c.image_url ? '' : headerGrad
        }`}
      >
        {c.image_url && (
          <img
            src={toAbsoluteUrl(c.image_url)}
            alt={c.name}
            className="w-full h-full object-cover"
          />
        )}

        {/* overlay para contraste de texto */}
        <div
          className={
            c.image_url
              ? 'absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent'
              : 'absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent'
          }
        />

        <div className="absolute inset-0 flex flex-col justify-between p-3 md:p-4">
          {/* Estado arriba a la derecha */}
          <div className="flex justify-end">
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                activo
                  ? 'bg-emerald-500/90 text-white'
                  : 'bg-gray-500/90 text-white'
              }`}
            >
              {activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          {/* Título, profe y chips abajo */}
          <div>
            <div className="text-base md:text-lg font-semibold text-white drop-shadow-sm line-clamp-1">
              {c.name}
            </div>
            {c.teacher_name && (
              <div className="text-sm text-white/90 line-clamp-1">
                {c.teacher_name}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {!!c.level && (
                <Badge tone="fuchsia">
                  <span className="inline-flex items-center gap-1">
                    <HiOutlineTag /> {c.level}
                  </span>
                </Badge>
              )}
              <Badge tone="indigo">
                {(c.course_type || 'regular').toLowerCase() === 'choreography'
                  ? 'Coreografía'
                  : 'Normal'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* BODY: horarios, info y precios como en la imagen de ejemplo */}
      <div className="p-3 md:p-4 flex flex-col gap-3 text-xs md:text-sm text-gray-700">
        {/* Horarios */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 font-medium text-gray-900">
            <HiOutlineClock className="shrink-0 text-fuchsia-500" />
            <span>Horarios</span>
          </div>

          {slots.length > 0 ? (
            slots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-2 ml-6 text-gray-700"
              >
                <span className="font-medium">{slot.day}</span>
                <span className="text-gray-400">•</span>
                <span>{slot.time}</span>
              </div>
            ))
          ) : (
            <div className="ml-6 text-gray-500 text-xs">
              Sin horario asignado
            </div>
          )}
        </div>

        {/* Info general (instructor, sala, inicio, cupos) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {c.teacher_name && (
            <div className="flex items-center gap-2">
              <HiOutlineUser className="shrink-0 text-fuchsia-500" />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Instructor
                </div>
                <div className="font-medium text-gray-900">
                  {c.teacher_name}
                </div>
              </div>
            </div>
          )}

          {c.room_name && (
            <div className="flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                className="shrink-0 text-fuchsia-500"
              >
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7m0 9.5A2.5 2.5 0 1 1 14.5 9A2.5 2.5 0 0 1 12 11.5"
                />
              </svg>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Sala
                </div>
                <div className="font-medium text-gray-900">
                  {c.room_name}
                </div>
              </div>
            </div>
          )}

          {c.start_date && (
            <div className="flex items-center gap-2">
              <HiOutlineCalendar className="shrink-0 text-fuchsia-500" />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Inicio
                </div>
                <div className="font-medium text-gray-900">
                  {c.start_date}
                </div>
              </div>
            </div>
          )}

          {typeof capacity === 'number' && (
            <div className="flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                className="shrink-0 text-fuchsia-500"
              >
                <path
                  fill="currentColor"
                  d="M16 13a4 4 0 1 0-4-4a4 4 0 0 0 4 4M7 12a3 3 0 1 0-3-3a3 3 0 0 0 3 3m9 2c-3.33 0-10 1.67-10 5v1h14v-1c0-3.33-6.67-5-10-5m-6.5 1C6 15 7.86 15.5 9.06 16.17A6.58 6.58 0 0 0 7 18v1H2v-1c0-1.29 2.14-2.14 4.5-2.5"
                />
              </svg>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">
                  Máximo estudiantes
                </div>
                <div className="font-medium text-gray-900">
                  {capacity}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Precios tipo “cajita rosada” */}
        {(showMens || showClass) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            {showMens && (
              <div className="rounded-2xl bg-fuchsia-50 border border-fuchsia-100 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-fuchsia-500 font-semibold">
                  Mensualidad
                </div>
                <div className="text-base md:text-lg font-bold text-fuchsia-700">
                  {money(c.price)}
                </div>
              </div>
            )}
            {showClass && (
              <div className="rounded-2xl bg-rose-50 border border-rose-100 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-rose-500 font-semibold">
                  Por clase
                </div>
                <div className="text-base md:text-lg font-bold text-rose-700">
                  {money(c.class_price)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            className="px-3 py-1.5 text-xs md:text-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <HiOutlinePencil /> Editar
          </button>
          <button
            className="px-3 py-1.5 text-xs md:text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <HiOutlineTrash /> Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ===== Página ===== */
export default function CoursesPage() {
  const [data, setData] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const { tenantId } = useTenant()
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    level: '',
    image_url: '',
    course_type: 'regular',
    total_classes: '4',
    classes_per_week: '1',
    day_of_week: '',
    start_time: '',
    end_time: '',
    day_of_week_2: '',
    start_time_2: '',
    end_time_2: '',
    day_of_week_3: '',
    start_time_3: '',
    end_time_3: '',
    day_of_week_4: '',
    start_time_4: '',
    end_time_4: '',
    day_of_week_5: '',
    start_time_5: '',
    end_time_5: '',
    start_date: '',
    max_capacity: '',
    price: '',
    class_price: '',
    teacher_id: '',
    room_id: '',
    is_active: true,
  })
  const [teachers, setTeachers] = useState<{id:number; name:string}[]>([])
  const [rooms, setRooms] = useState<{id:number; name:string}[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detail, setDetail] = useState<any | null>(null)

  function addHoursToTime(timeStr: string, hours: number): string {
    if (!timeStr || !/^[0-2]\d:[0-5]\d$/.test(timeStr)) return timeStr
    const [hh, mm] = timeStr.split(':').map(Number)
    const d = new Date()
    d.setHours(hh, mm, 0, 0)
    d.setHours(d.getHours() + hours)
    const nh = d.getHours().toString().padStart(2, '0')
    const nm = d.getMinutes().toString().padStart(2, '0')
    return `${nh}:${nm}`
  }

  // Count occurrences of a weekday (0=Mon..6=Sun) in month of given YYYY-MM-DD
  function countDowInMonth(dateStr: string, dow: number): number {
    try {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0
      const [Y, M] = dateStr.split('-').map(Number)
      const first = new Date(Y, M - 1, 1)
      const last = new Date(Y, M, 0)
      let count = 0
      for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
        const jsDow = d.getDay() // 0=Sun..6=Sat
        const monIndexed = (jsDow + 6) % 7 // 0=Mon..6=Sun
        if (monIndexed === dow) count++
      }
      return count
    } catch { return 0 }
  }

  // Approx weeks in month (4 or 5) via Mondays occurrences
  function weeksInMonth(dateStr: string): number {
    return countDowInMonth(dateStr, 0) || 4
  }

  // Auto update total_classes: always classes_per_week × 4 (4 semanas)
  useEffect(() => {
    const cpw = Number(form.classes_per_week || '1')
    if (!cpw || cpw < 1) return
    const total = cpw * 4
    const next = String(total)
    if (form.total_classes !== next) {
      setForm(f => ({ ...f, total_classes: next }))
    }
  }, [form.classes_per_week]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preview imagen
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile)
      setImagePreview(url)
      return () => URL.revokeObjectURL(url)
    }
    if (form.image_url) {
      setImagePreview(toAbsoluteUrl(form.image_url) || null)
    } else {
      setImagePreview(null)
    }
  }, [imageFile, form.image_url])

  const load = async (append = false) => {
    if (append) { if (loadingMore) return } else if (loading) { return }
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)
    try {
      const params: any = { limit: PAGE_SIZE, offset: append ? data.length : 0 }
      if (q) params.q = q
      const res = await api.get('/api/pms/courses', { params })
      const items: Course[] = res.data?.items ?? []
      const totalCount = res.data?.total != null ? Number(res.data.total) : items.length
      setTotal(totalCount)
      setData((prev) => (append ? [...prev, ...items] : items))
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando cursos')
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [tenantId])

  // Búsqueda debounced
  useEffect(() => {
    const id = setTimeout(() => { load() }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tenantId])

  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [tres, rres] = await Promise.all([
          api.get('/api/pms/teachers'),
          api.get('/api/pms/rooms'),
        ])
        const titems = (tres.data as any)?.items ?? tres.data ?? []
        setTeachers(titems.map((t:any)=>({id:t.id, name:t.name})))
        setRooms((rres.data || []).map((r:any)=>({id:r.id, name:r.name})))
      } catch { /* ignore */ }
    }
    loadRefs()
  }, [tenantId])

  const grouped = useMemo(() => {
    const map = new Map<number | 'nd', { label: string, items: Course[] }>()
    for (const c of data) {
      const d = c.day_of_week
      const key = (typeof d === 'number' ? d : 'nd') as number | 'nd'
      if (!map.has(key)) {
        const label = typeof d === 'number' ? DAY_NAMES[d] : 'Sin día asignado'
        map.set(key, { label, items: [] })
      }
      map.get(key)!.items.push(c)
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const av = a[0] === 'nd' ? 99 : (a[0] as number)
        const bv = b[0] === 'nd' ? 99 : (b[0] as number)
        return av - bv
      })
      .map(([, v]) => v)
  }, [data])
  const canLoadMore = data.length < total

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Cursos</h1>
          <div className="text-sm text-gray-600">Mostrando {data.length} de {(total || data.length)} cursos</div>
        </div>
        <button
          className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
          onClick={() => {
            setEditId(null)
            setSaveError(null)
            setImageFile(null)
            setImageError(null)
            setForm({
              name:'', description:'', level:'', image_url:'', course_type:'regular',
              total_classes:'4', classes_per_week:'1',
              day_of_week:'', start_time:'', end_time:'',
              day_of_week_2:'', start_time_2:'', end_time_2:'',
              day_of_week_3:'', start_time_3:'', end_time_3:'',
              day_of_week_4:'', start_time_4:'', end_time_4:'',
              day_of_week_5:'', start_time_5:'', end_time_5:'',
              start_date:'', max_capacity:'', price:'', class_price:'',
              teacher_id:'', room_id:'', is_active:true
            })
            setShowCreate(true)
          }}
        >+ Agregar</button>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          className="w-full md:max-w-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          placeholder="Buscar curso"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="px-3 py-2 rounded border text-gray-600 hover:bg-gray-50" onClick={() => load(false)}>Buscar</button>
      </div>

      {loading && <div>Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="space-y-7">
          {grouped.map((g, idx) => (
            <div key={idx}>
              <div className="flex items-center gap-3 my-2">
                <div className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  {g.label} — {g.items.length} {g.items.length === 1 ? 'curso' : 'cursos'}
                </div>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 md:gap-3">
                {g.items.map((c, i) => (
                  <CourseCard
                    key={c.id}
                    c={c}
                    idx={i}
                    onOpen={() => { window.location.href = `/courses/${c.id}` }}
                    onEdit={async () => {
                      try {
                        const res = await api.get(`/api/pms/courses/${c.id}`)
                        const x = res.data
                        setForm({
                          name: x.name ?? '',
                          description: x.description ?? '',
                          level: x.level ?? '',
                          image_url: x.image_url ?? '',
                          course_type: x.course_type ?? 'regular',
                          total_classes: x.total_classes == null ? '' : String(x.total_classes),
                          classes_per_week: x.classes_per_week == null ? '' : String(x.classes_per_week),
                          day_of_week: x.day_of_week == null ? '' : String(x.day_of_week),
                          start_time: x.start_time ? String(x.start_time).slice(0,5) : '',
                          end_time: x.end_time ? String(x.end_time).slice(0,5) : '',
                          day_of_week_2: x.day_of_week_2 == null ? '' : String(x.day_of_week_2),
                          start_time_2: x.start_time_2 ? String(x.start_time_2).slice(0,5) : '',
                          end_time_2: x.end_time_2 ? String(x.end_time_2).slice(0,5) : '',
                          day_of_week_3: (x as any).day_of_week_3 == null ? '' : String((x as any).day_of_week_3),
                          start_time_3: (x as any).start_time_3 ? String((x as any).start_time_3).slice(0,5) : '',
                          end_time_3: (x as any).end_time_3 ? String((x as any).end_time_3).slice(0,5) : '',
                          day_of_week_4: (x as any).day_of_week_4 == null ? '' : String((x as any).day_of_week_4),
                          start_time_4: (x as any).start_time_4 ? String((x as any).start_time_4).slice(0,5) : '',
                          end_time_4: (x as any).end_time_4 ? String((x as any).end_time_4).slice(0,5) : '',
                          day_of_week_5: (x as any).day_of_week_5 == null ? '' : String((x as any).day_of_week_5),
                          start_time_5: (x as any).start_time_5 ? String((x as any).start_time_5).slice(0,5) : '',
                          end_time_5: (x as any).end_time_5 ? String((x as any).end_time_5).slice(0,5) : '',
                          start_date: x.start_date ?? '',
                          max_capacity: x.max_capacity == null ? '' : String(x.max_capacity),
                          price: x.price == null ? '' : String(x.price),
                          class_price: x.class_price == null ? '' : String(x.class_price),
                          teacher_id: x.teacher_id == null ? '' : String(x.teacher_id),
                          room_id: x.room_id == null ? '' : String(x.room_id),
                          is_active: !!x.is_active,
                        })
                        setImageFile(null)
                        setImageError(null)
                        setEditId(c.id)
                        setSaveError(null)
                        setShowCreate(true)
                      } catch (e:any) {
                        // Fallback: abrir modal con datos disponibles en la tarjeta
                        setForm({
                          name: c.name ?? '',
                          description: '',
                          level: c.level ?? '',
                          image_url: c.image_url ?? '',
                          course_type: 'regular',
                          total_classes: '4',
                          classes_per_week: '1',
                          day_of_week: (typeof c.day_of_week === 'number') ? String(c.day_of_week) : '',
                          start_time: c.start_time ? String(c.start_time).slice(0,5) : '',
                          end_time: c.end_time ? String(c.end_time).slice(0,5) : '',
                          day_of_week_2: '',
                          start_time_2: '',
                          end_time_2: '',
                          day_of_week_3: '',
                          start_time_3: '',
                          end_time_3: '',
                          day_of_week_4: '',
                          start_time_4: '',
                          end_time_4: '',
                          day_of_week_5: '',
                          start_time_5: '',
                          end_time_5: '',
                          start_date: c.start_date ?? '',
                          max_capacity: '',
                          price: c.price == null ? '' : String(c.price),
                          class_price: c.class_price == null ? '' : String(c.class_price),
                          teacher_id: '',
                          room_id: '',
                          is_active: c.is_active !== false,
                        })
                        setImageFile(null)
                        setImageError(null)
                        setEditId(c.id)
                        setSaveError(e?.response?.data?.detail || 'No se pudo cargar el curso. Puedes editar con datos parciales.')
                        setShowCreate(true)
                      }
                    }}
                    onDelete={async () => {
                      if(!confirm('¿Eliminar curso?')) return
                      try { await api.delete(`/api/pms/courses/${c.id}`); await load() } catch {}
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          {canLoadMore && (
            <div className="flex justify-center">
              <button
                className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
                disabled={loadingMore || loading}
                onClick={() => load(true)}
              >
                {loadingMore ? 'Cargando...' : `Cargar mas (${data.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* (detalle) */}
      {detailOpen && null}

      {/* Modal Crear/Editar */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setShowCreate(false); setEditId(null) }}
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold">
                  {editId ? 'Editar curso' : 'Crear curso'}
                </h2>
                <button
                  className="rounded-full hover:bg-white/10 px-2 py-1"
                  onClick={() => { setShowCreate(false); setEditId(null) }}
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="bg-white px-6 py-5 max-h-[75vh] overflow-y-auto">
              {saveError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {saveError}
                </div>
              )}

              {imageError && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {imageError}
                </div>
              )}

              {/* Sección: Información general */}
              <div className="mb-6 space-y-4">
                <div className="mb-2 text-sm font-semibold text-gray-800">
                  Información general
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Nombre del curso <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.name}
                      onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}
                      placeholder="Ej: Salsa inicio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Nivel / descripción corta
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.level}
                      onChange={(e)=>setForm(f=>({...f, level:e.target.value}))}
                      placeholder="Ej: Principiantes"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Descripción</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200 text-sm"
                    rows={3}
                    value={form.description}
                    onChange={(e)=>setForm(f=>({...f, description:e.target.value}))}
                    placeholder="Detalles del curso, requisitos, etc."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Clases por semana
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.classes_per_week}
                      onChange={(e)=>setForm(f=>({...f, classes_per_week:e.target.value || '1'}))}
                    >
                      <option value="1">1 vez x semana</option>
                      <option value="2">2 veces x semana</option>
                      <option value="3">3 veces x semana</option>
                      <option value="4">4 veces x semana</option>
                      <option value="5">5 veces x semana</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Total clases (mes aprox.)
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600"
                      value={form.total_classes}
                      readOnly
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="text-xs text-gray-500">
                      Se calcula como <strong>clases/semana × 4</strong> semanas.
                    </p>
                  </div>
                </div>

                {/* Imagen */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm text-gray-600 mb-1">Imagen (URL opcional)</label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.image_url}
                      onChange={(e)=>{
                        setForm(f=>({...f, image_url:e.target.value}))
                        if (e.target.value) {
                          setImageFile(null)
                          setImageError(null)
                        }
                      }}
                      placeholder="https://..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                        onClick={()=> fileInputRef.current?.click()}
                      >
                        Subir imagen...
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e)=>{
                          const file = e.target.files?.[0]
                          if(!file){
                            setImageFile(null)
                            return
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            setImageError('La imagen debe pesar menos de 5 MB.')
                            setImageFile(null)
                            return
                          }
                          setImageError(null)
                          setImageFile(file)
                          // si se sube archivo, limpiamos la URL para que no choque
                          setForm(f=>({...f, image_url:''}))
                        }}
                      />
                      {(imageFile || form.image_url) && (
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:underline"
                          onClick={()=>{
                            setImageFile(null)
                            setImagePreview(null)
                            setForm(f=>({...f, image_url:''}))
                          }}
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Puedes usar una URL o subir un archivo. Si subes archivo, se ignora la URL.
                    </p>
                  </div>
                  <div className="flex justify-center md:justify-end">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Vista previa"
                        className="w-24 h-24 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                        Sin imagen
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seccion: Programación */}
              <div className="mb-6">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Programación
                </div>
                <div className="space-y-4">
                  {/* Bloque 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Día</label>
                      <select
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.day_of_week}
                        onChange={(e)=>setForm(f=>({...f, day_of_week:e.target.value}))}
                      >
                        <option value="">Sin día</option>
                        <option value="0">Lunes</option>
                        <option value="1">Martes</option>
                        <option value="2">Miércoles</option>
                        <option value="3">Jueves</option>
                        <option value="4">Viernes</option>
                        <option value="5">Sábado</option>
                        <option value="6">Domingo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Hora inicio</label>
                      <input
                        type="time"
                        step={3600}
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.start_time}
                        onChange={(e)=>setForm(f=>({...f, start_time:e.target.value}))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Hora término</label>
                      <div className="flex gap-2">
                        <input
                          type="time"
                          step={3600}
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.end_time}
                          onChange={(e)=>setForm(f=>({...f, end_time:e.target.value}))}
                        />
                        <button
                          type="button"
                          className="px-2 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                          onClick={()=> setForm(f=>({...f, end_time: addHoursToTime(f.start_time, 1)}))}
                          disabled={!form.start_time}
                          title="Sumar 1 hora desde la hora de inicio"
                        >
                          +1h
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 2 */}
                  {Number(form.classes_per_week || '1') >= 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Día (2do)</label>
                        <select
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.day_of_week_2}
                          onChange={(e)=>setForm(f=>({...f, day_of_week_2:e.target.value}))}
                        >
                          <option value="">--</option>
                          <option value="0">Lunes</option>
                          <option value="1">Martes</option>
                          <option value="2">Miércoles</option>
                          <option value="3">Jueves</option>
                          <option value="4">Viernes</option>
                          <option value="5">Sábado</option>
                          <option value="6">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora inicio (2do)</label>
                        <input
                          type="time"
                          step={3600}
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.start_time_2}
                          onChange={(e)=>setForm(f=>({...f, start_time_2:e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora término (2do)</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            step={3600}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            value={form.end_time_2}
                            onChange={(e)=>setForm(f=>({...f, end_time_2:e.target.value}))}
                          />
                          <button
                            type="button"
                            className="px-2 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            onClick={()=> setForm(f=>({...f, end_time_2: addHoursToTime(f.start_time_2, 1)}))}
                            disabled={!form.start_time_2}
                            title="Sumar 1 hora desde la hora de inicio (2do)"
                          >
                            +1h
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bloque 3 */}
                  {Number(form.classes_per_week || '1') >= 3 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Día (3ro)</label>
                        <select
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.day_of_week_3}
                          onChange={(e)=>setForm(f=>({...f, day_of_week_3:e.target.value}))}
                        >
                          <option value="">--</option>
                          <option value="0">Lunes</option>
                          <option value="1">Martes</option>
                          <option value="2">Miércoles</option>
                          <option value="3">Jueves</option>
                          <option value="4">Viernes</option>
                          <option value="5">Sábado</option>
                          <option value="6">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora inicio (3ro)</label>
                        <input
                          type="time"
                          step={3600}
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.start_time_3}
                          onChange={(e)=>setForm(f=>({...f, start_time_3:e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora término (3ro)</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            step={3600}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            value={form.end_time_3}
                            onChange={(e)=>setForm(f=>({...f, end_time_3:e.target.value}))}
                          />
                          <button
                            type="button"
                            className="px-2 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            onClick={()=> setForm(f=>({...f, end_time_3: addHoursToTime(f.start_time_3, 1)}))}
                            disabled={!form.start_time_3}
                            title="Sumar 1 hora desde la hora de inicio (3ro)"
                          >
                            +1h
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bloque 4 */}
                  {Number(form.classes_per_week || '1') >= 4 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Día (4to)</label>
                        <select
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.day_of_week_4}
                          onChange={(e)=>setForm(f=>({...f, day_of_week_4:e.target.value}))}
                        >
                          <option value="">--</option>
                          <option value="0">Lunes</option>
                          <option value="1">Martes</option>
                          <option value="2">Miércoles</option>
                          <option value="3">Jueves</option>
                          <option value="4">Viernes</option>
                          <option value="5">Sábado</option>
                          <option value="6">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora inicio (4to)</label>
                        <input
                          type="time"
                          step={3600}
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.start_time_4}
                          onChange={(e)=>setForm(f=>({...f, start_time_4:e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora término (4to)</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            step={3600}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            value={form.end_time_4}
                            onChange={(e)=>setForm(f=>({...f, end_time_4:e.target.value}))}
                          />
                          <button
                            type="button"
                            className="px-2 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            onClick={()=> setForm(f=>({...f, end_time_4: addHoursToTime(f.start_time_4, 1)}))}
                            disabled={!form.start_time_4}
                            title="Sumar 1 hora desde la hora de inicio (4to)"
                          >
                            +1h
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bloque 5 */}
                  {Number(form.classes_per_week || '1') >= 5 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Día (5to)</label>
                        <select
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.day_of_week_5}
                          onChange={(e)=>setForm(f=>({...f, day_of_week_5:e.target.value}))}
                        >
                          <option value="">--</option>
                          <option value="0">Lunes</option>
                          <option value="1">Martes</option>
                          <option value="2">Miércoles</option>
                          <option value="3">Jueves</option>
                          <option value="4">Viernes</option>
                          <option value="5">Sábado</option>
                          <option value="6">Domingo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora inicio (5to)</label>
                        <input
                          type="time"
                          step={3600}
                          className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          value={form.start_time_5}
                          onChange={(e)=>setForm(f=>({...f, start_time_5:e.target.value}))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Hora término (5to)</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            step={3600}
                            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            value={form.end_time_5}
                            onChange={(e)=>setForm(f=>({...f, end_time_5:e.target.value}))}
                          />
                          <button
                            type="button"
                            className="px-2 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                            onClick={()=> setForm(f=>({...f, end_time_5: addHoursToTime(f.start_time_5, 1)}))}
                            disabled={!form.start_time_5}
                            title="Sumar 1 hora desde la hora de inicio (5to)"
                          >
                            +1h
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo / inicio / cupo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Tipo de curso</label>
                  <select
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={form.course_type}
                    onChange={(e)=>setForm(f=>({...f, course_type:e.target.value}))}
                  >
                    <option value="regular">Regular</option>
                    <option value="choreography">Coreográfico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Inicio (fecha)</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={form.start_date}
                    onChange={(e)=>setForm(f=>({...f, start_date:e.target.value}))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Cupo máximo</label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    value={form.max_capacity}
                    onChange={(e)=>setForm(f=>({...f, max_capacity:e.target.value}))}
                  />
                </div>
              </div>

              {/* Sección: Precios */}
              <div className="mb-6">
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Precios
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Valor curso <span className="text-gray-400">(Mensualidad, CLP)</span>
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.price}
                      onChange={(e)=>setForm(f=>({...f, price:e.target.value}))}
                      placeholder="Ej: 25000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Valor por clase <span className="text-gray-400">(CLP)</span>
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.class_price}
                      onChange={(e)=>setForm(f=>({...f, class_price:e.target.value}))}
                      placeholder="Ej: 7000"
                    />
                  </div>
                </div>
              </div>

              <hr className="my-5 border-gray-200" />

              {/* Sección: Asignaciones */}
              <div>
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Asignaciones
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Profesor</label>
                    <select
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.teacher_id}
                      onChange={(e)=>setForm(f=>({...f, teacher_id:e.target.value}))}
                    >
                      <option value="">Sin profesor</option>
                      {teachers.map(t=> (<option key={t.id} value={t.id}>{t.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Sala</label>
                    <select
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.room_id}
                      onChange={(e)=>setForm(f=>({...f, room_id:e.target.value}))}
                    >
                      <option value="">Sin sala</option>
                      {rooms.map(r=> (<option key={r.id} value={r.id}>{r.name}</option>))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 md:col-span-2">
                    <input
                      id="is_active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e)=>setForm(f=>({...f, is_active:e.target.checked}))}
                    />
                    <label htmlFor="is_active" className="text-sm text-gray-700">Activo</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t px-6 py-4">
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 rounded border hover:bg-gray-50"
                  onClick={()=>setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50 hover:bg-emerald-700"
                  disabled={saving || !form.name.trim()}
                  onClick={async ()=>{
                    setSaving(true); setSaveError(null)
                    try{
                      const payload:any = {
                        name: form.name.trim(),
                        description: form.description || undefined,
                        level: form.level || undefined,
                        image_url: form.image_url || undefined,
                        course_type: form.course_type || undefined,
                        total_classes: form.total_classes === '' ? undefined : Number(form.total_classes),
                        classes_per_week: form.classes_per_week === '' ? undefined : Number(form.classes_per_week),
                        day_of_week: form.day_of_week === '' ? undefined : Number(form.day_of_week),
                        start_time: form.start_time || undefined,
                        end_time: form.end_time || undefined,
                        day_of_week_2: form.day_of_week_2 === '' ? undefined : Number(form.day_of_week_2),
                        start_time_2: form.start_time_2 || undefined,
                        end_time_2: form.end_time_2 || undefined,
                        day_of_week_3: form.day_of_week_3 === '' ? undefined : Number(form.day_of_week_3),
                        start_time_3: form.start_time_3 || undefined,
                        end_time_3: form.end_time_3 || undefined,
                        day_of_week_4: form.day_of_week_4 === '' ? undefined : Number(form.day_of_week_4),
                        start_time_4: form.start_time_4 || undefined,
                        end_time_4: form.end_time_4 || undefined,
                        day_of_week_5: form.day_of_week_5 === '' ? undefined : Number(form.day_of_week_5),
                        start_time_5: form.start_time_5 || undefined,
                        end_time_5: form.end_time_5 || undefined,
                        start_date: form.start_date || undefined,
                        max_capacity: form.max_capacity === '' ? undefined : Number(form.max_capacity),
                        price: form.price === '' ? undefined : Number(form.price),
                        class_price: form.class_price === '' ? undefined : Number(form.class_price),
                        teacher_id: form.teacher_id === '' ? undefined : Number(form.teacher_id),
                        room_id: form.room_id === '' ? undefined : Number(form.room_id),
                        is_active: !!form.is_active,
                      }
                      let theId = editId
                      if (editId) {
                        const res = await api.put(`/api/pms/courses/${editId}`, payload)
                        theId = res.data?.id ?? editId
                      } else {
                        const res = await api.post('/api/pms/courses', payload)
                        theId = res.data?.id
                      }
                      if (theId && imageFile) {
                        const fd = new FormData()
                        fd.append('file', imageFile)
                        await api.post(`/api/pms/courses/${theId}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                      }
                      setShowCreate(false)
                      setEditId(null)
                      setForm({
                        name:'', description:'', level:'', image_url:'', course_type:'regular',
                        total_classes:'4', classes_per_week:'1',
                        day_of_week:'', start_time:'', end_time:'',
                        day_of_week_2:'', start_time_2:'', end_time_2:'',
                        day_of_week_3:'', start_time_3:'', end_time_3:'',
                        day_of_week_4:'', start_time_4:'', end_time_4:'',
                        day_of_week_5:'', start_time_5:'', end_time_5:'',
                        start_date:'', max_capacity:'', price:'', class_price:'',
                        teacher_id:'', room_id:'', is_active:true
                      })
                      setImageFile(null)
                      setImageError(null)
                      await load()
                    }catch(e:any){
                      setSaveError(e?.response?.data?.detail || e?.message || 'Error al crear curso')
                    }finally{
                      setSaving(false)
                    }
                  }}
                >
                  {saving? 'Guardando...' : (editId ? 'Guardar' : 'Crear')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
