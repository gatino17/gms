import { FormEvent, useEffect, useState } from 'react'
import { api } from '../lib/api'

type TenantSettings = {
  id: number
  name: string
  contact_email?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  whatsapp_message?: string | null
  rooms_count?: number | null
  sidebar_theme?: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings>({
    id: 0,
    name: '',
    contact_email: '',
    address: '',
    country: '',
    city: '',
    postal_code: '',
    phone: '',
    whatsapp_message: '',
    rooms_count: null,
    sidebar_theme: 'fuchsia',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<TenantSettings>('/api/pms/tenants/me')
        setSettings((prev) => ({
          ...prev,
          ...data,
          rooms_count: data.rooms_count ?? null,
          sidebar_theme: data.sidebar_theme ?? 'fuchsia',
        }))
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar la configuración.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = (field: keyof TenantSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await api.put('/api/pms/tenants/me', {
        address: settings.address?.trim() || null,
        country: settings.country?.trim() || null,
        city: settings.city?.trim() || null,
        postal_code: settings.postal_code?.trim() || null,
        phone: settings.phone?.trim() || null,
        whatsapp_message: settings.whatsapp_message?.trim() || null,
        rooms_count: settings.rooms_count === null || settings.rooms_count === undefined
          ? null
          : Number(settings.rooms_count),
        sidebar_theme: settings.sidebar_theme || 'fuchsia',
      })
      setSuccess('Configuración guardada correctamente.')
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-700">Cargando configuración...</div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuración del estudio</h1>
        <p className="text-gray-600">Datos generales de contacto y capacidad del estudio.</p>
      </div>

      <form className="bg-white rounded-xl shadow p-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input
              type="text"
              value={settings.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Av. Principal 123"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input
              type="text"
              value={settings.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Santiago"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código postal</label>
            <input
              type="text"
              value={settings.postal_code || ''}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
            <input
              type="text"
              value={settings.country || ''}
              onChange={(e) => handleChange('country', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Chile"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              type="text"
              value={settings.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="+56 9 1234 5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de salas</label>
            <input
              type="number"
              min="0"
              value={settings.rooms_count ?? ''}
              onChange={(e) => {
                const v = e.target.value
                setSettings((prev) => ({
                  ...prev,
                  rooms_count: v === '' ? null : Number(v),
                }))
              }}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color del sidebar</label>
            <select
              className="w-full border rounded px-3 py-2 bg-white"
              value={settings.sidebar_theme ?? 'fuchsia'}
              onChange={(e)=>handleChange('sidebar_theme', e.target.value)}
            >
              <option value="fuchsia">Fucsia / Morado (actual)</option>
              <option value="sunset">Naranjo / Rojo</option>
              <option value="ocean">Azul</option>
              <option value="onyx">Negro</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de WhatsApp (próximo uso)</label>
          <textarea
            value={settings.whatsapp_message || ''}
            onChange={(e) => handleChange('whatsapp_message', e.target.value)}
            rows={3}
            className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Hola! Gracias por contactarnos..."
          />
        </div>

        {success && <div className="rounded-md bg-green-50 text-green-800 px-4 py-2">{success}</div>}
        {error && <div className="rounded-md bg-red-50 text-red-800 px-4 py-2">{error}</div>}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
