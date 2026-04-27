import { useState, useEffect } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'
import { 
  HiOutlineUser, 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineCalendar, 
  HiOutlinePhotograph,
  HiOutlineX,
  HiOutlineChevronRight,
  HiOutlineTrash,
  HiOutlineCheckCircle
} from 'react-icons/hi'

type Student = {
  id: number
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  gender?: string | null
  photo_url?: string | null
  joined_at?: string | null
  birthdate?: string | null
  notes?: string | null
  is_active?: boolean
}

type Props = {
  student: Student
  onClose: () => void
  onSuccess: () => void
}

export default function EditStudentModal({ student, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    first_name: student.first_name || '',
    last_name: student.last_name || '',
    email: student.email || '',
    phone: student.phone || '',
    gender: student.gender || '',
    birthdate: student.birthdate || '',
    notes: student.notes || '',
    is_active: student.is_active ?? true
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(student.photo_url || null)

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.put(`/api/pms/students/${student.id}`, form)
      
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        await api.post(`/api/pms/students/${student.id}/photo`, fd)
      }
      
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error al actualizar alumno')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="px-10 py-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
           <div>
              <h2 className="text-2xl font-black tracking-tight">Editar Perfil del Alumno</h2>
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Actualizando información de ID: #{student.id}</p>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
              <HiOutlineX size={24} />
           </button>
        </div>

        {/* Content */}
        <div className="p-10 overflow-y-auto space-y-10 custom-scrollbar">
           {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
                 <HiOutlineX className="shrink-0" /> {error}
              </div>
           )}

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fotografía</label>
                    <div className="relative group">
                       <div className="w-full aspect-square rounded-[40px] bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-indigo-300">
                          {imagePreview ? (
                             <img src={imagePreview.startsWith('http') || imagePreview.startsWith('/static') ? toAbsoluteUrl(imagePreview) : imagePreview} className="w-full h-full object-cover" />
                          ) : (
                             <div className="text-center p-6">
                                <HiOutlinePhotograph size={48} className="mx-auto text-gray-300 group-hover:text-indigo-400 transition-colors" />
                                <p className="text-[10px] font-black text-gray-400 mt-4 uppercase tracking-widest">JPG o PNG</p>
                             </div>
                          )}
                          <input 
                             type="file" 
                             className="absolute inset-0 opacity-0 cursor-pointer" 
                             accept="image/*"
                             onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                   setImageFile(file)
                                   setImagePreview(URL.createObjectURL(file))
                                }
                             }}
                          />
                       </div>
                       {imagePreview && (
                          <button onClick={() => { setImageFile(null); setImagePreview(null); setForm(f=>({...f, photo_url:''})) }} className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg hover:bg-rose-600 transition-colors">
                             <HiOutlineTrash size={16} />
                          </button>
                       )}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Estado de Cuenta</label>
                    <button 
                       onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                       className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${form.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                    >
                       <span className="font-black uppercase tracking-widest text-xs">{form.is_active ? 'Activa' : 'Inactiva'}</span>
                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${form.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'}`}>
                          <HiOutlineCheckCircle size={18} />
                       </div>
                    </button>
                 </div>
              </div>

              <div className="lg:col-span-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombres</label>
                       <input 
                          value={form.first_name}
                          onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Apellidos</label>
                       <input 
                          value={form.last_name}
                          onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Email</label>
                       <input 
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">WhatsApp</label>
                       <input 
                          value={form.phone}
                          onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Género</label>
                       <select 
                          value={form.gender}
                          onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none appearance-none"
                       >
                          <option value="">Seleccionar...</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Otro">Otro</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nacimiento</label>
                       <input 
                          type="date"
                          value={form.birthdate}
                          onChange={(e) => setForm(f => ({ ...f, birthdate: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Notas</label>
                    <textarea 
                       value={form.notes}
                       onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                       rows={3}
                       className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white focus:ring-8 focus:ring-indigo-50 rounded-2xl font-bold text-gray-700 transition-all outline-none resize-none"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-4 shrink-0">
           <button onClick={onClose} className="px-8 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
           <button 
              onClick={handleSave}
              disabled={loading || !form.first_name || !form.last_name}
              className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
           >
              {loading ? 'Guardando...' : 'Actualizar Perfil'} <HiOutlineChevronRight size={16} />
           </button>
        </div>
      </div>
    </div>
  )
}
