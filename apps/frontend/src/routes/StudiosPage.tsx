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
    <div className="max-w-screen-xl mx-auto space-y-6 px-3 sm:px-6 lg:px-8">
      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Estudios</h1>
          <p className="text-gray-600">Registra un nuevo estudio; el tenant se asigna de forma automatica.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del estudio</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="Estudio Norte"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo administrador</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="admin@estudio.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clave inicial</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="********"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_superuser"
                type="checkbox"
                checked={form.is_superuser}
                onChange={(e) => handleChange('is_superuser', e.target.checked)}
                className="h-4 w-4 text-fuchsia-600 border-gray-300 rounded"
              />
              <label htmlFor="is_superuser" className="text-sm text-gray-700">Crear admin como superusuario</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="Av. Principal 123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pais</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="Chile"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="Ciudad"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
              <input
                type="text"
                value={form.instagram_url}
                onChange={(e) => handleChange('instagram_url', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="https://instagram.com/tuestudio"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
              <input
                type="text"
                value={form.tiktok_url}
                onChange={(e) => handleChange('tiktok_url', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="https://tiktok.com/@tuestudio"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
              <input
                type="text"
                value={form.facebook_url}
                onChange={(e) => handleChange('facebook_url', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="https://facebook.com/tuestudio"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
              <input
                type="text"
                value={form.website_url}
                onChange={(e) => handleChange('website_url', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                placeholder="https://www.tuestudio.cl"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo (opcional)</label>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full border bg-white flex items-center justify-center overflow-hidden">
                  {createLogoPreview ? (
                    <img src={createLogoPreview} alt="logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-500">Sin logo</span>
                  )}
                </div>
                <label className="px-3 py-2 rounded border border-fuchsia-300 text-sm text-fuchsia-700 font-semibold cursor-pointer hover:bg-fuchsia-50">
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
                  Subir logo
                </label>
                {createLogoPreview && (
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-800"
                    onClick={() => {
                      setCreateLogoFile(null)
                      setCreateLogoPreview('')
                    }}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          {success && <div className="rounded-md bg-green-50 text-green-800 px-4 py-2">{success}</div>}
          {error && <div className="rounded-md bg-red-50 text-red-800 px-4 py-2">{error}</div>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-fuchsia-600 px-4 py-2 text-white font-semibold hover:bg-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fuchsia-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creando...' : 'Crear estudio'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Estudios registrados</h2>
          <p className="text-sm text-gray-600">Listado de todos los tenants disponibles.</p>
        </div>
        <div className="p-4">
          {isLoadingStudios ? (
            <div className="text-sm text-gray-600">Cargando estudios...</div>
          ) : listError ? (
            <div className="text-sm text-red-600">{listError}</div>
          ) : studios.length === 0 ? (
            <div className="text-sm text-gray-600">No hay estudios registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-100 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-2 font-medium">Tenant</th>
                    <th className="px-4 py-2 font-medium">Nombre</th>
                    <th className="px-4 py-2 font-medium">Correo</th>
                    <th className="px-4 py-2 font-medium">Direccion</th>
                    <th className="px-4 py-2 font-medium">Ciudad</th>
                    <th className="px-4 py-2 font-medium">Pais</th>
                    <th className="px-4 py-2 font-medium">Telefono</th>
                    <th className="px-4 py-2 font-medium">Logo</th>
                    <th className="px-4 py-2 font-medium">Creado</th>
                    <th className="px-4 py-2 font-medium">Admin super</th>
                    <th className="px-4 py-2 font-medium text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {studios.map((studio) => (
                  <tr key={studio.id}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700 whitespace-nowrap align-middle">{studio.slug}</td>
                    <td className="px-4 py-2 text-gray-900 whitespace-nowrap align-middle">{studio.name}</td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap align-middle">{studio.contact_email ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700 align-middle">{studio.address ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap align-middle">{studio.city ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap align-middle">{studio.country ?? '-'}</td>
                    <td className="px-4 py-2 text-gray-700 whitespace-nowrap align-middle">{studio.phone ?? '-'}</td>
                    <td className="px-4 py-2 align-middle">
                        {studio.logo_url ? (
                          <img
                            src={toAbsoluteUrl(studio.logo_url)}
                            alt={studio.name}
                            className="h-10 w-10 object-cover rounded-full border border-gray-200 bg-white"
                          />
                        ) : (
                          <span className="text-xs text-gray-500">Sin logo</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap align-middle">{new Date(studio.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-gray-700 whitespace-nowrap align-middle">{studio.admin_is_superuser ? 'Si' : 'No'}</td>
                      <td className="px-4 py-2 align-middle">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            type="button"
                            className="h-9 w-9 inline-flex items-center justify-center rounded border border-fuchsia-600 text-fuchsia-700 hover:bg-fuchsia-50"
                            onClick={() => setEditTarget(studio)}
                            aria-label="Editar"
                            title="Editar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6.732-6.732a2.5 2.5 0 113.536 3.536L12.536 14.5 9 15.5l1-3.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19h14" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="h-9 w-9 inline-flex items-center justify-center rounded border border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-60"
                            onClick={() => handleDelete(studio.id)}
                            disabled={deletingId === studio.id}
                            aria-label="Eliminar"
                            title="Eliminar"
                          >
                            {deletingId === studio.id ? (
                              <span className="text-xs">...</span>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-1 12a2 2 0 01-2 2h-4a2 2 0 01-2-2V7h10v12z" />
                              </svg>
                            )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditTarget(null)}
          />
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Editar estudio</h2>
                <p className="text-sm text-gray-500">Tenant: <span className="font-mono text-fuchsia-600">{editTarget.slug}</span></p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleUpdate}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del estudio</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} required className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo administrador</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} required className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                {/* Contraseña */}
                <div className="md:col-span-2 lg:col-span-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Contraseña</span>
                    </div>
                    <p className="text-xs text-amber-600">
                      La contraseña actual está cifrada y no puede mostrarse. Deja el campo en blanco para mantenerla sin cambios.
                    </p>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={editForm.password}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Nueva contraseña (mín. 6 caracteres)"
                        className="w-full rounded border border-amber-300 bg-white px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700"
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <input id="edit_is_superuser" type="checkbox" checked={editForm.is_superuser} onChange={(e) => setEditForm((prev) => ({ ...prev, is_superuser: e.target.checked }))} className="h-4 w-4 text-fuchsia-600 border-gray-300 rounded" />
                  <label htmlFor="edit_is_superuser" className="text-sm text-gray-700">Admin es superusuario</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input type="text" value={editForm.address} onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                  <input type="text" value={editForm.country} onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                  <input type="text" value={editForm.instagram_url} onChange={(e) => setEditForm((prev) => ({ ...prev, instagram_url: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
                  <input type="text" value={editForm.tiktok_url} onChange={(e) => setEditForm((prev) => ({ ...prev, tiktok_url: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                  <input type="text" value={editForm.facebook_url} onChange={(e) => setEditForm((prev) => ({ ...prev, facebook_url: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sitio web</label>
                  <input type="text" value={editForm.website_url} onChange={(e) => setEditForm((prev) => ({ ...prev, website_url: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full border bg-white flex items-center justify-center overflow-hidden">
                      {editForm.logo_url ? (
                        <img src={toAbsoluteUrl(editForm.logo_url)} alt="logo" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-500">Sin logo</span>
                      )}
                    </div>
                    <label className="px-3 py-2 rounded border border-fuchsia-300 text-sm text-fuchsia-700 font-semibold cursor-pointer hover:bg-fuchsia-50">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; handleUploadLogo(file) }} />
                      {uploadingLogo ? 'Subiendo...' : 'Subir logo'}
                    </label>
                  </div>
                </div>
              </div>

              {editMessage && <div className="rounded-md bg-green-50 text-green-800 px-4 py-2 text-sm">{editMessage}</div>}
              {editError && <div className="rounded-md bg-red-50 text-red-800 px-4 py-2 text-sm">{editError}</div>}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="submit" disabled={isUpdating} className="inline-flex items-center justify-center rounded-md bg-fuchsia-600 px-5 py-2 text-white font-semibold hover:bg-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fuchsia-500 disabled:opacity-60">
                  {isUpdating ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" className="inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setEditTarget(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

