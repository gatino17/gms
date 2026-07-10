import { useState, useEffect } from 'react'
import { api, getTenant, toAbsoluteUrl } from '../lib/api'
import { composePhoneWithPrefix, sanitizePhoneInput, stripPhonePrefix } from '../lib/phone'
import { 
  HiOutlineUser, 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineCalendar, 
  HiOutlinePhotograph,
  HiOutlineX,
  HiOutlineChevronRight,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCheckCircle
} from 'react-icons/hi'

type Props = {
  onClose: () => void
  onSuccess: (student: any, shouldEnroll: boolean) => void
}

export default function CreateStudentModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdStudentId, setCreatedStudentId] = useState<number | null>(null)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [tenantPhonePrefix, setTenantPhonePrefix] = useState('+56')
  
  // Student Info
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: '',
    joined_at: new Date().toISOString().slice(0, 10),
    birthdate: '',
    notes: '',
    is_active: true
  })

  const requiredErrors = {
    first_name: !form.first_name.trim(),
    last_name: !form.last_name.trim(),
    phone: !form.phone.trim(),
    gender: !form.gender.trim(),
  }
  const hasRequiredErrors = Object.values(requiredErrors).some(Boolean)

  // Photo
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    const tenantId = getTenant()
    if (!tenantId) return
    api.get('/api/pms/tenants/me', {
      headers: { 'X-Tenant-ID': tenantId },
    }).then((res) => {
      const nextPrefix = res.data?.phone_prefix || '+56'
      setTenantPhonePrefix(nextPrefix)
      setForm((current) => ({
        ...current,
        phone: current.phone ? stripPhonePrefix(current.phone, nextPrefix) : current.phone,
      }))
    }).catch(() => {
      setTenantPhonePrefix('+56')
    })
  }, [])

  const handleSave = async (shouldEnroll: boolean = false) => {
    setAttemptedSubmit(true)
    if (hasRequiredErrors) {
      setError('Completa los campos obligatorios marcados en rojo.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      let student = null
      let studentId = createdStudentId

      if (!studentId) {
        // First attempt: Create student
        const payload = {
          ...form,
          phone: composePhoneWithPrefix(form.phone, tenantPhonePrefix),
          birthdate: form.birthdate?.trim() ? form.birthdate : null,
        }
        const res = await api.post('/api/pms/students', payload)
        student = res.data
        studentId = student.id
        setCreatedStudentId(studentId)
      } else {
        // Retry attempt: Update existing student
        const payload = {
          ...form,
          phone: composePhoneWithPrefix(form.phone, tenantPhonePrefix),
          birthdate: form.birthdate?.trim() ? form.birthdate : null,
        }
        const res = await api.put(`/api/pms/students/${studentId}`, payload)
        student = res.data
      }
      
      if (imageFile) {
        const fd = new FormData()
        fd.append('file', imageFile)
        await api.post(`/api/pms/students/${studentId}/photo`, fd)
        
        // Refresh student data after photo upload to get the photo_url
        const refreshRes = await api.get(`/api/pms/students/${studentId}`)
        student = refreshRes.data
      }
      
      onSuccess(student, shouldEnroll)
    } catch (e: any) {
      const detail = e.response?.data?.detail
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '))
      } else {
        setError(detail || 'Error al crear alumno')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-[60]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Scrollable container */}
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="px-6 py-5 md:px-8 md:py-6 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white flex items-center justify-between shrink-0">
           <div>
              <h2 className="text-2xl font-black tracking-tight">Nuevo Registro de Alumno</h2>
              <p className="text-fuchsia-100 text-xs font-bold uppercase tracking-widest mt-1">Completa el perfil oficial del estudiante</p>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
              <HiOutlineX size={24} />
           </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-8 custom-scrollbar">
           {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
                 <HiOutlineX className="shrink-0" /> {error}
              </div>
           )}

           <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Left Column: Image & Basic */}
              <div className="lg:col-span-4 space-y-8">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fotografía de Perfil</label>
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

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Estado del Alumno</label>
                    <button 
                       onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                       className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${form.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
                    >
                       <span className="font-black uppercase tracking-widest text-xs">{form.is_active ? 'Cuenta Activa' : 'Cuenta Inactiva'}</span>
                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${form.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'}`}>
                          <HiOutlineCheckCircle size={18} />
                       </div>
                    </button>
                 </div>
              </div>

              {/* Right Column: Form */}
              <div className="lg:col-span-8 space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className={`text-[10px] font-black uppercase tracking-widest px-2 ${attemptedSubmit && requiredErrors.first_name ? 'text-rose-600' : 'text-gray-400'}`}>Nombres <span className="text-rose-500">*</span></label>
                       <input 
                          value={form.first_name}
                          onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                          placeholder="Ej. Alejandro"
                          className={`w-full px-6 py-4 bg-gray-50 border-2 rounded-2xl font-bold text-gray-700 transition-all outline-none ${attemptedSubmit && requiredErrors.first_name ? 'border-rose-400 focus:border-rose-500 focus:bg-white focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50'}`}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className={`text-[10px] font-black uppercase tracking-widest px-2 ${attemptedSubmit && requiredErrors.last_name ? 'text-rose-600' : 'text-gray-400'}`}>Apellidos <span className="text-rose-500">*</span></label>
                       <input 
                          value={form.last_name}
                          onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                          placeholder="Ej. García"
                          className={`w-full px-6 py-4 bg-gray-50 border-2 rounded-2xl font-bold text-gray-700 transition-all outline-none ${attemptedSubmit && requiredErrors.last_name ? 'border-rose-400 focus:border-rose-500 focus:bg-white focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50'}`}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Correo Electrónico</label>
                       <input 
                          value={form.email}
                          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="ejemplo@correo.com"
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
	                    <div className="space-y-2">
	                       <label className={`text-[10px] font-black uppercase tracking-widest px-2 ${attemptedSubmit && requiredErrors.phone ? 'text-rose-600' : 'text-gray-400'}`}>WhatsApp / Teléfono <span className="text-rose-500">*</span></label>
	                       <div className={`flex items-stretch overflow-hidden rounded-2xl border-2 bg-gray-50 transition-all ${attemptedSubmit && requiredErrors.phone ? 'border-rose-400 focus-within:border-rose-500 focus-within:bg-white focus-within:ring-8 focus-within:ring-rose-50' : 'border-transparent focus-within:border-fuchsia-200 focus-within:bg-white focus-within:ring-8 focus-within:ring-fuchsia-50'}`}>
	                          <div className="flex items-center px-5 bg-fuchsia-50 text-fuchsia-600 text-sm font-black tracking-widest border-r border-fuchsia-100">
	                            {tenantPhonePrefix}
	                          </div>
	                          <input
	                             value={form.phone}
	                             onChange={(e) => setForm(f => ({ ...f, phone: stripPhonePrefix(sanitizePhoneInput(e.target.value), tenantPhonePrefix) }))}
	                             placeholder="9 1234 5678"
	                             inputMode="tel"
	                             className="w-full px-5 py-4 bg-transparent font-bold text-gray-700 outline-none"
	                          />
	                       </div>
	                       <p className="px-2 text-[10px] font-bold text-gray-400">
	                         Se guardará como {tenantPhonePrefix} seguido del número ingresado.
	                       </p>
	                    </div>
                    <div className="space-y-2">
                       <label className={`text-[10px] font-black uppercase tracking-widest px-2 ${attemptedSubmit && requiredErrors.gender ? 'text-rose-600' : 'text-gray-400'}`}>Género <span className="text-rose-500">*</span></label>
                       <select 
                          value={form.gender}
                          onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                          className={`w-full px-6 py-4 bg-gray-50 border-2 rounded-2xl font-bold text-gray-700 transition-all outline-none appearance-none ${attemptedSubmit && requiredErrors.gender ? 'border-rose-400 focus:border-rose-500 focus:bg-white focus:ring-8 focus:ring-rose-50' : 'border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50'}`}
                       >
                          <option value="">Seleccionar...</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Otro">Otro</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Nacimiento</label>
                       <input 
                          type="date"
                          value={form.birthdate}
                          onChange={(e) => setForm(f => ({ ...f, birthdate: e.target.value }))}
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Notas Adicionales</label>
                    <textarea 
                       value={form.notes}
                       onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                       placeholder="Información médica, nivel de danza, etc..."
                       rows={3}
                       className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none resize-none"
                    />
                 </div>
              </div>
           </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 md:px-8 md:py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
           <button onClick={onClose} className="px-4 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
           
           <button 
              onClick={() => handleSave(false)}
              disabled={loading}
              className="px-6 py-4 bg-white border-2 border-gray-200 text-gray-700 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-gray-100 disabled:opacity-50 transition-all flex items-center gap-2"
           >
              {loading ? '...' : 'Solo Guardar'}
           </button>

           <button 
              onClick={() => handleSave(true)}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
           >
              {loading ? 'Procesando...' : 'Guardar y Pagar'} <HiOutlineChevronRight size={16} />
           </button>
        </div>
        </div>
      </div>
    </div>
  </div>
  )
}

