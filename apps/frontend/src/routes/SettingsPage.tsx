import { FormEvent, useEffect, useState } from 'react'
import { api, toAbsoluteUrl } from '../lib/api'

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
  sidebar_theme?: string | null
  navbar_theme?: string | null
  logo_url?: string | null
}

type RoomItem = {
  id: number
  name: string
  location?: string | null
  capacity?: number | null
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
    sidebar_theme: 'fuchsia',
    navbar_theme: 'sunset',
    logo_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [roomName, setRoomName] = useState('')
  const [roomLocation, setRoomLocation] = useState('')
  const [roomCapacity, setRoomCapacity] = useState<string>('')
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)

  const themeOptions = [
    { value: 'fuchsia', label: 'Fucsia/Morado', swatch: 'bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500' },
    { value: 'sunset', label: 'Naranjo/Rojo', swatch: 'bg-gradient-to-r from-orange-500 via-red-500 to-rose-600' },
    { value: 'ocean', label: 'Azul', swatch: 'bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600' },
    { value: 'onyx', label: 'Oscuro', swatch: 'bg-gradient-to-r from-gray-700 via-gray-800 to-black' },
  ]

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<TenantSettings>('/api/pms/tenants/me')
        setSettings((prev) => ({
          ...prev,
          ...data,
          sidebar_theme: data.sidebar_theme ?? 'fuchsia',
          navbar_theme: data.navbar_theme ?? 'sunset',
          logo_url: data.logo_url ?? '',
        }))
        await loadRooms()
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar la configuración.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const loadRooms = async () => {
    setRoomsLoading(true)
    setRoomsError(null)
    try {
      const { data } = await api.get<RoomItem[]>('/api/pms/rooms')
      setRooms(data)
    } catch (e: any) {
      setRoomsError(e?.message || 'No se pudo cargar las salas')
    } finally {
      setRoomsLoading(false)
    }
  }

  const addRoom = async () => {
    if (!roomName.trim()) return
    try {
      const { data } = await api.post<RoomItem>('/api/pms/rooms', {
        name: roomName.trim(),
        location: roomLocation.trim() || null,
        capacity: roomCapacity ? Number(roomCapacity) : null,
      })
      setRooms((prev) => [...prev, data])
      setRoomName('')
      setRoomLocation('')
      setRoomCapacity('')
    } catch (e: any) {
      setRoomsError(e?.message || 'No se pudo crear la sala')
    }
  }

  const deleteRoom = async (id: number) => {
    try {
      await api.delete(`/api/pms/rooms/${id}`)
      setRooms((prev) => prev.filter((r) => r.id !== id))
    } catch (e: any) {
      setRoomsError(e?.message || 'No se pudo eliminar la sala')
    }
  }

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
        sidebar_theme: settings.sidebar_theme || 'fuchsia',
        navbar_theme: settings.navbar_theme || 'sunset',
        logo_url: settings.logo_url || null,
      })
      setSuccess('Configuración guardada correctamente.')
      window.dispatchEvent(new Event('sidebar-theme-updated'))
    } catch (e: any) {
      setError(e?.message || 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-700">Cargando configuración...</div>
  }

  const logoSrc = toAbsoluteUrl(settings.logo_url)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuración del estudio</h1>
        <p className="text-gray-600">Datos generales de contacto y capacidad del estudio.</p>
      </div>

      <form className="bg-white rounded-xl shadow p-6 space-y-5" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-6 bg-gradient-to-r from-amber-50 via-white to-fuchsia-50 rounded-xl border border-amber-100 p-5">
          <div className="h-24 w-24 rounded-full bg-white border border-dashed border-amber-200 shadow-inner flex items-center justify-center overflow-hidden">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm text-gray-500">Logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-800">Logo del estudio</label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-fuchsia-700 font-semibold border border-fuchsia-200 cursor-pointer hover:shadow-sm transition">
              <span className="text-lg">⬆</span>
              <span>{uploadingLogo ? 'Subiendo...' : 'Seleccionar archivo'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingLogo(true)
                  setError(null)
                  try {
                    const form = new FormData()
                    form.append('file', file)
                    const { data } = await api.post<{ url: string }>('/api/pms/tenants/upload-logo', form, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    })
                    setSettings((prev) => ({ ...prev, logo_url: data.url }))
                    setSuccess('Logo actualizado. No olvides guardar los cambios.')
                  } catch (err: any) {
                    setError(err?.response?.data?.detail || 'No se pudo subir el logo')
                  } finally {
                    setUploadingLogo(false)
                  }
                }}
              />
            </label>
            <p className="text-xs text-gray-600">PNG/JPG/WEBP/SVG · máx 2MB · fondo transparente recomendado.</p>
          </div>
        </div>

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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Color del sidebar</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {themeOptions.map((opt) => {
                const active = (settings.sidebar_theme ?? 'fuchsia') === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('sidebar_theme', opt.value)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition hover:shadow ${active ? 'border-fuchsia-400 ring-2 ring-fuchsia-200 bg-white' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <span className={`h-8 w-8 rounded-full ${opt.swatch} shadow-inner`} />
                    <span className="text-left">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Color del navbar</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {themeOptions.map((opt) => {
                const active = (settings.navbar_theme ?? 'sunset') === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('navbar_theme', opt.value)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition hover:shadow ${active ? 'border-fuchsia-400 ring-2 ring-fuchsia-200 bg-white' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <span className={`h-8 w-8 rounded-full ${opt.swatch} shadow-inner`} />
                    <span className="text-left">{opt.label}</span>
                  </button>
                )
              })}
            </div>
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
          {saving ? 'Guardando...' : uploadingLogo ? 'Subiendo logo...' : 'Guardar cambios'}
        </button>
      </form>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Salas</h2>
            <p className="text-sm text-gray-600">Crea y administra salas para asignarlas a cursos.</p>
          </div>
          <button
            type="button"
            onClick={addRoom}
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
            disabled={!roomName.trim()}
          >
            Agregar sala
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Nombre (obligatorio)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Ubicación"
            value={roomLocation}
            onChange={(e) => setRoomLocation(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Capacidad"
            type="number"
            min="0"
            value={roomCapacity}
            onChange={(e) => setRoomCapacity(e.target.value)}
          />
        </div>

        {roomsError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">{roomsError}</div>}
        {roomsLoading ? (
          <div className="text-sm text-gray-500">Cargando salas...</div>
        ) : rooms.length === 0 ? (
          <div className="text-sm text-gray-500">No hay salas creadas.</div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {rooms.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between bg-gray-50">
                <div>
                  <div className="font-semibold text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-600">
                    {r.location ? `Ubicación: ${r.location}` : 'Sin ubicación'} · {r.capacity ? `${r.capacity} cupos` : 'Capacidad no definida'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteRoom(r.id)}
                  className="text-sm text-red-600 border border-red-200 rounded px-3 py-1 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
