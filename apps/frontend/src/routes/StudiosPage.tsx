import { FormEvent, useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'

type StudioForm = {
  name: string
  email: string
  password: string
  address: string
  country: string
  city: string
  phone: string
  instagram_url: string
  tiktok_url: string
  facebook_url: string
  website_url: string
  is_superuser: boolean
  currency: string
}

type StudioUpdateForm = {
  name: string
  email: string
  password: string
  address: string
  country: string
  city: string
  phone: string
  logo_url: string
  instagram_url: string
  tiktok_url: string
  facebook_url: string
  website_url: string
  is_superuser: boolean
  currency: string
}

type Studio = {
  id: number
  name: string
  slug: string
  contact_email?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  phone?: string | null
  logo_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  facebook_url?: string | null
  website_url?: string | null
  created_at: string
  admin_is_superuser?: boolean | null
  currency?: string | null
}

const defaultForm: StudioForm = {
  name: '',
  email: '',
  password: '',
  address: '',
  country: '',
  city: '',
  phone: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  website_url: '',
  is_superuser: false,
  currency: 'CLP',
}

const defaultEditForm: StudioUpdateForm = {
  name: '',
  email: '',
  password: '',
  address: '',
  country: '',
  city: '',
  phone: '',
  logo_url: '',
  instagram_url: '',
  tiktok_url: '',
  facebook_url: '',
  website_url: '',
  is_superuser: false,
  currency: 'CLP',
}

const normalizeOptional = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

export default function StudiosPage() {
  const [form, setForm] = useState<StudioForm>(defaultForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [studios, setStudios] = useState<Studio[]>([])
  const [isLoadingStudios, setIsLoadingStudios] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Studio | null>(null)
  const [editForm, setEditForm] = useState<StudioUpdateForm>(defaultEditForm)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null)
  const [createLogoPreview, setCreateLogoPreview] = useState<string>('')

  const fetchStudios = async () => {
    setIsLoadingStudios(true)
    setListError(null)
    try {
      const { data } = await api.get<Studio[]>('/api/pms/tenants')
      setStudios(data)
    } catch (err: any) {
      setListError(err?.message || 'No se pudieron cargar los estudios.')
    } finally {
      setIsLoadingStudios(false)
    }
  }

  useEffect(() => {
    fetchStudios()
  }, [])

  useEffect(() => {
    if (editTarget) {
      setEditForm({
        name: editTarget.name,
        email: editTarget.contact_email ?? '',
        password: '',
        address: editTarget.address ?? '',
        country: editTarget.country ?? '',
        city: editTarget.city ?? '',
        phone: editTarget.phone ?? '',
        logo_url: editTarget.logo_url ?? '',
        instagram_url: editTarget.instagram_url ?? '',
        tiktok_url: editTarget.tiktok_url ?? '',
        facebook_url: editTarget.facebook_url ?? '',
        website_url: editTarget.website_url ?? '',
        is_superuser: !!editTarget.admin_is_superuser,
        currency: editTarget.currency ?? 'CLP',
      })
      setEditMessage(null)
      setEditError(null)
      setShowNewPassword(false)
    } else {
      setEditForm(defaultEditForm)
    }
  }, [editTarget])

  const handleChange = (field: keyof StudioForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value as any }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSuccess(null)
    setError(null)

    try {
      const { data } = await api.post<Studio>('/api/pms/tenants', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        address: normalizeOptional(form.address),
        country: normalizeOptional(form.country),
        city: normalizeOptional(form.city),
        phone: normalizeOptional(form.phone),
        instagram_url: normalizeOptional(form.instagram_url),
        tiktok_url: normalizeOptional(form.tiktok_url),
        facebook_url: normalizeOptional(form.facebook_url),
        website_url: normalizeOptional(form.website_url),
        is_superuser: !!form.is_superuser,
        currency: form.currency,
      })
      if (createLogoFile) {
        try {
          await uploadLogoForTenant(data.id, createLogoFile)
          setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug} (logo subido)`)
        } catch (e: any) {
          setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug} (logo no se pudo subir)`)
        }
      } else {
        setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug}`)
      }
      setForm(defaultForm)
      setCreateLogoFile(null)
      setCreateLogoPreview('')
      await fetchStudios()
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear el estudio.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!editTarget) return
    setIsUpdating(true)
    setEditMessage(null)
    setEditError(null)

    try {
      const { data } = await api.put<Studio>(`/api/pms/tenants/${editTarget.id}`, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
        address: normalizeOptional(editForm.address),
        country: normalizeOptional(editForm.country),
        city: normalizeOptional(editForm.city),
        phone: normalizeOptional(editForm.phone),
        logo_url: normalizeOptional(editForm.logo_url),
        instagram_url: normalizeOptional(editForm.instagram_url),
        tiktok_url: normalizeOptional(editForm.tiktok_url),
        facebook_url: normalizeOptional(editForm.facebook_url),
        website_url: normalizeOptional(editForm.website_url),
        is_superuser: !!editForm.is_superuser,
        currency: editForm.currency,
      })
      setEditMessage('Estudio actualizado correctamente.')
      setSuccess('Estudio actualizado correctamente.')
      setEditTarget(null)
      await fetchStudios()
    } catch (err: any) {
      setEditError(err?.message || 'No se pudo actualizar el estudio.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (tenantId: number) => {
    const target = studios.find((s) => s.id === tenantId)
    if (!target) return
    if (!window.confirm(`Eliminar el estudio ${target.name}? Esta accion no se puede deshacer.`)) return

    setDeletingId(tenantId)
    setError(null)
    setSuccess(null)
    try {
      await api.delete(`/api/pms/tenants/${tenantId}`)
      if (editTarget?.id === tenantId) {
        setEditTarget(null)
      }
      setSuccess('Estudio eliminado correctamente.')
      await fetchStudios()
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el estudio.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUploadLogo = async (file: File) => {
    if (!editTarget) return
    setEditError(null)
    setEditMessage(null)
    try {
      setUploadingLogo(true)
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<{ url: string }>('/api/pms/tenants/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Tenant-ID': editTarget.id },
      })
      setEditForm((prev) => ({ ...prev, logo_url: data.url }))
      setEditTarget((prev) => (prev ? { ...prev, logo_url: data.url } : prev))
      setEditMessage('Logo actualizado.')
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || err?.message || 'No se pudo subir el logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const uploadLogoForTenant = async (tenantId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    await api.post<{ url: string }>('/api/pms/tenants/upload-logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data', 'X-Tenant-ID': tenantId },
    })
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 md:space-y-12 pb-20 px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
           <span className="text-[9px] md:text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Administración Central</span>
           <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-none">Estudios</h1>
           <p className="text-gray-500 font-medium text-sm md:text-lg">Gestión de sedes y configuración de tenants.</p>
        </div>
      </div>

      <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-sm space-y-8">
        <div>
          <h2 className="text-lg md:text-xl font-black text-gray-900">Registrar Nuevo Estudio</h2>
          <p className="text-gray-400 text-xs md:text-sm font-medium">El tenant se asignará de forma automática según el nombre.</p>
        </div>

        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre del estudio</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="Estudio Norte"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Correo administrador</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="admin@estudio.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Clave inicial</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="********"
              />
            </div>
            <div className="flex items-center gap-3 px-2">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${form.is_superuser ? 'bg-fuchsia-600 border-fuchsia-600' : 'border-gray-200'}`}>
                 <input
                    id="is_superuser"
                    type="checkbox"
                    checked={form.is_superuser}
                    onChange={(e) => handleChange('is_superuser', e.target.checked)}
                    className="hidden"
                  />
                  {form.is_superuser && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <label htmlFor="is_superuser" className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer">Admin Superusuario</label>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Direccion</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="Av. Principal 123"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Pais / Ciudad</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="Chile"
                />
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="Santiago"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Telefono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Moneda</label>
              <select
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
              >
                <option value="CLP">CLP - Peso Chileno ($)</option>
                <option value="ARS">ARS - Peso Argentino ($)</option>
                <option value="USD">USD - Dólar Estadounidense (US$)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Redes Sociales (Insta / TikTok)</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.instagram_url}
                  onChange={(e) => handleChange('instagram_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="@insta"
                />
                <input
                  type="text"
                  value={form.tiktok_url}
                  onChange={(e) => handleChange('tiktok_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="@tiktok"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Sitio Web / Facebook</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={form.website_url}
                  onChange={(e) => handleChange('website_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="www..."
                />
                <input
                  type="text"
                  value={form.facebook_url}
                  onChange={(e) => handleChange('facebook_url', e.target.value)}
                  className="w-full px-5 py-3 md:py-4 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none"
                  placeholder="fb..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Logo</label>
              <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
                  {createLogoPreview ? (
                    <img src={createLogoPreview} alt="logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[8px] font-black text-gray-300 uppercase">Logo</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest cursor-pointer hover:text-fuchsia-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setCreateLogoFile(file)
                        setCreateLogoPreview(URL.createObjectURL(file))
                      }}
                    />
                    Subir Imagen
                  </label>
                  {createLogoPreview && (
                    <button
                      type="button"
                      className="block text-[8px] font-black text-rose-500 uppercase tracking-widest"
                      onClick={() => {
                        setCreateLogoFile(null)
                        setCreateLogoPreview('')
                      }}
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {success && <div className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest text-center">{success}</div>}
          {error && <div className="p-4 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-600 text-xs font-black uppercase tracking-widest text-center">{error}</div>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all"
            >
              {isSubmitting ? 'Procesando...' : 'Crear Sede / Estudio'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900">Estudios Registrados</h2>
            <p className="text-gray-400 text-sm font-medium">Listado global de sedes activas.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{studios.length} Sedes</span>
          </div>
        </div>
        <div className="p-0 sm:p-4">
          {isLoadingStudios ? (
            <div className="p-10 flex flex-col items-center gap-4">
               <div className="w-10 h-10 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin" />
               <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest">Sincronizando...</span>
            </div>
          ) : listError ? (
            <div className="p-10 text-rose-500 text-center font-black uppercase text-xs">{listError}</div>
          ) : studios.length === 0 ? (
            <div className="p-10 text-gray-400 text-center font-black uppercase text-xs">No hay estudios registrados.</div>
          ) : (
            <div className="overflow-x-auto no-scrollbar">
              <table className="min-w-full text-sm">
                <thead className="hidden md:table-header-group bg-gray-50/50">
                  <tr className="text-left border-b border-gray-100">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tenant</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estudio / Admin</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ubicación</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Logo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 block md:table-row-group">
                  {studios.map((studio) => (
                  <tr key={studio.id} className="block md:table-row hover:bg-fuchsia-50/10 transition-colors">
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="md:hidden text-[8px] font-black text-gray-400 uppercase mb-1">Tenant ID</div>
                      <span className="font-mono text-xs font-black text-fuchsia-600 bg-fuchsia-50 px-3 py-1.5 rounded-lg">{studio.slug}</span>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="font-black text-gray-900 text-base">{studio.name}</div>
                      <div className="text-[10px] font-bold text-gray-400 truncate">{studio.contact_email}</div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                      <div className="text-xs font-black text-gray-700">{studio.address || 'Sin dirección'}</div>
                      <div className="text-[10px] font-bold text-gray-400">{studio.city}, {studio.country}</div>
                    </td>
                    <td className="block md:table-cell px-6 py-4 md:py-6 align-middle text-center">
                        <div className="flex justify-center">
                          {studio.logo_url ? (
                            <img
                              src={toAbsoluteUrl(studio.logo_url)}
                              alt={studio.name}
                              className="h-10 w-10 md:h-12 md:w-12 object-cover rounded-xl border border-gray-100 bg-white shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                               <span className="text-[8px] font-black text-gray-300 uppercase">Sin Logo</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="block md:table-cell px-6 py-4 md:py-6 align-middle">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-fuchsia-600 hover:bg-fuchsia-50 hover:border-fuchsia-100 transition-all"
                            onClick={() => setEditTarget(studio)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.732-6.732a2.5 2.5 0 113.536 3.536L12.536 14.5 9 15.5l1-3.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="p-2.5 rounded-xl border border-gray-100 text-gray-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-all disabled:opacity-30"
                            onClick={() => handleDelete(studio.id)}
                            disabled={deletingId === studio.id}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto no-scrollbar border border-gray-100 flex flex-col">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-20 flex items-center justify-between px-8 py-6 border-b border-gray-50">
              <div>
                <h2 className="text-xl font-black text-gray-900">Editar Estudio</h2>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-2 py-0.5 rounded-lg">Tenant</span>
                   <span className="font-mono text-xs font-bold text-gray-500">{editTarget.slug}</span>
                </div>
              </div>
              <button onClick={() => setEditTarget(null)} className="p-3 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all">
                <HiOutlinePlus className="rotate-45" size={24} />
              </button>
            </div>

            <form className="p-8 space-y-8" onSubmit={handleUpdate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nombre del estudio</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} required className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Correo administrador</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} required className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={editForm.password}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Sin cambios"
                      className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none pr-12 text-sm"
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                       {showNewPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-2">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${editForm.is_superuser ? 'bg-fuchsia-600 border-fuchsia-600' : 'border-gray-200'}`}>
                     <input id="edit_is_superuser" type="checkbox" checked={editForm.is_superuser} onChange={(e) => setEditForm((prev) => ({ ...prev, is_superuser: e.target.checked }))} className="hidden" />
                     {editForm.is_superuser && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <label htmlFor="edit_is_superuser" className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer">Superusuario</label>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Dirección</label>
                  <input type="text" value={editForm.address} onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Pais / Ciudad</label>
                   <div className="grid grid-cols-2 gap-4">
                      <input type="text" value={editForm.country} onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="País" />
                      <input type="text" value={editForm.city} onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="Ciudad" />
                   </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Teléfono</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Moneda</label>
                  <select
                    value={editForm.currency}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none cursor-pointer"
                  >
                    <option value="CLP">CLP - Peso Chileno ($)</option>
                    <option value="ARS">ARS - Peso Argentino ($)</option>
                    <option value="USD">USD - Dólar Estadounidense (US$)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Insta / TikTok</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={editForm.instagram_url} onChange={(e) => setEditForm((prev) => ({ ...prev, instagram_url: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="@insta" />
                    <input type="text" value={editForm.tiktok_url} onChange={(e) => setEditForm((prev) => ({ ...prev, tiktok_url: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="@tiktok" />
                  </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Web / FB</label>
                   <div className="grid grid-cols-2 gap-4">
                      <input type="text" value={editForm.website_url} onChange={(e) => setEditForm((prev) => ({ ...prev, website_url: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="Web" />
                      <input type="text" value={editForm.facebook_url} onChange={(e) => setEditForm((prev) => ({ ...prev, facebook_url: e.target.value }))} className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl font-bold text-gray-700 focus:bg-white border-2 border-transparent focus:border-fuchsia-100 transition-all outline-none" placeholder="FB" />
                   </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Logo</label>
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="h-16 w-16 rounded-2xl border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {editForm.logo_url ? (
                        <img src={toAbsoluteUrl(editForm.logo_url)} alt="logo" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-black text-gray-300 uppercase text-center px-1">Sin Logo</span>
                      )}
                    </div>
                    <label className="flex-1 text-center py-4 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-fuchsia-600 uppercase tracking-widest cursor-pointer hover:bg-fuchsia-50 transition-colors shadow-sm">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; handleUploadLogo(file) }} />
                      {uploadingLogo ? 'Subiendo...' : 'Cambiar Imagen'}
                    </label>
                  </div>
                </div>
              </div>

              {editMessage && <div className="p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest text-center">{editMessage}</div>}
              {editError && <div className="p-4 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest text-center">{editError}</div>}

              <div className="flex flex-col-reverse sm:flex-row gap-4 pt-6 border-t border-gray-50">
                 <button type="button" className="flex-1 sm:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all" onClick={() => setEditTarget(null)}>
                  Cancelar
                </button>
                <button type="submit" disabled={isUpdating} className="flex-1 sm:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-lg shadow-fuchsia-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 transition-all">
                  {isUpdating ? 'Procesando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

