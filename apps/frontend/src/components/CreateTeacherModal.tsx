import { useState } from 'react'
import { api } from '../lib/api'
import { 
  HiOutlineUser, 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineCalendar, 
  HiOutlineX,
  HiOutlineChevronRight,
  HiOutlineTag,
  HiOutlineDocumentText,
  HiOutlinePhotograph,
  HiOutlineTrash
} from 'react-icons/hi'

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateTeacherModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    join_date: new Date().toISOString().slice(0, 10),
    birthdate: '',
    styles: ''
  })

  // Photo
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        bio: form.bio || undefined,
        join_date: form.join_date || undefined,
        birthdate: form.birthdate || undefined,
        styles: form.styles || undefined,
      }
      const res = await api.post('/api/pms/teachers', payload)
      const teacherId = res.data.id

      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        await api.post(`/api/pms/teachers/${teacherId}/photo`, fd)
      }

      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Error al crear profesor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="px-10 py-8 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white flex items-center justify-between shrink-0">
           <div>
              <h2 className="text-2xl font-black tracking-tight">Registro de Profesor</h2>
              <p className="text-fuchsia-100 text-xs font-bold uppercase tracking-widest mt-1">Completa el perfil profesional del instructor</p>
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
              {/* Left Column: Photo */}
              <div className="lg:col-span-4 space-y-6">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fotografía Profesional</label>
                    <div className="relative group">
                       <div className="w-full aspect-square rounded-[40px] bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-fuchsia-300">
                          {imagePreview ? (
                             <img src={imagePreview} className="w-full h-full object-cover" />
                          ) : (
                             <div className="text-center p-6">
                                <HiOutlinePhotograph size={48} className="mx-auto text-gray-300 group-hover:text-fuchsia-400 transition-colors" />
                                <p className="text-[10px] font-black text-gray-400 mt-4 uppercase tracking-widest">JPG o PNG (Máx 2MB)</p>
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
                          <button onClick={() => { setImageFile(null); setImagePreview(null) }} className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-xl shadow-lg hover:bg-rose-600 transition-colors">
                             <HiOutlineTrash size={16} />
                          </button>
                       )}
                    </div>
                 </div>
                 <div className="p-6 bg-fuchsia-50 rounded-3xl border border-fuchsia-100">
                    <p className="text-xs text-fuchsia-700 font-medium leading-relaxed">
                      La fotografía será visible en el listado de profesores y en el portal de alumnos.
                    </p>
                 </div>
              </div>

              {/* Right Column: Form Sections */}
              <div className="lg:col-span-8 space-y-8">
                 {/* Section: Basic Info */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 px-2">
                       <div className="w-1.5 h-4 bg-fuchsia-500 rounded-full" />
                       <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Información Básica</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre Completo</label>
                          <div className="relative group">
                             <HiOutlineUser className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <input 
                                value={form.name}
                                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Ej. Juan Pérez"
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Correo Electrónico</label>
                          <div className="relative group">
                             <HiOutlineMail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <input 
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="juan@ejemplo.com"
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Teléfono / WhatsApp</label>
                          <div className="relative group">
                             <HiOutlinePhone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <input 
                                value={form.phone}
                                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+56 9 ..."
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                             />
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Section: Professional Details */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-2 px-2">
                       <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                       <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Detalles Profesionales</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Ingreso</label>
                          <div className="relative group">
                             <HiOutlineCalendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <input 
                                type="date"
                                value={form.join_date}
                                onChange={(e) => setForm(f => ({ ...f, join_date: e.target.value }))}
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Nacimiento</label>
                          <div className="relative group">
                             <HiOutlineCalendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <input 
                                type="date"
                                value={form.birthdate}
                                onChange={(e) => setForm(f => ({ ...f, birthdate: e.target.value }))}
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Especialidades / Estilos</label>
                          <div className="relative group">
                             <HiOutlineTag className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <input 
                                value={form.styles}
                                onChange={(e) => setForm(f => ({ ...f, styles: e.target.value }))}
                                placeholder="Salsa, Bachata, Ballet..."
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                             />
                          </div>
                       </div>
                       <div className="space-y-2 md:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Biografía Profesional</label>
                          <div className="relative group">
                             <HiOutlineDocumentText className="absolute left-5 top-6 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                             <textarea 
                                value={form.bio}
                                onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                                placeholder="Describe la trayectoria y experiencia del profesor..."
                                rows={4}
                                className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none resize-none"
                             />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-4 shrink-0">
           <button onClick={onClose} className="px-8 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
           <button 
              onClick={handleSave}
              disabled={loading || !form.name.trim()}
              className="px-10 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
           >
              {loading ? 'Procesando...' : 'Registrar Profesor'} <HiOutlineChevronRight size={16} />
           </button>
        </div>
      </div>
    </div>
  )
}
