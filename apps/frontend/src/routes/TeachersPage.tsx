import { useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import { useTenant } from '../lib/tenant'
import {
  HiOutlineSearch,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineUserAdd,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineTag,
  HiOutlineKey,
  HiOutlineLockClosed,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineX
} from 'react-icons/hi'

import CreateTeacherModal from "../components/CreateTeacherModal"
import EditTeacherModal from "../components/EditTeacherModal"

type Teacher = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  bio?: string | null
  join_date?: string | null
  birthdate?: string | null
  styles?: string | null
  photo_url?: string | null
  user_id?: number | null
  portal_enabled?: boolean
}

type TeacherStats = {
  total: number
  new_this_month: number
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

export default function TeachersPage() {
  const { tenantId } = useTenant()
  const [data, setData] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<TeacherStats>({ total: 0, new_this_month: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [q, setQ] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [portalLoadingId, setPortalLoadingId] = useState<number | null>(null)
  const [portalAccess, setPortalAccess] = useState<{ email: string; password?: string | null; message: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        q: q || undefined
      }
      const res = await api.get('/api/pms/teachers', { params })
      
      if (res.data && res.data.items) {
        setData(res.data.items)
        setStats(res.data.stats)
      } else {
        // Fallback for old API format
        setData(Array.isArray(res.data) ? res.data : [])
        setStats({ total: Array.isArray(res.data) ? res.data.length : 0, new_this_month: 0 })
      }
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail || err.message || 'Error al cargar profesores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId, page, pageSize])

  useEffect(() => {
    const id = setTimeout(() => {
      if (page !== 1) setPage(1)
      else load()
    }, 350)
    return () => clearTimeout(id)
  }, [q])

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar profesor permanentemente?')) {
      await api.delete(`/api/pms/teachers/${id}`)
      load()
    }
  }

  const handleCreatePortalAccess = async (teacher: Teacher) => {
    setPortalLoadingId(teacher.id)
    setError(null)
    setPortalAccess(null)
    try {
      const { data } = await api.post(`/api/pms/teachers/${teacher.id}/portal/access`, { enabled: true })
      setPortalAccess({
        email: data.email,
        password: data.password,
        message: data.message || 'Acceso mobile creado correctamente.',
      })
      await load()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'No se pudo crear el acceso mobile')
    } finally {
      setPortalLoadingId(null)
    }
  }

  const handleDisablePortalAccess = async (teacher: Teacher) => {
    if (!confirm('Desactivar acceso mobile de este profesor?')) return
    setPortalLoadingId(teacher.id)
    setError(null)
    setPortalAccess(null)
    try {
      const { data } = await api.delete(`/api/pms/teachers/${teacher.id}/portal/access`)
      setPortalAccess({
        email: data.email,
        password: null,
        message: data.message || 'Acceso mobile desactivado.',
      })
      await load()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'No se pudo desactivar el acceso mobile')
    } finally {
      setPortalLoadingId(null)
    }
  }

  const initials = (name?: string) => {
    if (!name) return 'PR'
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }

  const stylesToChips = (styles?: string | null) =>
    (styles || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

  const totalPages = Math.ceil(stats.total / pageSize)

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Profesores</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">Gestión de instructores y equipo docente.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <HiOutlineUserAdd size={20} /> Registrar Profesor
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-3xl text-rose-600 font-bold flex items-center gap-3">
          <HiOutlineX className="shrink-0" /> {error}
        </div>
      )}

      {portalAccess && (
        <div className="mx-4 rounded-3xl border border-fuchsia-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Acceso mobile profesor</p>
              <h3 className="mt-1 text-lg font-black text-gray-900">{portalAccess.message}</h3>
              <p className="mt-2 text-sm font-bold text-gray-600">Usuario: {portalAccess.email}</p>
              {portalAccess.password ? (
                <p className="mt-1 text-sm font-black text-gray-900">Clave temporal: <span className="font-mono text-fuchsia-600">{portalAccess.password}</span></p>
              ) : null}
            </div>
            <button type="button" onClick={() => setPortalAccess(null)} className="rounded-2xl bg-gray-50 p-2 text-gray-400 hover:bg-gray-100">
              <HiOutlineX />
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 px-4">
        {[
          { label: 'Total Plantilla', value: stats.total, icon: HiOutlineUserGroup, color: 'fuchsia' },
          { label: 'Nuevos (Mes)', value: stats.new_this_month, icon: HiOutlineUserAdd, color: 'emerald' },
          { label: 'Especialidades', value: 'Diversas', icon: HiOutlineTag, color: 'blue', hideOnMobile: true },
        ].map((s, i) => (
          <div key={i} className={`bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm ${s.hideOnMobile ? 'hidden md:block' : ''}`}>
            <div className={`p-2.5 w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-${s.color}-50 text-${s.color}-600 mb-3 md:mb-4 flex items-center justify-center`}>
              <s.icon size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</div>
            <div className="text-xl md:text-2xl font-black text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative group px-4">
        <HiOutlineSearch className="absolute left-9 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
        <input
          className="w-full bg-white border-2 border-gray-100 rounded-3xl pl-14 pr-6 py-4 md:py-5 text-base md:text-lg font-medium focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50 transition-all outline-none shadow-sm"
          placeholder="Buscar por nombre o especialidad..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-[28px] md:rounded-[40px] shadow-sm border border-gray-100 overflow-hidden mx-1 md:mx-4">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
             <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
             <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando...</span>
          </div>
        ) : (
          <div className="overflow-x-hidden md:overflow-x-auto">
            <table className="w-full">
              <thead className="hidden md:table-header-group">
                <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Profesor</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contacto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Especialidades</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ingreso</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="block space-y-3 p-3 md:space-y-0 md:p-0 md:divide-y md:divide-gray-50 md:table-row-group">
                {data.map((t) => (
                  <tr key={t.id} className="block w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:table-row hover:bg-fuchsia-50/20 transition-colors group">
                    <td className="block md:table-cell px-4 md:px-8 py-4 md:py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center font-black overflow-hidden border-2 border-white shadow-sm shrink-0">
                          {t.photo_url ? <img src={toAbsoluteUrl(t.photo_url)} className="w-full h-full object-cover" /> : initials(t.name)}
                        </div>
                        <div>
                          <div className="font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors">{t.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Profesor #{t.id}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${
                              t.portal_enabled
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                                : 'border-gray-100 bg-gray-50 text-gray-400'
                            }`}>
                              {t.portal_enabled ? 'Mobile activo' : 'Sin mobile'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="block md:table-cell px-4 md:px-6 py-2 md:py-6">
                      <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:gap-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                          <HiOutlineMail className="text-fuchsia-400 shrink-0" /> <span className="truncate max-w-[200px]">{t.email || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                          <HiOutlinePhone className="text-fuchsia-400 shrink-0" /> {t.phone || '-'}
                        </div>
                      </div>
                    </td>
                    <td className="block md:table-cell px-4 md:px-6 py-3 md:py-6">
                      <div className="flex flex-wrap gap-1.5">
                        {stylesToChips(t.styles).map((chip, idx) => (
                          <span key={idx} className="px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100">
                            {chip}
                          </span>
                        ))}
                        {!t.styles && <span className="text-xs text-gray-400 font-medium">Sin especialidades</span>}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-6 text-center font-bold text-sm text-gray-500">
                      {t.join_date ? new Date(t.join_date).toLocaleDateString('es-CL') : '-'}
                    </td>
                    <td className="block md:table-cell px-4 md:px-8 py-4 md:py-6 text-left md:text-right">
                      <div className="flex items-center justify-start md:justify-end gap-2 pt-2 border-t border-gray-50 md:border-0 md:pt-0">
                        <button
                          onClick={() => { setSelectedTeacher(t); setShowEdit(true) }}
                          className="flex-1 md:flex-none p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl hover:bg-fuchsia-100 transition-all flex items-center justify-center gap-2"
                        >
                          <HiOutlinePencil size={18} /> <span className="md:hidden text-[10px] font-black uppercase tracking-widest">Editar</span>
                        </button>
                        <button
                          onClick={() => handleCreatePortalAccess(t)}
                          disabled={portalLoadingId === t.id || !t.email}
                          className="flex-1 md:flex-none p-3 bg-slate-950 text-white rounded-xl hover:bg-fuchsia-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                          title={t.portal_enabled ? 'Resetear acceso mobile' : 'Crear acceso mobile'}
                        >
                          <HiOutlineKey size={18} /> <span className="md:hidden text-[10px] font-black uppercase tracking-widest">{t.portal_enabled ? 'Reset' : 'Mobile'}</span>
                        </button>
                        {t.portal_enabled && (
                          <button
                            onClick={() => handleDisablePortalAccess(t)}
                            disabled={portalLoadingId === t.id}
                            className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
                            title="Desactivar acceso mobile"
                          >
                            <HiOutlineLockClosed size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-3 bg-rose-50 text-rose-400 rounded-xl hover:text-rose-600 hover:bg-rose-100 transition-all flex items-center justify-center"
                        >
                          <HiOutlineTrash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && stats.total > 0 && (
          <div className="px-6 md:px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest order-2 md:order-1">
              Mostrando {data.length} de {stats.total} profesores
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 order-1 md:order-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Por página:</span>
                <select 
                  className="bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-600 outline-none focus:border-fuchsia-300 transition-colors shadow-sm"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                >
                  {PAGE_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-fuchsia-600 hover:border-fuchsia-200 disabled:opacity-30 transition-all shadow-sm"
                >
                  <HiOutlineChevronLeft size={20} />
                </button>
                <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-black text-[10px] text-gray-700 shadow-sm uppercase tracking-widest">
                  Pág. {page} / {totalPages || 1}
                </div>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-fuchsia-600 hover:border-fuchsia-200 disabled:opacity-30 transition-all shadow-sm"
                >
                  <HiOutlineChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateTeacherModal 
          onClose={() => setShowCreate(false)} 
          onSuccess={() => { setShowCreate(false); load() }} 
        />
      )}
      {showEdit && selectedTeacher && (
        <EditTeacherModal
          teacher={selectedTeacher}
          onClose={() => { setShowEdit(false); setSelectedTeacher(null) }}
          onSuccess={() => { setShowEdit(false); setSelectedTeacher(null); load() }}
        />
      )}
    </div>
  )
}
