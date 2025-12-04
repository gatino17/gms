import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'
import {
  HiOutlineSearch,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineCalendar,
  HiOutlineUser
} from 'react-icons/hi'

type Teacher = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  bio?: string | null
  join_date?: string | null
  birthdate?: string | null
  styles?: string | null
}

type TeacherListResponse = {
  items: Teacher[]
  total: number
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function TeachersPage() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    join_date: '',
    birthdate: '',
    styles: ''
  })
  const [editId, setEditId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }
      if (q) params.q = q
      const res = await api.get<TeacherListResponse>('/api/pms/teachers', { params })
      const nextTotal = res.data.total ?? res.data.items.length
      setData(res.data.items)
      setTotal(nextTotal)
      if (nextTotal > 0 && (page - 1) * pageSize >= nextTotal) {
        const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize))
        if (page !== maxPage) {
          setPage(maxPage)
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando profesores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [tenantId])

  useEffect(() => {
    const id = setTimeout(() => { load() }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, q, page, pageSize])

  const stylesToChips = (styles?: string | null) =>
    (styles || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

  const initials = (name?: string) => {
    if (!name) return 'PR'
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  function fmtDate(d?: string | null) {
    if (!d) return '-'
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt
      .toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
      .replace('.', '')
  }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = total === 0 ? 0 : Math.min(total, (page - 1) * pageSize + data.length)

  return (
    <div className="space-y-4">
      {/* Topbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Profesores</h1>
          <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm border">
            Total: {total}
          </span>
        </div>
        <button
          className="px-3 py-2 md:px-4 md:py-2 rounded-lg text-white shadow-sm transition bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
          onClick={() => {
            setEditId(null)
            setForm({ name:'', email:'', phone:'', bio:'', join_date:'', birthdate:'', styles:'' })
            setSaveError(null)
            setShowCreate(true)
          }}
        >
          + Crear profesor
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-2">
        <div className="relative w-full md:max-w-sm">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Buscar profesor por nombre, email o estilo"
            value={q}
            onChange={(e)=>{ setQ(e.target.value); setPage(1) }}
          />
        </div>
        <button className="px-3 py-2 rounded border text-gray-600 hover:bg-gray-50" onClick={load}>
          Buscar
        </button>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border p-6 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({length:6}).map((_,i)=>(
              <div key={i} className="h-32 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      )}

      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                  {data.map(t => (
            <div
              key={t.id}
              className="group rounded-xl border bg-white p-4 shadow-sm hover:shadow transition"
            >
              {/* Header tarjeta */}
              <div className="flex items-center gap-3">
                {/* Avatar con iniciales */}
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-500 text-white grid place-items-center font-semibold border">
                  {initials(t.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-base md:text-lg font-semibold truncate">{t.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {stylesToChips(t.styles).map((chip, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 border text-gray-700">
                        {chip}
                      </span>
                    ))}
                    {!t.styles && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 border text-gray-400">
                        Sin estilos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <HiOutlineMail className="text-gray-400" />
                  <span className="truncate">{t.email ?? '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HiOutlinePhone className="text-gray-400" />
                  <span className="truncate">{t.phone ?? '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HiOutlineCalendar className="text-gray-400" />
                  <span>Ingreso: {fmtDate(t.join_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HiOutlineCalendar className="text-gray-400" />
                  <span>Nacimiento: {fmtDate(t.birthdate)}</span>
                </div>

                {t.birthdate && <BirthdayLine birthdate={t.birthdate} />}

                {t.bio && (
                  <div className="pt-1 text-[13px] text-gray-600 whitespace-pre-wrap border-t">{t.bio}</div>
                )}
              </div>

              {/* Acciones */}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="px-3 py-1.5 text-sm rounded-lg border hover:bg-gray-50"
                  onClick={()=>{
                    setEditId(t.id)
                    setForm({
                      name: t.name ?? '',
                      email: t.email ?? '',
                      phone: t.phone ?? '',
                      bio: t.bio ?? '',
                      join_date: t.join_date ?? '',
                      birthdate: t.birthdate ?? '',
                      styles: t.styles ?? '',
                    })
                    setSaveError(null)
                    setShowCreate(true)
                  }}
                >
                  Editar
                </button>
                <button
                  className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                  onClick={async()=>{
                    if(!confirm('¿Eliminar profesor?')) return
                    try {
                      await api.delete(`/api/pms/teachers/${t.id}`)
                      await load()
                    } catch(e) {}
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white border rounded-xl px-4 py-3">
          <div className="text-sm text-gray-600">
            {total === 0
              ? 'No hay profesores registrados.'
              : `Mostrando ${showingFrom}-${showingTo} de ${total} profesores`}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-600 flex items-center gap-2">
              Por página
              <select
                className="border rounded px-2 py-1 text-sm"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || total === 0}
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {total === 0 ? 0 : page} de {total === 0 ? 0 : totalPages}
              </span>
              <button
                type="button"
                className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                onClick={() => setPage((p) => p + 1)}
                disabled={total === 0 || page >= totalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowCreate(false)
              setEditId(null)
              setForm({ name:'', email:'', phone:'', bio:'', join_date:'', birthdate:'', styles:'' })
              setSaveError(null)
            }}
          />
          {/* Contenedor con header degradado, secciones y footer como en Cursos */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl">
            {/* Header con degradado */}
            <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold">
                  {editId ? 'Editar profesor' : 'Crear profesor'}
                </h2>
                <button
                  className="rounded-full hover:bg-white/10 px-2 py-1"
                  onClick={()=>setShowCreate(false)}
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

              {/* Sección: Datos básicos */}
              <div>
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Datos básicos
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                    <div className="relative">
                      <HiOutlineUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.name}
                        onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email</label>
                    <div className="relative">
                      <HiOutlineMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        className="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.email}
                        onChange={(e)=>setForm(f=>({...f, email:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
                    <div className="relative">
                      <HiOutlinePhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        className="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.phone}
                        onChange={(e)=>setForm(f=>({...f, phone:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Estilos</label>
                    <input
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      placeholder="ej. Salsa, Bachata, Kizomba"
                      value={form.styles}
                      onChange={(e)=>setForm(f=>({...f, styles:e.target.value}))}
                    />
                  </div>
                </div>
              </div>

              <hr className="my-5 border-gray-200" />

              {/* Sección: Fechas */}
              <div>
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Fechas
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fecha ingreso</label>
                    <div className="relative">
                      <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        className="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.join_date}
                        onChange={(e)=>setForm(f=>({...f, join_date:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fecha nacimiento</label>
                    <div className="relative">
                      <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        className="w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        value={form.birthdate}
                        onChange={(e)=>setForm(f=>({...f, birthdate:e.target.value}))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-5 border-gray-200" />

              {/* Sección: Estilos & Bio */}
              <div>
                <div className="mb-3 text-sm font-semibold text-gray-800">
                  Estilos & Bio
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Bio</label>
                    <textarea
                      rows={4}
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      value={form.bio}
                      onChange={(e)=>setForm(f=>({...f, bio:e.target.value}))}
                    />
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
                        email: form.email || undefined,
                        phone: form.phone || undefined,
                        bio: form.bio || undefined,
                        join_date: form.join_date || undefined,
                        birthdate: form.birthdate || undefined,
                        styles: form.styles || undefined,
                      }
                      if(editId){
                        await api.put(`/api/pms/teachers/${editId}`, payload)
                      } else {
                        await api.post('/api/pms/teachers', payload)
                      }
                      setShowCreate(false)
                      setForm({ name:'', email:'', phone:'', bio:'', join_date:'', birthdate:'', styles:'' })
                      setEditId(null)
                      await load()
                    }catch(e:any){
                      setSaveError(e?.response?.data?.detail || e?.message || 'Error al guardar profesor')
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

function BirthdayLine({ birthdate }: { birthdate: string }) {
  const today = new Date()
  const y = today.getFullYear()
  // Parse YYYY-MM-DD como fecha local para evitar desfase
  const parts = birthdate.split('-')
  if (parts.length < 3) return null
  const by = Number(parts[0])
  const bm = Number(parts[1])
  const bd = Number(parts[2])
  if (!Number.isFinite(by) || !Number.isFinite(bm) || !Number.isFinite(bd)) return null
  const next = new Date(y, bm - 1, bd)
  const isToday =
    next.getFullYear() === today.getFullYear() &&
    next.getMonth() === today.getMonth() &&
    next.getDate() === today.getDate()
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const dd = String(next.getDate()).padStart(2, '0')
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
  const label = `${dd}-${meses[next.getMonth()]}-${next.getFullYear()} — ${dias[next.getDay()]}`
  return (
    <div className={`text-sm ${isToday ? 'text-pink-600 font-bold' : 'text-gray-700 font-semibold'}`}>
      <span className="inline-flex items-center gap-1">🎂 Cumple (año actual): {label}</span>
    </div>
  )
}
