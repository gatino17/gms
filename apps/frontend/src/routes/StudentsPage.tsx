import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import {
  HiOutlineUserGroup,
  HiOutlineUserAdd,
  HiOutlineSearch,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineCalendar,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCheckCircle,
  HiOutlineMinusCircle
} from 'react-icons/hi'

import CreateStudentModal from "../components/CreateStudentModal"
import EditStudentModal   from "../components/EditStudentModal"
import AddCourseModal from "../components/AddCourseModal"


type Student = {
  id: number
  tenant_id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  gender?: string | null
  notes?: string | null
  photo_url?: string | null
  joined_at?: string | null
  birthdate?: string | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export type CourseLite = {
  id:number; name:string;
  image_url?: string|null;
  level?: string|null;
  course_type?: string|null;
  classes_per_week?: number|null;
  day_of_week?: number|null; start_time?: string|null; end_time?: string|null;
  day_of_week_2?: number|null; start_time_2?: string|null; end_time_2?: string|null;
  day_of_week_3?: number|null; start_time_3?: string|null; end_time_3?: string|null;
  day_of_week_4?: number|null; start_time_4?: string|null; end_time_4?: string|null;
  day_of_week_5?: number|null; start_time_5?: string|null; end_time_5?: string|null;
  start_date?: string|null;
  price?: number|string|null; class_price?: number|string|null;
  teacher_name?: string|null; room_name?: string|null;
}

type EnrollItem = {
  courseId: string
  planType: 'monthly'|'single_class'
  lessonsPerWeek: '1'|'2'
  start: string
  end: string
  endAuto: boolean
  payNow: boolean
  paymentAmount: string
  paymentMethod: 'cash'|'card'|'transfer'
  paymentDate: string
  paymentDiscount: string
}

const newEnrollItem = (): EnrollItem => ({
  courseId: '',
  planType: 'monthly',
  lessonsPerWeek: '1',
  start: '',
  end: '',
  endAuto: true,
  payNow: false,
  paymentAmount: '',
  paymentMethod: 'cash',
  paymentDate: '',
  paymentDiscount: ''
})

export default function StudentsPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()

  const [data, setData] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total_active: 0, total_inactive: 0, female: 0, male: 0, new_this_week: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')

  // Crear vs Editar
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  // Guardado / errores globales de modal
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Form compartido
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
    notes: '',
    photo_url: '',
    joined_at: '',
    birthdate: '',
    is_active: true,
  })

  // Imagen (ambos modales)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Cursos e inscripci�n
  const [courses, setCourses] = useState<CourseLite[]>([])
  const [enrollItems, setEnrollItems] = useState<EnrollItem[]>([newEnrollItem()])
  const [summaryMethod, setSummaryMethod] = useState<'cash'|'card'|'transfer'|'convenio'>('cash')
  const [summaryDiscount, setSummaryDiscount] = useState<string>('')
  const [summaryPaymentDate, setSummaryPaymentDate] = useState<string>('')
  const [paymentMode, setPaymentMode] = useState<'none'|'total'|'per_course'>('none')
  const [summaryReference, setSummaryReference] = useState<string>('')

  // AddCourseModal (placeholder)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollTarget, setEnrollTarget] = useState<{ id:number; name:string }|null>(null)

  // Paginaci�n
  const [page, setPage] = useState<number>(1)
  const pageSize = 10

  const load = async (pageOverride?: number) => {
    setLoading(true)
    setError(null)
    try {
      const currentPage = pageOverride ?? page
      const params: any = { limit: pageSize, offset: (currentPage - 1) * pageSize }
      if (q) params.q = q
      const res = await api.get('/api/pms/students', { params })
      const items = res.data?.items ?? (Array.isArray(res.data) ? res.data : [])
      setData(items)
      setTotal(res.data?.total ?? items.length)
      if (res.data?.stats) {
        const st = res.data.stats
        setStats({
          total_active: st.total_active ?? 0,
          total_inactive: st.total_inactive ?? 0,
          female: st.female ?? 0,
          male: st.male ?? 0,
          new_this_week: st.new_this_week ?? 0,
        })
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando alumnos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const id = setTimeout(() => { load() }, 250)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, tenantId])

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await api.get('/api/pms/courses')
        const items = res.data?.items ?? (Array.isArray(res.data) ? res.data : [])
        setCourses(items.map((c:any):CourseLite=>({
          id:c.id, name:c.name, image_url:c.image_url ?? null, level:c.level ?? null,
          course_type:c.course_type ?? null, classes_per_week:c.classes_per_week ?? null,
          day_of_week:c.day_of_week ?? null,
          start_time:c.start_time ? String(c.start_time).slice(0,5) : null,
          end_time:c.end_time ? String(c.end_time).slice(0,5) : null,
          day_of_week_2:c.day_of_week_2 ?? null,
          start_time_2:c.start_time_2 ? String(c.start_time_2).slice(0,5) : null,
          end_time_2:c.end_time_2 ? String(c.end_time_2).slice(0,5) : null,
          day_of_week_3:(c as any).day_of_week_3 ?? null,
          start_time_3:(c as any).start_time_3 ? String((c as any).start_time_3).slice(0,5) : null,
          end_time_3:(c as any).end_time_3 ? String((c as any).end_time_3).slice(0,5) : null,
          day_of_week_4:(c as any).day_of_week_4 ?? null,
          start_time_4:(c as any).start_time_4 ? String((c as any).start_time_4).slice(0,5) : null,
          end_time_4:(c as any).end_time_4 ? String((c as any).end_time_4).slice(0,5) : null,
          day_of_week_5:(c as any).day_of_week_5 ?? null,
          start_time_5:(c as any).start_time_5 ? String((c as any).start_time_5).slice(0,5) : null,
          end_time_5:(c as any).end_time_5 ? String((c as any).end_time_5).slice(0,5) : null,
          start_date:c.start_date ?? null, price:c.price ?? null, class_price:c.class_price ?? null,
          teacher_name:c.teacher_name ?? null, room_name:c.room_name ?? null,
        })))
      } catch {}
    }
    loadCourses()
  }, [tenantId])

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile)
      setImagePreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setImagePreview(form.photo_url || null)
  }, [imageFile, form.photo_url])

  const getCourse = (cid: string) => courses.find(c => String(c.id) === cid)
  const computeEnd = (start: string, lessons: '1'|'2', plan: 'monthly'|'single_class') => {
    if (!start) return ''
    if (plan === 'single_class') return start
    const d = new Date(start)
    const addDays = lessons === '1' ? 21 : 24
    const end = new Date(d.getTime()); end.setDate(end.getDate() + addDays)
    return end.toISOString().slice(0,10)
  }
  const updateEnroll = (idx: number, patch: Partial<EnrollItem>) => {
    setEnrollItems(list => {
      const next = [...list]
      const cur = { ...next[idx], ...patch }
      if (patch.courseId !== undefined && cur.planType === 'monthly') {
        const c = getCourse(cur.courseId)
        const cpw = (c?.classes_per_week ?? 1)
        cur.lessonsPerWeek = cpw >= 2 ? '2' : '1'
      }
      if (patch.planType === 'single_class') cur.lessonsPerWeek = '1'
      const needEndAuto = patch.start !== undefined || patch.lessonsPerWeek !== undefined || patch.planType !== undefined || patch.courseId !== undefined
      if (needEndAuto && cur.endAuto) cur.end = computeEnd(cur.start, cur.lessonsPerWeek, cur.planType)
      if ((patch.courseId !== undefined || patch.planType !== undefined) && cur.payNow) {
        const c = getCourse(cur.courseId)
        const suggested = cur.planType === 'single_class' ? c?.class_price : c?.price
        if (suggested != null && !Number.isNaN(Number(suggested))) cur.paymentAmount = String(suggested)
      }
      next[idx] = cur
      return next
    })
  }
  const suggestedAmountFor = (it: EnrollItem): number | null => {
    const c = getCourse(it.courseId)
    if (!c) return null
    const raw = it.planType === 'single_class' ? c.class_price : c.price
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  const metrics = {
    totalActive: stats.total_active,
    totalInactive: stats.total_inactive,
    female: stats.female,
    male: stats.male,
    newThisWeek: stats.new_this_week,
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pagedData = data
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(total / pageSize))
    if (page > tp) setPage(tp)
  }, [total, pageSize, page])

  // ? NUEVO: callback cuando se crea un alumno desde el modal
  const handleCreated = async () => {
    setShowCreate(false)
    setQ('')                 // limpia buscador
    setPage(1)
    await load(1)            // recarga lista completa
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }

  return (
    <div className="space-y-4">
      <div className="h-1 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-purple-600" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-500 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
          <HiOutlineUserGroup className="text-fuchsia-500/80" />
          Alumnos
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white shadow-sm transition bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
            onClick={() => {
              // Reset para CREAR
              setEditId(null)
              setSaveError(null)
              setForm({ first_name:'', last_name:'', email:'', phone:'', gender:'', notes:'', photo_url:'', joined_at:'', birthdate:'', is_active:true })
              setImageFile(null); setImageError(null); setEnrollItems([newEnrollItem()])
              setSummaryMethod('cash'); setSummaryDiscount(''); setSummaryPaymentDate(''); setPaymentMode('none'); setSummaryReference('')
              setShowCreate(true)
            }}
            title="Agregar alumno"
          >
            <HiOutlineUserAdd /> Agregar
          </button>
        </div>
      </div>

      {/* M�tricas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-white rounded-xl border">
          <div className="text-xs text-gray-500 flex items-center gap-1"><HiOutlineCheckCircle /> Activos</div>
          <div className="text-xl font-semibold text-emerald-600">{metrics.totalActive}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border">
          <div className="text-xs text-gray-500 flex items-center gap-1"><HiOutlineMinusCircle /> Inactivos</div>
          <div className="text-xl font-semibold text-rose-600">{metrics.totalInactive}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border">
          <div className="text-xs text-gray-500 flex items-center gap-1">Mujeres</div>
          <div className="text-xl font-semibold text-pink-600">{metrics.female}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border">
          <div className="text-xs text-gray-500 flex items-center gap-1">Hombres</div>
          <div className="text-xl font-semibold text-blue-600">{metrics.male}</div>
        </div>
        <div className="p-3 bg-white rounded-xl border">
          <div className="text-xs text-gray-500 flex items-center gap-1"><HiOutlineCalendar /> Nuevos (7 dias)</div>
          <div className="text-xl font-semibold">{metrics.newThisWeek}</div>
        </div>
      </div>

      {/* Buscador */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-64 sm:w-80 border rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
            placeholder="Buscar (nombre o email)"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            autoComplete="off"
            name="q"
          />
        </div>
        <button className="px-4 py-2 rounded-lg border hover:bg-white" onClick={load}>Buscar</button>
      </div>

      {loading && <div className="mt-3">Cargando...</div>}
      {error && <div className="mt-3 text-red-600">{error}</div>}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-xl border shadow-sm overflow-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2 bg-gray-50/80">#</th>
                  <th className="px-3 py-2 bg-gray-50/80">Foto</th>
                  <th className="px-3 py-2 bg-gray-50/80">Nombre</th>
                  <th className="px-3 py-2 bg-gray-50/80">Email</th>
                  <th className="px-3 py-2 bg-gray-50/80">Telefono</th>
                  <th className="px-3 py-2 bg-gray-50/80">Ingreso</th>
                  <th className="px-3 py-2 bg-gray-50/80">Estado</th>
                  <th className="px-3 py-2 bg-gray-50/80">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pagedData.map((s, idx) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center ring-2 ring-fuchsia-100">
                        {s.photo_url ? (
                          <img src={toAbsoluteUrl(s.photo_url)} alt={`${s.first_name} ${s.last_name}`} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-500 select-none">
                            {`${(s.first_name||'').charAt(0)}${(s.last_name||'').charAt(0)}`.toUpperCase() || '�'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-fuchsia-700">{s.first_name} {s.last_name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        {s.gender && <span>{s.gender}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 text-gray-700">
                        <HiOutlineMail className="text-gray-400" />
                        {s.email ?? '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 text-gray-700">
                        <HiOutlinePhone className="text-gray-400" />
                        {s.phone ?? '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="inline-flex items-center gap-1 text-gray-700">
                        <HiOutlineCalendar className="text-gray-400" />
                        {s.joined_at ?? '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className={`px-2 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition
                          ${s.is_active !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'}`}
                        onClick={async () => {
                          try {
                            await api.put(`/api/pms/students/${s.id}`, { is_active: !(s.is_active !== false) })
                            await load()
                          } catch {}
                        }}
                        title="Alternar estado"
                      >
                        {s.is_active !== false ? <HiOutlineCheckCircle /> : <HiOutlineMinusCircle />}
                        {s.is_active !== false ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-3 py-1.5 text-sm rounded-lg border hover:bg-white inline-flex items-center gap-1"
                          onClick={() => navigate(`/students/${s.id}`)}
                          title="Ver detalle"
                        >
                          <HiOutlineEye /> Ver
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm rounded-lg border hover:bg-white inline-flex items-center gap-1"
                          onClick={async () => {
                            try {
                              const res = await api.get(`/api/pms/students/${s.id}`)
                              const x = res.data as Student
                              setForm({
                                first_name: x.first_name ?? '',
                                last_name: x.last_name ?? '',
                                email: x.email ?? '',
                                phone: x.phone ?? '',
                                gender: x.gender ?? '',
                                notes: x.notes ?? '',
                                photo_url: x.photo_url ?? '',
                                joined_at: x.joined_at ?? '',
                                birthdate: x.birthdate ?? '',
                                is_active: x.is_active !== false,
                              })
                              setEditId(s.id)
                              setSaveError(null)
                              setImageFile(null); setImageError(null)
                              setShowEdit(true)
                            } catch {}
                          }}
                          title="Editar"
                        >
                          <HiOutlinePencil /> Editar
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                          onClick={async ()=>{ if(!confirm('�Eliminar alumno?')) return; try{ await api.delete(`/api/pms/students/${s.id}`); await load(); } catch{} }}
                          title="Eliminar"
                        >
                          <HiOutlineTrash /> Eliminar
                        </button>
                        <button
                          className="px-3 py-1.5 text-sm rounded-lg border hover:bg-white inline-flex items-center gap-1"
                          title="Agregar curso"
                          onClick={() => {
                            const name = `${s.first_name||''} ${s.last_name||''}`.trim() || `Alumno ${s.id}`
                            setEnrollTarget({ id: s.id, name })
                            setShowEnrollModal(true)
                          }}
                        >
                          <HiOutlineUserAdd /> Agregar curso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginacion */}
          <div className="flex items-center justify-between mt-3">
            <div className="text-sm text-gray-600">
              Mostrando {(total === 0 ? 0 : (page - 1) * pageSize + 1)}-{Math.min(page * pageSize, total)} de {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border disabled:opacity-50 hover:bg-white"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <HiOutlineChevronLeft /> Anterior
              </button>
              <span className="text-sm">Pagina {page} de {totalPages}</span>
              <button
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border disabled:opacity-50 hover:bg-white"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Siguiente <HiOutlineChevronRight />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modales */}
      {showCreate && (
        <CreateStudentModal
          showCreate={showCreate}
          setShowCreate={setShowCreate}
          saving={saving}
          setSaving={setSaving}
          saveError={saveError}
          setSaveError={setSaveError}
          form={form}
          setForm={setForm}
          imageFile={imageFile}
          setImageFile={setImageFile}
          imageError={imageError}
          setImageError={setImageError}
          imagePreview={imagePreview}
          enrollItems={enrollItems}
          setEnrollItems={setEnrollItems}
          summaryMethod={summaryMethod}
          setSummaryMethod={setSummaryMethod}
          summaryDiscount={summaryDiscount}
          setSummaryDiscount={setSummaryDiscount}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          summaryPaymentDate={summaryPaymentDate}
          setSummaryPaymentDate={setSummaryPaymentDate}
          summaryReference={summaryReference}
          setSummaryReference={setSummaryReference}
          getCourse={getCourse}
          suggestedAmountFor={suggestedAmountFor}
          updateEnroll={updateEnroll}
          computeEnd={computeEnd}
          courses={courses}
          load={load}
          onCreated={handleCreated}   // ? NUEVO
        />
      )}

      {showEdit && (
        <EditStudentModal
          editId={editId}
          setEditId={setEditId}
          showEdit={showEdit}
          setShowEdit={setShowEdit}
          saving={saving}
          setSaving={setSaving}
          saveError={saveError}
          setSaveError={setSaveError}
          form={form}
          setForm={setForm}
          imageFile={imageFile}
          setImageFile={setImageFile}
          imageError={imageError}
          setImageError={setImageError}
          imagePreview={imagePreview}
          load={load}
        />
      )}

      {showEnrollModal && enrollTarget && (
        <AddCourseModal
          open={showEnrollModal}
          onClose={()=> setShowEnrollModal(false)}
          studentId={enrollTarget.id}
          studentName={enrollTarget.name}
          courses={courses}
          getCourse={getCourse}
          suggestedAmountFor={(it)=> suggestedAmountFor({
            courseId: it.courseId,
            planType: it.planType,
            lessonsPerWeek: it.lessonsPerWeek,
            start: it.start,
            end: it.end,
            endAuto: it.endAuto,
            payNow: it.payNow,
            paymentAmount: it.paymentAmount,
            paymentDate: it.paymentDate,
          } as any)}
          computeEnd={computeEnd}
          load={load}
        />
      )}

    </div>
  )
}












