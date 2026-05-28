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
  HiOutlineTrash,
} from 'react-icons/hi'

type Props = {
  onClose: () => void
  onSuccess: () => void
}

export default function CreateTeacherModal({ onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})
  const [formRequiredError, setFormRequiredError] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    join_date: new Date().toISOString().slice(0, 10),
    birthdate: '',
    styles: '',
  })

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const hasErr = (k: string) => Boolean(fieldErrors[k])
  const clearErr = (k: string) => setFieldErrors((prev) => ({ ...prev, [k]: false }))

  const sanitizePhone = (raw: string) => raw.replace(/[^\d+\s()-]/g, '')
  const isValidPhone = (phone: string) => {
    const val = phone.trim()
    if (!val) return false
    if (!/^[+\d\s()-]+$/.test(val)) return false
    return /\d/.test(val)
  }

  const fieldClass = (key: string) =>
    `w-full pl-14 pr-6 py-4 bg-gray-50 border-2 rounded-2xl font-bold text-gray-700 transition-all outline-none ${
      hasErr(key)
        ? 'border-rose-400 focus:border-rose-500 focus:bg-white focus:ring-8 focus:ring-rose-50'
        : 'border-transparent focus:border-fuchsia-200 focus:bg-white focus:ring-8 focus:ring-fuchsia-50'
    }`

  const handleSave = async () => {
    const nextErrors: Record<string, boolean> = {}

    if (!form.name.trim()) nextErrors.name = true
    if (!form.email.trim()) nextErrors.email = true
    if (!isValidPhone(form.phone)) nextErrors.phone = true
    if (!form.join_date) nextErrors.join_date = true
    if (!form.birthdate) nextErrors.birthdate = true
    if (!form.styles.trim()) nextErrors.styles = true

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      setFormRequiredError(true)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setFormRequiredError(false)
    setFieldErrors({})

    try {
      const payload: any = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        bio: form.bio || undefined,
        join_date: form.join_date,
        birthdate: form.birthdate,
        styles: form.styles.trim(),
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
    <div className="relative z-[60]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:p-8">
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-4rem)] overflow-hidden flex flex-col border border-gray-100">
            <div className="px-6 py-5 md:px-8 md:py-6 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Registro de Profesor</h2>
                <p className="text-fuchsia-100 text-xs font-bold uppercase tracking-widest mt-1">Completa el perfil profesional del instructor</p>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
                <HiOutlineX size={24} />
              </button>
            </div>

            <div className="p-6 md:p-8 flex-1 min-h-0 overflow-y-auto space-y-6 custom-scrollbar">
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3">
                  <HiOutlineX className="shrink-0" /> {error}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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

                <div className="lg:col-span-8 space-y-8">
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
                            onChange={(e) => {
                              setForm((f) => ({ ...f, name: e.target.value }))
                              if (e.target.value.trim()) {
                                clearErr('name')
                                setFormRequiredError(false)
                              }
                            }}
                            placeholder="Ej. Juan Pérez"
                            className={fieldClass('name')}
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
                            onChange={(e) => {
                              setForm((f) => ({ ...f, email: e.target.value }))
                              if (e.target.value.trim()) {
                                clearErr('email')
                                setFormRequiredError(false)
                              }
                            }}
                            placeholder="juan@ejemplo.com"
                            className={fieldClass('email')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Teléfono / WhatsApp</label>
                        <div className="relative group">
                          <HiOutlinePhone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                          <input
                            value={form.phone}
                            onChange={(e) => {
                              const clean = sanitizePhone(e.target.value)
                              setForm((f) => ({ ...f, phone: clean }))
                              if (isValidPhone(clean)) {
                                clearErr('phone')
                                setFormRequiredError(false)
                              }
                            }}
                            placeholder="+56 9 ..."
                            className={fieldClass('phone')}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

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
                            onChange={(e) => {
                              setForm((f) => ({ ...f, join_date: e.target.value }))
                              if (e.target.value) {
                                clearErr('join_date')
                                setFormRequiredError(false)
                              }
                            }}
                            className={fieldClass('join_date')}
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
                            onChange={(e) => {
                              setForm((f) => ({ ...f, birthdate: e.target.value }))
                              if (e.target.value) {
                                clearErr('birthdate')
                                setFormRequiredError(false)
                              }
                            }}
                            className={fieldClass('birthdate')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Especialidades / Estilos</label>
                        <div className="relative group">
                          <HiOutlineTag className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                          <input
                            value={form.styles}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, styles: e.target.value }))
                              if (e.target.value.trim()) {
                                clearErr('styles')
                                setFormRequiredError(false)
                              }
                            }}
                            placeholder="Salsa, Bachata, Ballet..."
                            className={fieldClass('styles')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Biografía Profesional</label>
                        <div className="relative group">
                          <HiOutlineDocumentText className="absolute left-5 top-6 text-gray-400 group-focus-within:text-fuchsia-500 transition-colors" size={20} />
                          <textarea
                            value={form.bio}
                            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
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

            <div className="px-6 py-4 md:px-8 md:py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              {formRequiredError && (
                <p className="mr-auto text-center text-rose-600 text-[10px] md:text-xs font-black uppercase tracking-wider bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
                  faltan campos obligatorios
                </p>
              )}
              <button onClick={onClose} className="px-8 py-4 font-black uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-10 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-fuchsia-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? 'Procesando...' : 'Registrar Profesor'} <HiOutlineChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
