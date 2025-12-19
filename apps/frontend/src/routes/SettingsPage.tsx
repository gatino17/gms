import { useEffect, useState } from 'react'
import { api, toAbsoluteUrl, getTenant } from '../lib/api'
import { useTenant } from '../lib/tenant'

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
  logo_url?: string | null
}

type RoomItem = {
  id: number
  name: string
  location?: string | null
  capacity?: number | null
}

export default function SettingsPage() {
  const { tenantId } = useTenant()
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
    logo_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [roomName, setRoomName] = useState('')
  const [roomLocation, setRoomLocation] = useState('')
  const [roomCapacity, setRoomCapacity] = useState<string>('')
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const resolvedTenantId = tenantId ?? (() => {
        const raw = getTenant()
        const n = raw ? Number(raw) : null
        return Number.isFinite(n) ? n : null
      })()
      if (resolvedTenantId == null) {
        setLoading(false)
        setError('Selecciona un tenant para cargar la configuracion.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<TenantSettings>('/api/pms/tenants/me', {
          headers: { 'X-Tenant-ID': resolvedTenantId },
        })
        setSettings((prev) => ({
          ...prev,
          ...data,
          logo_url: data.logo_url ?? '',
        }))
        await loadRooms(resolvedTenantId)
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar la configuracion.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tenantId])

  const loadRooms = async (currentTenantId: number | null) => {
    if (currentTenantId == null) return
    setRoomsLoading(true)
    setRoomsError(null)
    try {
      const { data } = await api.get<RoomItem[]>('/api/pms/rooms', {
        headers: { 'X-Tenant-ID': currentTenantId },
      })
      setRooms(data)
    } catch (e: any) {
      setRoomsError(e?.message || 'No se pudo cargar las salas')
    } finally {
      setRoomsLoading(false)
    }
  }

  const addRoom = async () => {
    const currentTenantId = tenantId ?? (() => {
      const raw = getTenant()
      const n = raw ? Number(raw) : null
      return Number.isFinite(n) ? n : null
    })()
    if (currentTenantId == null) {
      setRoomsError('Selecciona un tenant para crear salas.')
      return
    }
    if (!roomName.trim()) return
    try {
      const { data } = await api.post<RoomItem>('/api/pms/rooms', {
        name: roomName.trim(),
        location: roomLocation.trim() || null,
        capacity: roomCapacity ? Number(roomCapacity) : null,
      }, {
        headers: { 'X-Tenant-ID': currentTenantId },
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
    const currentTenantId = tenantId ?? (() => {
      const raw = getTenant()
      const n = raw ? Number(raw) : null
      return Number.isFinite(n) ? n : null
    })()
    if (currentTenantId == null) {
      setRoomsError('Selecciona un tenant para eliminar salas.')
      return
    }
    try {
      await api.delete(`/api/pms/rooms/${id}`, {
        headers: { 'X-Tenant-ID': currentTenantId },
      })
      setRooms((prev) => prev.filter((r) => r.id !== id))
    } catch (e: any) {
      setRoomsError(e?.message || 'No se pudo eliminar la sala')
    }
  }

  if (loading) {
    return <div className="text-gray-700">Cargando configuracion...</div>
  }

  const logoSrc = toAbsoluteUrl(settings.logo_url)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Configuracion del estudio</h1>
        <p className="text-gray-600">Vista informativa de tu tenant y gestion de salas.</p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-5 border">
        <div className="flex flex-wrap items-center gap-6">
          <div className="h-24 w-24 rounded-full bg-white border border-dashed border-amber-200 shadow-inner flex items-center justify-center overflow-hidden">
            {logoSrc ? (
              <img src={logoSrc} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-sm text-gray-500">Logo</span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-gray-900">{settings.name || 'Sin nombre'}</p>
            <p className="text-sm text-gray-600">{settings.contact_email || 'Sin correo'}</p>
            <p className="text-xs text-gray-500">Datos en solo lectura</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem label="Direccion" value={settings.address} />
          <InfoItem label="Ciudad" value={settings.city} />
          <InfoItem label="Pais" value={settings.country} />
          <InfoItem label="Codigo postal" value={settings.postal_code} />
          <InfoItem label="Telefono" value={settings.phone} />
          <div className="md:col-span-2">
            <InfoItem label="Mensaje WhatsApp" value={settings.whatsapp_message} multiline />
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 text-red-800 px-4 py-2">{error}</div>}
      </div>

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
            placeholder="Ubicacion"
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
                    {r.location ? `Ubicacion: ${r.location}` : 'Sin ubicacion'} · {r.capacity ? `${r.capacity} cupos` : 'Capacidad no definida'}
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

function InfoItem({ label, value, multiline = false }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-500">{label}</p>
      {multiline ? (
        <div className="min-h-[60px] rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
          {value || '--'}
        </div>
      ) : (
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          {value || '--'}
        </div>
      )}
    </div>
  )
}
