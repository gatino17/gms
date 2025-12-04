import { FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'

type StudioForm = {
  name: string
  email: string
  password: string
  address: string
  country: string
  is_superuser: boolean
}

const defaultForm: StudioForm = {
  name: '',
  email: '',
  password: '',
  address: '',
  country: '',
  is_superuser: false,
}

type StudioUpdateForm = {
  name: string
  email: string
  address: string
  country: string
  is_superuser: boolean
}

const defaultEditForm: StudioUpdateForm = {
  name: '',
  email: '',
  address: '',
  country: '',
  is_superuser: false,
}

type Studio = {
  id: number
  name: string
  slug: string
  contact_email?: string | null
  address?: string | null
  country?: string | null
  created_at: string
  admin_is_superuser?: boolean | null
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
  const [deletingId, setDeletingId] = useState<number | null>(null)

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
        address: editTarget.address ?? '',
        country: editTarget.country ?? '',
        is_superuser: !!(editTarget as any).admin_is_superuser,
      })
      setEditMessage(null)
      setEditError(null)
    } else {
      setEditForm(defaultEditForm)
    }
  }, [editTarget])

  const normalizeOptional = (value: string) => {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }

  const handleChange = (field: keyof StudioForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
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
        is_superuser: !!form.is_superuser,
      })
      setSuccess(`Estudio creado correctamente. Tenant asignado: ${data.slug}`)
      setForm(defaultForm)
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
        address: normalizeOptional(editForm.address),
        country: normalizeOptional(editForm.country),
        is_superuser: !!editForm.is_superuser,
      })
      setEditMessage('Estudio actualizado correctamente.')
      setEditTarget(data)
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Estudios</h1>
          <p className="text-gray-600">Registra un nuevo estudio; el tenant se asigna de forma automatica.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                onChange={(e) => setForm((prev) => ({ ...prev, is_superuser: e.target.checked }))}
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
                    <th className="px-4 py-2 font-medium">Pais</th>
                    <th className="px-4 py-2 font-medium">Creado</th>
                    <th className="px-4 py-2 font-medium">Admin super</th>
                    <th className="px-4 py-2 font-medium text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {studios.map((studio) => (
                    <tr key={studio.id}>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{studio.slug}</td>
                      <td className="px-4 py-2 text-gray-900">{studio.name}</td>
                      <td className="px-4 py-2 text-gray-700">{studio.contact_email ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{studio.address ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-700">{studio.country ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-600">{new Date(studio.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-gray-700">{studio.admin_is_superuser ? 'Si' : 'No'}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            type="button"
                            className="px-3 py-1 text-sm rounded border border-fuchsia-600 text-fuchsia-700 hover:bg-fuchsia-50"
                            onClick={() => setEditTarget(studio)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1 text-sm rounded border border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-60"
                            onClick={() => handleDelete(studio.id)}
                            disabled={deletingId === studio.id}
                          >
                            {deletingId === studio.id ? 'Eliminando...' : 'Eliminar'}
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
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Editar estudio</h2>
              <p className="text-sm text-gray-600">Tenant actual: {editTarget.slug}</p>
            </div>
            <button
              type="button"
              className="text-sm text-gray-500 hover:text-gray-700"
              onClick={() => setEditTarget(null)}
            >
              Cerrar
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del estudio</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo administrador</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
                            <div className="flex items-center gap-2">
                <input
                  id="edit_is_superuser"
                  type="checkbox"
                  checked={editForm.is_superuser}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, is_superuser: e.target.checked }))}
                  className="h-4 w-4 text-fuchsia-600 border-gray-300 rounded"
                />
                <label htmlFor="edit_is_superuser" className="text-sm text-gray-700">Admin es superusuario</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pais</label>
                <input
                  type="text"
                  value={editForm.country}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, country: e.target.value }))}
                  className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
            </div>

            {editMessage && <div className="rounded-md bg-green-50 text-green-800 px-4 py-2">{editMessage}</div>}
            {editError && <div className="rounded-md bg-red-50 text-red-800 px-4 py-2">{editError}</div>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isUpdating}
                className="inline-flex items-center justify-center rounded-md bg-fuchsia-600 px-4 py-2 text-white font-semibold hover:bg-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-fuchsia-500 disabled:opacity-60"
              >
                {isUpdating ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setEditTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

