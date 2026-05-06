import { useEffect, useState, useMemo } from 'react'
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
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePlus
} from 'react-icons/hi'

import CreateStudentModal from "../components/CreateStudentModal"
import EditStudentModal   from "../components/EditStudentModal"
import AddCourseModal from "../components/AddCourseModal"

type Student = {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  gender?: string | null
  photo_url?: string | null
  joined_at?: string | null
  is_active?: boolean
}

export default function StudentsPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()

  const [data, setData] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [stats, setStats] = useState({ total_active: 0, total_inactive: 0, female: 0, male: 0, new_this_week: 0 })
  
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/pms/students', { params: { q, limit: 100 } })
      setData(res.data.items)
      setStats(res.data.stats)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tenantId])
  useEffect(() => {
    const id = setTimeout(() => load(), 300)
    return () => clearTimeout(id)
  }, [q, tenantId])

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar alumno permanentemente?')) {
      await api.delete(`/api/pms/students/${id}`)
      load()
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-4">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Alumnos</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base">Gestión centralizada de tu comunidad.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <HiOutlineUserAdd size={20} /> Registrar Alumno
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4">
        {[
          { label: 'Total Activos', value: stats.total_active, icon: HiOutlineCheckCircle, color: 'emerald' },
          { label: 'Inactivos', value: stats.total_inactive, icon: HiOutlineXCircle, color: 'gray' },
          { label: 'Nuevos (Semana)', value: stats.new_this_week, icon: HiOutlineUserAdd, color: 'fuchsia' },
          { label: 'Género (M/H)', value: `${stats.female}/${stats.male}`, icon: HiOutlineUserGroup, color: 'blue' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 md:p-6 rounded-3xl border border-gray-100 shadow-sm">
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
          placeholder="Buscar alumno..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white md:rounded-[40px] shadow-sm border-y md:border border-gray-100 overflow-hidden mx-0 md:mx-4">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
             <div className="w-12 h-12 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
             <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-xs">Sincronizando...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead className="hidden md:table-header-group">
              <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumno</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contacto</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ingreso</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 block md:table-row-group">
              {data.map((s) => (
                <tr key={s.id} className="block md:table-row hover:bg-fuchsia-50/20 transition-colors group">
                  <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center font-black overflow-hidden border-2 border-white shadow-sm shrink-0">
                        {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                      </div>
                      <div>
                        <div className="font-black text-gray-900 group-hover:text-fuchsia-600 transition-colors">{s.first_name} {s.last_name}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase">Alumno #{s.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="block md:table-cell px-6 py-2 md:py-6">
                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:gap-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <HiOutlineMail className="text-fuchsia-400 shrink-0" /> <span className="truncate max-w-[200px]">{s.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <HiOutlinePhone className="text-fuchsia-400 shrink-0" /> {s.phone || '-'}
                      </div>
                    </div>
                  </td>
                  <td className="block md:table-cell px-6 py-2 md:py-6 text-left md:text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-6 py-6 text-center font-bold text-sm text-gray-500">
                    {s.joined_at ? new Date(s.joined_at).toLocaleDateString('es-CL') : '-'}
                  </td>
                  <td className="block md:table-cell px-6 md:px-8 py-4 md:py-6 text-left md:text-right">
                    <div className="flex items-center justify-start md:justify-end gap-2">
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="flex-1 md:flex-none p-3 bg-fuchsia-50 text-fuchsia-600 rounded-xl hover:bg-fuchsia-100 transition-all flex items-center justify-center gap-2"
                      >
                        <HiOutlineEye size={18} /> <span className="md:hidden text-[10px] font-black uppercase tracking-widest">Ver Perfil</span>
                      </button>
                      <button
                        onClick={() => { setSelectedStudent(s); setShowEdit(true) }}
                        className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center"
                      >
                        <HiOutlinePencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
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
        )}
      </div>

      {/* Modals */}
      {showCreate && <CreateStudentModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); load() }} />}
      {showEdit && selectedStudent && (
        <EditStudentModal
          student={selectedStudent as any}
          onClose={() => { setShowEdit(false); setSelectedStudent(null) }}
          onSuccess={() => { setShowEdit(false); setSelectedStudent(null); load() }}
        />
      )}
    </div>
  )
}
