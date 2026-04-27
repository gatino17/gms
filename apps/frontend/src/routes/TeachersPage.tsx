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
      <div className="flex gap-2 mb-4">
        <div className="relative w-full md:max-w-sm group">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
          <input
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-all duration-200 shadow-sm"
            placeholder="Buscar profesor por nombre, email o estilo"
            value={q}
            onChange={(e)=>{ setQ(e.target.value); setPage(1) }}
          />
        </div>
        <button 
          className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all duration-200 shadow-sm font-medium" 
          onClick={load}
        >
          Buscar
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {Array.from({length:6}).map((_,i)=>(
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <div className="h-14 w-14 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="flex gap-2">
                    <div className="h-4 bg-gray-100 rounded-full w-16" />
                    <div className="h-4 bg-gray-100 rounded-full w-20" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-gray-200 rounded-full" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 bg-gray-200 rounded-full" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <div className="h-9 bg-gray-100 rounded-xl flex-1" />
                <div className="h-9 bg-gray-100 rounded-xl flex-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                  {data.map(t => (
            <div
              key={t.id}
              className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-xl hover:border-fuchsia-200 hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              {/* Resplandor decorativo */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-fuchsia-50 to-purple-50 rounded-bl-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              {/* Header tarjeta */}
              <div className="flex items-center gap-4">
                {/* Avatar con iniciales */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-400 to-purple-500 rounded-full blur opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
                  <div className="relative h-14 w-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white grid place-items-center text-lg font-bold shadow-inner ring-2 ring-white">
                    {initials(t.name)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold text-gray-900 truncate group-hover:text-fuchsia-700 transition-colors">{t.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {stylesToChips(t.styles).map((chip, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-fuchsia-50/80 border border-fuchsia-100 text-fuchsia-700">
                        {chip}
                      </span>
                    ))}
                    {!t.styles && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 border border-gray-200 text-gray-500">
                        Sin estilos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="mt-5 space-y-2.5 text-sm text-gray-600 relative z-10">
                <div className="flex items-center gap-3">
                  <HiOutlineMail className="text-gray-400 text-lg shrink-0 group-hover:text-fuchsia-400 transition-colors" />
                  <span className="truncate">{t.email ?? '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <HiOutlinePhone className="text-gray-400 text-lg shrink-0 group-hover:text-fuchsia-400 transition-colors" />
                  <span className="truncate">{t.phone ?? '-'}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <HiOutlineCalendar className="text-gray-400 text-lg group-hover:text-fuchsia-400 transition-colors" />
                    <span>Ingreso: <span className="font-medium text-gray-700">{fmtDate(t.join_date)}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HiOutlineCalendar className="text-gray-400 text-lg group-hover:text-fuchsia-400 transition-colors" />
                    <span>Nace: <span className="font-medium text-gray-700">{fmtDate(t.birthdate)}</span></span>
                  </div>
                </div>

                {t.birthdate && <div className="pt-1"><BirthdayLine birthdate={t.birthdate} /></div>}

                {t.bio && (
                  <div className="pt-3 mt-3 text-[13px] text-gray-600 whitespace-pre-wrap border-t border-gray-100 italic leading-relaxed">
                    "{t.bio}"
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="mt-5 flex gap-2 relative z-10">
                <button
                  className="flex-1 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-700 bg-white hover:bg-fuchsia-50 hover:text-fuchsia-700 hover:border-fuchsia-200 transition-colors shadow-sm"
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
                  className="flex-1 py-2 text-sm font-medium rounded-xl border border-red-100 text-red-600 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors shadow-sm"
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
          <div className="text-sm text-gray-500 font-medium">
            {total === 0
              ? 'No hay profesores registrados.'
              : `Mostrando ${showingFrom}-${showingTo} de ${total} profesores`}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm text-gray-500 font-medium flex items-center gap-2">
              Por página
              <select
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
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
                className="px-4 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || total === 0}
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500 font-medium px-1">
                Página {total === 0 ? 0 : page} de {total === 0 ? 0 : totalPages}
              </span>
              <button
                type="button"
                className="px-4 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 disabled:opacity-50 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
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
            <div className="bg-white px-6 py-6 max-h-[75vh] overflow-y-auto">
              {saveError && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                  {saveError}
                </div>
              )}

              {/* Sección: Datos básicos */}
              <div>
                <div className="mb-4 text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Datos básicos
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
                    <div className="relative group">
                      <HiOutlineUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
                      <input
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
                        value={form.name}
                        onChange={(e)=>setForm(f=>({...f, name:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                    <div className="relative group">
                      <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
                      <input
                        type="email"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
                        value={form.email}
                        onChange={(e)=>setForm(f=>({...f, email:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono</label>
                    <div className="relative group">
                      <HiOutlinePhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
                      <input
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
                        value={form.phone}
                        onChange={(e)=>setForm(f=>({...f, phone:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Estilos</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
                      placeholder="ej. Salsa, Bachata, Kizomba"
                      value={form.styles}
                      onChange={(e)=>setForm(f=>({...f, styles:e.target.value}))}
                    />
                  </div>
                </div>
              </div>

              <hr className="my-6 border-gray-100" />

              {/* Sección: Fechas */}
              <div>
                <div className="mb-4 text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Fechas
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha ingreso</label>
                    <div className="relative group">
                      <HiOutlineCalendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
                      <input
                        type="date"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
                        value={form.join_date}
                        onChange={(e)=>setForm(f=>({...f, join_date:e.target.value}))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha nacimiento</label>
                    <div className="relative group">
                      <HiOutlineCalendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" />
                      <input
                        type="date"
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors"
                        value={form.birthdate}
                        onChange={(e)=>setForm(f=>({...f, birthdate:e.target.value}))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-6 border-gray-100" />

              {/* Sección: Estilos & Bio */}
              <div>
                <div className="mb-4 text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Biografía
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <textarea
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-200 focus:border-fuchsia-400 transition-colors resize-y"
                      value={form.bio}
                      placeholder="Escribe un poco sobre la trayectoria del profesor..."
                      onChange={(e)=>setForm(f=>({...f, bio:e.target.value}))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-sm"
                  onClick={()=>setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button
                  className="px-6 py-2.5 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-medium rounded-xl disabled:opacity-50 hover:from-fuchsia-600 hover:to-purple-700 shadow-sm transition-all"
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
                  {saving? 'Guardando...' : (editId ? 'Guardar Cambios' : 'Crear Profesor')}
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
