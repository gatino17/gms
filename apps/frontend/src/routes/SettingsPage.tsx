import { useEffect, useState } from 'react'
import { api, toAbsoluteUrl, getTenant } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { 
  HiOutlineOfficeBuilding, 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineLocationMarker, 
  HiOutlineChatAlt2, 
  HiOutlinePlus, 
  HiOutlineTrash, 
  HiOutlineCog,
  HiOutlineSparkles,
  HiOutlineUserGroup
} from 'react-icons/hi'

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
  currency?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  facebook_url?: string | null
  website_url?: string | null
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
    currency: 'CLP',
    instagram_url: '',
    tiktok_url: '',
    facebook_url: '',
    website_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [roomName, setRoomName] = useState('')
  const [roomLocation, setRoomLocation] = useState('')
  const [roomCapacity, setRoomCapacity] = useState<string>('')
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [isSavingMsg, setIsSavingMsg] = useState(false)

  useEffect(() => {
    const load = async () => {
      const resolvedTenantId = tenantId ?? (() => {
        const raw = getTenant()
        const n = raw ? Number(raw) : null
        return Number.isFinite(n) ? n : null
      })()
      if (resolvedTenantId == null) {
        setLoading(false)
        setError('Selecciona un tenant para cargar la configuración.')
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
        setError(e?.message || 'No se pudo cargar la configuración.')
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

  const saveGlobalSettings = async (fields: Partial<TenantSettings>) => {
    const currentTenantId = tenantId ?? (() => {
      const raw = getTenant()
      const n = raw ? Number(raw) : null
      return Number.isFinite(n) ? n : null
    })()
    if (currentTenantId == null) return
    setIsSavingMsg(true)
    try {
      await api.put('/api/pms/tenants/me', fields, {
        headers: { 'X-Tenant-ID': currentTenantId }
      })
      // No alert here, we'll use it in specific buttons
    } catch (e: any) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setIsSavingMsg(false)
    }
  }

  const handleSaveWhatsapp = async () => {
    await saveGlobalSettings({ whatsapp_message: settings.whatsapp_message })
    alert('Mensaje de WhatsApp actualizado correctamente.')
  }

  const handleSaveCurrency = async (newCurrency: string) => {
    setSettings(s => ({ ...s, currency: newCurrency }))
    await saveGlobalSettings({ currency: newCurrency })
    alert(`Moneda actualizada a ${newCurrency} correctamente.`)
  }

  const handleSaveSocial = async () => {
    await saveGlobalSettings({
      instagram_url: settings.instagram_url,
      tiktok_url: settings.tiktok_url,
      facebook_url: settings.facebook_url,
      website_url: settings.website_url,
    })
    alert('Redes sociales actualizadas correctamente.')
  }

  if (loading) {
    return (
      <div className="py-40 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-fuchsia-100 border-t-fuchsia-600 rounded-full animate-spin mx-auto" />
        <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest">Sincronizando ajustes...</span>
      </div>
    )
  }

  const logoSrc = toAbsoluteUrl(settings.logo_url)

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Configuración</span>
          <div className="h-1 w-1 rounded-full bg-gray-300" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Panel de Control</span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Ajustes del Estudio</h1>
        <p className="text-gray-500 font-medium">Gestiona la identidad de tu academia y la infraestructura física.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-fuchsia-500/10 transition-all duration-700" />
        
        <div className="p-10 relative flex flex-col md:flex-row gap-10 items-center">
          <div className="relative group/logo">
             <div className="h-40 w-40 rounded-[40px] bg-gray-50 border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover/logo:scale-105">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <HiOutlineSparkles className="text-gray-200" size={60} />
                )}
             </div>
             <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-fuchsia-600 border border-fuchsia-50">
                <HiOutlineCog size={24} />
             </div>
          </div>

          <div className="flex-1 space-y-6 text-center md:text-left">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">{settings.name || 'Estudio sin nombre'}</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">{settings.city || 'Ciudad'}, {settings.country || 'País'}</p>
            </div>

            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
               {settings.phone && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 uppercase tracking-widest">
                   <HiOutlinePhone className="text-fuchsia-500" /> {settings.phone}
                 </div>
               )}
               {settings.contact_email && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 uppercase tracking-widest">
                   <HiOutlineMail className="text-fuchsia-500" /> {settings.contact_email}
                 </div>
               )}
               <div className="flex items-center gap-2 px-4 py-2 bg-fuchsia-50 rounded-xl text-xs font-black text-fuchsia-600 uppercase tracking-widest border border-fuchsia-100">
                  Moneda: {settings.currency || 'CLP'}
               </div>
               {settings.instagram_url && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 rounded-xl text-xs font-black text-pink-600 uppercase tracking-widest border border-pink-100">
                    Instagram: {settings.instagram_url}
                 </div>
               )}
               {settings.tiktok_url && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 uppercase tracking-widest border border-gray-100">
                    TikTok: {settings.tiktok_url}
                 </div>
               )}
            </div>
            
            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 group-hover:bg-white transition-colors">
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dirección Física</div>
                 <div className="text-sm font-black text-gray-700 flex items-center gap-2">
                   <HiOutlineLocationMarker className="text-fuchsia-400" /> {settings.address || '--'}
                 </div>
              </div>
              <div className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100 group-hover:bg-white transition-colors">
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Moneda</div>
                 <div className="text-sm font-black text-gray-700 flex items-center gap-2">
                   <HiOutlineCog className="text-fuchsia-400" /> {settings.currency || 'CLP'}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Communication Card */}
      <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm p-10 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
             <HiOutlineChatAlt2 className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Mensaje WhatsApp</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Mensajería Automática</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-8 rounded-[32px] border border-gray-100 space-y-6">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plantilla de Mensaje WhatsApp</span>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Personalizable</span>
          </div>
          
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Texto Personalizado (Identidad)</label>
            <textarea 
              className="w-full min-h-[100px] p-6 rounded-2xl border-2 border-transparent focus:border-indigo-100 focus:bg-white bg-white text-gray-700 text-sm font-medium leading-relaxed shadow-inner outline-none transition-all resize-none"
              placeholder="Ej: te escribimos de Puerto Montt Salsa."
              value={settings.whatsapp_message || ''}
              onChange={(e) => setSettings(s => ({ ...s, whatsapp_message: e.target.value }))}
            />
            
            <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-3">
               <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Previsualización del mensaje</div>
               <div className="bg-white p-4 rounded-xl text-xs text-gray-600 leading-relaxed shadow-sm italic border border-indigo-50">
                  Hola [Nombre Alumno], <span className="text-indigo-600 font-bold">{settings.whatsapp_message || `Te saludamos de ${settings.name || 'Puerto Montt Salsa'}.`}</span> Esperamos que estés disfrutando mucho tus clases. Te recordamos que tienes un pago pendiente para el curso [Nombre Curso]. Nos vemos pronto.
               </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveWhatsapp}
                disabled={isSavingMsg}
                className="px-8 py-3.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingMsg ? 'Guardando...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>

          <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
             <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
               💡 El sistema añadirá automáticamente el saludo inicial y los detalles del curso/deuda. Solo debes configurar la frase de identidad de tu estudio.
             </p>
          </div>
        </div>
      </div>

      {/* Global Config Section (Currency) */}
      <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm p-10 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
             <HiOutlineCog className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Moneda y Región</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Configuración Financiera</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-8 rounded-[32px] border border-gray-100 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Tipo de Moneda</label>
                 <select 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-amber-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                    value={settings.currency || 'CLP'}
                    onChange={(e) => handleSaveCurrency(e.target.value)}
                 >
                    <option value="CLP">CLP - Peso Chileno ($)</option>
                    <option value="ARS">ARS - Peso Argentino ($)</option>
                    <option value="USD">USD - Dólar Estadounidense (US$)</option>
                 </select>
              </div>
              <div className="p-5 bg-white rounded-2xl border border-gray-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black text-lg">
                    {settings.currency === 'USD' ? 'US$' : '$'}
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Símbolo actual</p>
                    <p className="text-sm font-black text-gray-700">Se usará en todos los cobros y reportes.</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
      {/* Social Media Section */}
      <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm p-10 space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
             <HiOutlineSparkles className="text-2xl" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Redes Sociales</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Presencia Digital</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-8 rounded-[32px] border border-gray-100 space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Instagram (@usuario)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: @puertomonttsalsa"
                    value={settings.instagram_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, instagram_url: e.target.value }))}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">TikTok (@usuario)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: @puertomonttsalsa"
                    value={settings.tiktok_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, tiktok_url: e.target.value }))}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Facebook (URL)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: facebook.com/academia"
                    value={settings.facebook_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, facebook_url: e.target.value }))}
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Sitio Web (URL)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: www.academia.com"
                    value={settings.website_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, website_url: e.target.value }))}
                 />
              </div>
           </div>

           <div className="flex justify-end">
              <button
                onClick={handleSaveSocial}
                className="px-8 py-3.5 bg-pink-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-pink-100 hover:bg-pink-700 transition-all active:scale-95 flex items-center gap-2"
              >
                Guardar Redes Sociales
              </button>
           </div>
        </div>
      </div>
      <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm p-10 space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
               <HiOutlineOfficeBuilding className="text-2xl" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">Infraestructura</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Gestión de Salas y Espacios</p>
            </div>
          </div>
          <button
            type="button"
            onClick={addRoom}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all disabled:opacity-40 active:scale-95"
            disabled={!roomName.trim()}
          >
            <HiOutlinePlus size={18} /> Agregar Sala
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre de Sala</label>
             <input
               className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-gray-700 outline-none transition-all"
               placeholder="Ej: Sala de Ballet"
               value={roomName}
               onChange={(e) => setRoomName(e.target.value)}
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Ubicación / Piso</label>
             <input
               className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-gray-700 outline-none transition-all"
               placeholder="Ej: Segundo Piso"
               value={roomLocation}
               onChange={(e) => setRoomLocation(e.target.value)}
             />
          </div>
          <div className="space-y-2">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Capacidad Máxima</label>
             <input
               className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-gray-700 outline-none transition-all"
               placeholder="Ej: 15"
               type="number"
               min="0"
               value={roomCapacity}
               onChange={(e) => setRoomCapacity(e.target.value)}
             />
          </div>
        </div>

        {roomsError && <div className="text-xs font-black text-rose-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">{roomsError}</div>}
        
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pt-6 border-t border-gray-50">
          {roomsLoading ? (
             <div className="col-span-full py-10 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando salas...</div>
          ) : rooms.length === 0 ? (
             <div className="col-span-full py-20 text-center flex flex-col items-center justify-center gap-4">
                <HiOutlineOfficeBuilding size={40} className="text-gray-100" />
                <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">No hay salas registradas</p>
             </div>
          ) : rooms.map((r) => (
            <div key={r.id} className="bg-gray-50/50 border border-gray-100 rounded-3xl p-6 hover:bg-white hover:shadow-xl hover:border-emerald-100 transition-all group">
               <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                     {r.name[0]}
                  </div>
                  <button
                    onClick={() => deleteRoom(r.id)}
                    className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <HiOutlineTrash size={18} />
                  </button>
               </div>
               <div>
                 <div className="text-lg font-black text-gray-900 group-hover:text-emerald-600 transition-colors">{r.name}</div>
                 <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                       <HiOutlineLocationMarker /> {r.location || 'Sin ubicación'}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                       <HiOutlineUserGroup /> {r.capacity || 'Capacidad libre'} cupos
                    </div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
