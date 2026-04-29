import { useState } from 'react'
import { api } from '../lib/api'
import { 
  HiOutlineX, 
  HiOutlineChevronRight, 
  HiOutlineCalendar, 
  HiOutlineCurrencyDollar,
  HiOutlineCreditCard,
  HiOutlineSwitchHorizontal,
  HiOutlineClipboardList
} from 'react-icons/hi'

type Payment = {
  id: number
  amount: number
  method: string
  type: string
  payment_date: string
  reference?: string | null
  notes?: string | null
}

type Props = {
  payment: Payment
  onClose: () => void
  onSuccess: () => void
}

const fmtCLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })

export default function EditPaymentModal({ payment, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    amount: String(payment.amount),
    method: payment.method,
    type: payment.type,
    payment_date: payment.payment_date,
    reference: payment.reference || '',
    notes: payment.notes || ''
  })

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.put(`/api/pms/payments/${payment.id}`, {
        amount: Number(form.amount || 0),
        method: form.method,
        type: form.type,
        payment_date: form.payment_date,
        reference: form.reference || undefined,
        notes: form.notes || undefined
      })
      onSuccess()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Error al actualizar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="px-10 py-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shrink-0">
           <div>
              <h2 className="text-2xl font-black tracking-tight">Editar Pago</h2>
              <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">ID Transacción: #{payment.id}</p>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
              <HiOutlineX size={24} />
           </button>
        </div>

        {/* Content */}
        <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
           {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
                 <HiOutlineX className="shrink-0" /> {error}
              </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fecha */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Fecha de Pago</label>
                 <div className="relative group">
                    <HiOutlineCalendar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                       type="date"
                       value={form.payment_date}
                       onChange={(e) => setForm(f => ({ ...f, payment_date: e.target.value }))}
                       className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-200 focus:bg-white focus:ring-8 focus:ring-emerald-50 rounded-2xl font-bold text-gray-700 transition-all outline-none"
                    />
                 </div>
              </div>

              {/* Monto */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Monto del Pago</label>
                 <div className="relative group">
                    <HiOutlineCurrencyDollar className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <input 
                       type="number"
                       value={form.amount}
                       onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                       className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-200 focus:bg-white focus:ring-8 focus:ring-emerald-50 rounded-2xl font-black text-xl text-gray-700 transition-all outline-none"
                    />
                 </div>
              </div>

              {/* Método */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Método de Pago</label>
                 <div className="relative group">
                    <HiOutlineCreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <select 
                       value={form.method}
                       onChange={(e) => setForm(f => ({ ...f, method: e.target.value }))}
                       className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-200 focus:bg-white focus:ring-8 focus:ring-emerald-50 rounded-2xl font-bold text-gray-700 transition-all outline-none appearance-none"
                    >
                       <option value="cash">Efectivo</option>
                       <option value="card">Tarjeta / Débito</option>
                       <option value="transfer">Transferencia</option>
                       <option value="agreement">Convenio</option>
                    </select>
                 </div>
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Tipo de Pago</label>
                 <div className="relative group">
                    <HiOutlineSwitchHorizontal className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <select 
                       value={form.type}
                       onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                       className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-200 focus:bg-white focus:ring-8 focus:ring-emerald-50 rounded-2xl font-bold text-gray-700 transition-all outline-none appearance-none"
                    >
                       <option value="monthly">Mensualidad</option>
                       <option value="single_class">Clase suelta</option>
                       <option value="rental">Arriendo</option>
                       <option value="agreement">Convenio</option>
                    </select>
                 </div>
              </div>

              {/* Referencia */}
              <div className="space-y-2 md:col-span-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Referencia / Observaciones</label>
                 <div className="relative group">
                    <HiOutlineClipboardList className="absolute left-5 top-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                    <textarea 
                       value={form.notes}
                       onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                       rows={3}
                       className="w-full pl-14 pr-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-200 focus:bg-white focus:ring-8 focus:ring-emerald-50 rounded-2xl font-bold text-gray-700 transition-all outline-none resize-none"
                       placeholder="Detalles adicionales del pago..."
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
              disabled={loading || !form.amount}
              className="px-10 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-emerald-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
           >
              {loading ? 'Guardando...' : 'Guardar Cambios'} <HiOutlineChevronRight size={16} />
           </button>
        </div>
      </div>
    </div>
  )
}
