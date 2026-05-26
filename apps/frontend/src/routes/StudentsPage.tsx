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
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlinePlus
} from 'react-icons/hi'

import CreateStudentModal from "../components/CreateStudentModal"
import EditStudentModal   from "../components/EditStudentModal"
import EnrollStudentModal from "../components/EnrollStudentModal"
import RenewModal         from "../components/RenewModal"

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
  enrollment_count?: number
}

function ymdToCL(ymd?: string | null): string { 
  if (!ymd) return '-'; 
  const [y,m,d] = ymd.split('-').map(Number); 
  const dt = new Date(y, (m||1)-1, d||1); 
  return dt.toLocaleDateString('es-CL'); 
}

export default function StudentsPage() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()

  const [data, setData] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [stats, setStats] = useState({ total_active: 0, total_inactive: 0, female: 0, male: 0, new_this_week: 0 })
  const [enrollmentFeeByStudent, setEnrollmentFeeByStudent] = useState<Record<number, boolean>>({})
  
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const [showEnroll, setShowEnroll] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [payData, setPayData] = useState<{ studentId: number, courseId: number, enrollmentId: number } | null>(null)

  // Pagination states
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = async () => {
    setLoading(true)
    try {
      const studentsRes = await api.get('/api/pms/students', { params: { q, limit: 1000 } })
      setData(studentsRes.data.items)
      setStats(studentsRes.data.stats)

      // Optional load: if payments fails, students list must still render.
      try {
        const paymentsRes = await api.get('/api/pms/payments', { params: { type: 'registration', limit: 1000, offset: 0 } })
        const feeMap: Record<number, boolean> = {}
        for (const p of (paymentsRes.data?.items || [])) {
          const sid = Number(p?.student_id || 0)
          if (!sid) continue
          feeMap[sid] = true
        }
        setEnrollmentFeeByStudent(feeMap)
      } catch {
        setEnrollmentFeeByStudent({})
      }

      setPage(1) // Reset to first page on new search
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tenantId])
  useEffect(() => {
    const id = setTimeout(() => load(), 300)
    return () => clearTimeout(id)
  }, [q, tenantId])

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize])

  const totalPages = Math.ceil(data.length / pageSize)

  const handleDelete = async (id: number) => {
    if (confirm('¿Eliminar alumno permanentemente?')) {
      await api.delete(`/api/pms/students/${id}`)
      load()
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Comunidad</span>
           <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-none">Alumnos</h1>
           <p className="text-gray-500 font-medium text-xs md:text-sm">Gestión centralizada de tu academia.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black text-sm rounded-xl shadow-xl shadow-fuchsia-100 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <HiOutlineUserAdd size={18} /> Registrar Alumno
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {[
          { label: 'Total Activos', value: stats.total_active, icon: HiOutlineCheckCircle, color: 'emerald' },
          { label: 'Inactivos', value: stats.total_inactive, icon: HiOutlineXCircle, color: 'gray' },
          { label: 'Nuevos (Semana)', value: stats.new_this_week, icon: HiOutlineUserAdd, color: 'fuchsia' },
          { label: 'Género (M/H)', value: `${stats.female}/${stats.male}`, icon: HiOutlineUserGroup, color: 'blue' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 w-10 h-10 md:w-11 md:h-11 rounded-xl bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center shrink-0`}>
              <s.icon size={18} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0">
               <div className="text-[8px] md:text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">{s.label}</div>
               <div className="text-lg md:text-xl font-black text-gray-900 truncate leading-none mt-1">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative group px-0">
        <HiOutlineSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={18} />
        <input
          name="search-students"
          type="search"
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-white border-2 border-gray-100 rounded-2xl pl-12 pr-6 py-3 md:py-3.5 text-sm md:text-base font-bold focus:border-fuchsia-200 focus:ring-8 focus:ring-fuchsia-50 transition-all outline-none shadow-sm"
          placeholder="Buscar alumno por nombre, email..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white md:rounded-[32px] shadow-sm border-y md:border border-gray-100 overflow-hidden mx-0 md:mx-0">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
             <div className="w-10 h-10 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
             <span className="font-bold text-fuchsia-600/60 uppercase tracking-widest text-[10px]">Sincronizando...</span>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full border-collapse">
                <thead className="hidden md:table-header-group">
                  <tr className="bg-gray-50/50 text-left border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumno</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contacto</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Registro</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Ingreso</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 block md:table-row-group">
                  {paginatedData.map((s) => (
                    <tr key={s.id} className="block md:table-row hover:bg-fuchsia-50/20 transition-colors group">
                      <td className="block md:table-cell px-6 py-3 md:py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center font-black overflow-hidden border-2 border-white shadow-sm shrink-0">
                            {s.photo_url ? <img src={toAbsoluteUrl(s.photo_url)} className="w-full h-full object-cover" /> : `${s.first_name[0]}${s.last_name[0]}`}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-gray-900 group-hover:text-fuchsia-600 transition-colors truncate">{s.first_name} {s.last_name}</div>
                            <div className="text-[9px] font-bold text-gray-400 uppercase">Alumno #{s.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="block md:table-cell px-6 py-1 md:py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                            <HiOutlineMail className="text-fuchsia-400 shrink-0" size={14} /> <span className="truncate max-w-[150px]">{s.email || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 font-bold">
                            <HiOutlinePhone className="text-fuchsia-400 shrink-0" size={14} /> {s.phone || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="block md:table-cell px-6 py-1 md:py-4 text-left md:text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                          {s.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="block md:table-cell px-6 py-1 md:py-4 text-left md:text-center">
                        <div className="flex flex-col items-start md:items-center gap-1">
                          {(s.enrollment_count || 0) > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100">
                              Ingresado con Curso
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">
                              Pendiente Curso
                            </span>
                          )}
                          <span className="text-[7px] font-bold text-gray-400 uppercase tracking-tighter">
                            {s.enrollment_count || 0} inscripciones
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${enrollmentFeeByStudent[s.id] ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                            {enrollmentFeeByStudent[s.id] ? 'Con matrícula' : 'Sin matrícula'}
                          </span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-center font-bold text-xs text-gray-500">
                        {ymdToCL(s.joined_at)}
                      </td>
                      <td className="block md:table-cell px-6 py-3 md:py-4 text-left md:text-right">
                         <div className="flex items-center justify-start md:justify-end gap-2">
                           <button
                             onClick={() => { setSelectedStudent(s); setShowEnroll(true) }}
                             className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white shadow-sm transition-all active:scale-95"
                           >
                             <HiOutlinePlus size={14} />
                             Inscribir
                           </button>
                           <button
                             onClick={() => navigate(`/students/${s.id}`)}
                            className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-lg hover:bg-fuchsia-600 hover:text-white transition-all shadow-sm"
                            title="Ver Perfil"
                          >
                            <HiOutlineEye size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedStudent(s); setShowEdit(true) }}
                            className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:text-gray-600 hover:bg-gray-100 transition-all"
                            title="Editar"
                          >
                            <HiOutlinePencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-2 bg-rose-50 text-rose-400 rounded-lg hover:text-rose-600 hover:bg-rose-100 transition-all"
                            title="Eliminar"
                          >
                            <HiOutlineTrash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Mostrando {paginatedData.length} de {data.length} alumnos
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Ver:</span>
                  <select 
                    value={pageSize} 
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="text-[10px] font-black text-fuchsia-600 outline-none bg-transparent cursor-pointer"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button 
                    disabled={page === 1} 
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 disabled:opacity-30 hover:text-fuchsia-600 transition-all"
                  >
                    <HiOutlineChevronLeft size={18} />
                  </button>
                  <div className="flex gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i + 1)}
                        className={`w-8 h-8 rounded-xl font-black text-[10px] transition-all ${page === i + 1 ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-100' : 'bg-white text-gray-400 hover:bg-gray-50'}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button 
                    disabled={page === totalPages} 
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 rounded-xl bg-white border border-gray-100 text-gray-400 disabled:opacity-30 hover:text-fuchsia-600 transition-all"
                  >
                    <HiOutlineChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showEnroll && selectedStudent && (
        <EnrollStudentModal 
           studentId={selectedStudent.id}
           studentName={`${selectedStudent.first_name} ${selectedStudent.last_name}`}
           onClose={() => setShowEnroll(false)}
           onSuccess={(courseId, enrollmentId) => {
              setShowEnroll(false)
              setPayData({ studentId: selectedStudent.id, courseId, enrollmentId })
              setShowPay(true)
           }}
        />
      )}

      {showPay && payData && (
        <RenewModal 
           isOpen={true}
           studentId={payData.studentId}
           courseId={payData.courseId}
           enrollmentId={payData.enrollmentId}
           onClose={() => { setShowPay(false); setPayData(null); load(); }}
           onSuccess={() => { setShowPay(false); setPayData(null); load(); }}
        />
      )}

      {showCreate && (
        <CreateStudentModal 
           onClose={() => setShowCreate(false)} 
           onSuccess={(student, shouldEnroll) => { 
              setShowCreate(false); 
              load();
              if (shouldEnroll) {
                 setSelectedStudent(student);
                 setShowEnroll(true);
              }
           }} 
        />
      )}
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
