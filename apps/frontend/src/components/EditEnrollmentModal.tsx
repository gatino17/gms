import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { HiOutlineX, HiOutlineCalendar, HiOutlineCheckCircle, HiOutlineExclamationCircle } from 'react-icons/hi'

type Enrollment = {
  id: number
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  course: {
    name: string
  }
}

type Props = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  enrollment: Enrollment
}

export default function EditEnrollmentModal({ isOpen, onClose, onSuccess, enrollment }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    is_active: true
  })

  useEffect(() => {
    if (isOpen) {
      setForm({
        start_date: enrollment.start_date || '',
        end_date: enrollment.end_date || '',
        is_active: enrollment.is_active ?? true
      })
      setError(null)
    }
  }, [isOpen, enrollment])

  if (!isOpen) return null

  const handleSave = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const payload: any = {
        is_active: form.is_active
      }
      
      if (form.start_date) payload.start_date = form.start_date
      else payload.start_date = null

      if (form.end_date) payload.end_date = form.end_date
      else payload.end_date = null

      await api.put(`/api/pms/enrollments/${enrollment.id}`, payload)
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Error al actualizar la inscripción')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-[60]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-gray-100">
            {/* Header */}
            <div className="px-6 py-5 md:px-8 md:py-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between shrink-0">
               <div>
                  <h2 className="text-xl font-black tracking-tight">Editar Inscripción</h2>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">{enrollment.course.name}</p>
               </div>
               <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                  <HiOutlineX size={24} />
               </button>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-6">
               {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
                     <HiOutlineExclamationCircle size={20} className="shrink-0" /> {error}
                  </div>
               )}

               <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Inicio</label>
                     <div className="relative group">
                        <HiOutlineCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                        <input 
                           type="date"
                           value={form.start_date}
                           onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
                           className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-4 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                        />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Vencimiento</label>
                     <div className="relative group">
                        <HiOutlineCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                        <input 
                           type="date"
                           value={form.end_date}
                           onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
                           className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-4 focus:ring-fuchsia-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                        />
                     </div>
                     <p className="text-xs text-gray-400 px-2 leading-relaxed">Útil si quieres otorgar días extra o ajustar el ciclo de pago manualmente.</p>
                  </div>

                  <div className="pt-4 space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Estado del Plan</label>
                     <div className="flex gap-3">
                        <button 
                           onClick={() => setForm(f => ({ ...f, is_active: true }))}
                           className={`flex-1 py-3 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all ${form.is_active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                           <HiOutlineCheckCircle size={18} /> Activo
                        </button>
                        <button 
                           onClick={() => setForm(f => ({ ...f, is_active: false }))}
                           className={`flex-1 py-3 rounded-2xl font-bold text-sm border-2 flex items-center justify-center gap-2 transition-all ${!form.is_active ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                        >
                           <HiOutlineX size={18} /> Pausado / Inactivo
                        </button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 md:px-8 md:py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
               <button onClick={onClose} className="px-6 py-3 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
               <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="px-8 py-3 bg-gray-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-lg shadow-gray-200 hover:bg-fuchsia-600 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
               >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
