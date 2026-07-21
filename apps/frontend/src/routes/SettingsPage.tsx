import { useEffect, useState } from 'react'
import { api, toAbsoluteUrl, getTenant } from '../lib/api'
import { useTenant } from '../lib/tenant'
import { REGION_PRESETS, findRegionPreset, sanitizePhonePrefix } from '../lib/phone'
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
  HiOutlineUserGroup,
  HiOutlineDeviceMobile,
  HiOutlineClipboardCopy,
  HiOutlineCheckCircle
} from 'react-icons/hi'

const whatsappTemplateOptions = [
  {
    sid: 'HXc48c3cc85e952f4801808ddaff9a809e',
    name: 'payment_reminder_es',
    label: 'Opcion 1',
    preview:
      'Hola [Nombre Alumno], te recordamos que tienes un pago pendiente del curso [Nombre Curso] de los dias [Dia y Hora] en [Nombre Estudio]. Si ya realizaste el pago, puedes ignorar este mensaje.',
  },
  {
    sid: 'HXd52821f338d579d0463bcb380207db70',
    name: 'copy_payment_reminder_option2_es',
    label: 'Opcion 2',
    preview:
      'Hola [Nombre Alumno] âœ¨ Desde [Nombre Estudio] queremos recordarte de forma cordial que tienes un pago pendiente del curso [Nombre Curso] de los dias [Dia y Hora]. Si ya realizaste el pago, puedes ignorar este mensaje.',
  },
] as const

type TenantSettings = {
  id: number
  name: string
  slug?: string | null
  contact_email?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  postal_code?: string | null
  phone?: string | null
  phone_prefix?: string | null
  whatsapp_message?: string | null
  logo_url?: string | null
  currency?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  facebook_url?: string | null
  website_url?: string | null
  attendance_pin?: string | null
  enrollment_fee_enabled?: boolean
  enrollment_fee_amount?: number | null
  enrollment_fee_apply_to?: 'new_only' | 'new_and_reentry' | null
  enrollment_fee_allow_waive?: boolean
  enrollment_fee_kind?: 'incorporation' | 'annual' | null
  enrollment_fee_renewal?: 'never' | 'yearly' | null
  mobile_enabled?: boolean
  teacher_portal_enabled?: boolean
  student_portal_enabled?: boolean
  online_payments_enabled?: boolean
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
    slug: '',
    contact_email: '',
    address: '',
    country: '',
    city: '',
    postal_code: '',
    phone: '',
    phone_prefix: '+56',
    whatsapp_message: '',
    logo_url: '',
    currency: 'CLP',
    instagram_url: '',
    tiktok_url: '',
    facebook_url: '',
    website_url: '',
    attendance_pin: '',
    enrollment_fee_enabled: false,
    enrollment_fee_amount: null,
    enrollment_fee_apply_to: 'new_only',
    enrollment_fee_allow_waive: false,
    enrollment_fee_kind: 'incorporation',
    enrollment_fee_renewal: 'never',
    mobile_enabled: false,
    teacher_portal_enabled: false,
    student_portal_enabled: false,
    online_payments_enabled: false,
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
  const [activeTemplateSid, setActiveTemplateSid] = useState<string>(whatsappTemplateOptions[0].sid)
  const [mobileCopyMessage, setMobileCopyMessage] = useState('')

  const activeTemplate =
    whatsappTemplateOptions.find((option) => option.sid === activeTemplateSid) || whatsappTemplateOptions[0]
  const activeTemplatePreview = activeTemplate.preview.replaceAll(
    '[Nombre Estudio]',
    settings.name || 'Tu Estudio'
  )
  const regionPreset = findRegionPreset(settings.country, settings.currency, settings.phone_prefix)
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const mobileSlug = settings.slug || (settings.id ? `tenant-${settings.id}` : '')
  const studentPortalLink = mobileSlug ? `${appOrigin}/mobile/${mobileSlug}` : ''
  const teacherPortalLink = mobileSlug ? `${appOrigin}/mobile/staff/${mobileSlug}` : ''
  const mobileModules = [
    { label: 'Portal Mobile', enabled: !!settings.mobile_enabled },
    { label: 'Alumnos', enabled: !!settings.student_portal_enabled },
    { label: 'Profesores', enabled: !!settings.teacher_portal_enabled },
    { label: 'Pagos Online', enabled: !!settings.online_payments_enabled },
  ]

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
        try {
          const { data: twilioData } = await api.get('/api/pms/whatsapp/active-template')
          if (twilioData?.template_sid) {
            setActiveTemplateSid(twilioData.template_sid)
          }
        } catch {
          setActiveTemplateSid(whatsappTemplateOptions[0].sid)
        }
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

  const handleApplyRegionPreset = (country: string) => {
    const preset = REGION_PRESETS.find((item) => item.country === country) || REGION_PRESETS[0]
    setSettings((current) => ({
      ...current,
      country: preset.country,
      currency: preset.currency,
      phone_prefix: preset.prefix,
    }))
  }

  const handleSaveRegionConfig = async () => {
    const nextPrefix = sanitizePhonePrefix(settings.phone_prefix)
    const nextCurrency = (settings.currency || regionPreset.currency || 'CLP').toUpperCase()
    setSettings((current) => ({ ...current, phone_prefix: nextPrefix, currency: nextCurrency }))
    await saveGlobalSettings({
      country: settings.country,
      currency: nextCurrency,
      phone_prefix: nextPrefix,
    })
    alert('Región, prefijo y moneda actualizados correctamente.')
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

  const handleSavePin = async () => {
    if (settings.attendance_pin && settings.attendance_pin.length !== 4) {
      alert('El PIN debe tener exactamente 4 dígitos.')
      return
    }
    await saveGlobalSettings({ attendance_pin: settings.attendance_pin })
    alert('PIN de asistencia actualizado correctamente.')
  }

  const handleSaveEnrollmentFee = async () => {
    await saveGlobalSettings({
      enrollment_fee_enabled: !!settings.enrollment_fee_enabled,
      enrollment_fee_amount: settings.enrollment_fee_amount == null || Number(settings.enrollment_fee_amount) <= 0
        ? null
        : Number(settings.enrollment_fee_amount),
      enrollment_fee_apply_to: settings.enrollment_fee_apply_to || 'new_only',
      enrollment_fee_allow_waive: !!settings.enrollment_fee_allow_waive,
      enrollment_fee_kind: settings.enrollment_fee_kind || 'incorporation',
      enrollment_fee_renewal: settings.enrollment_fee_renewal || 'never',
    })
    alert('Configuración de matrícula actualizada correctamente.')
  }

  const copyMobileLink = async (label: string, link: string) => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setMobileCopyMessage(`${label} copiado`)
      window.setTimeout(() => setMobileCopyMessage(''), 2500)
    } catch {
      setMobileCopyMessage('No se pudo copiar el link')
    }
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
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-10 pb-20 animate-in fade-in duration-700 px-1 md:px-0">
      {/* Header */}
      <div className="space-y-2 px-1 md:px-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest bg-fuchsia-50 px-3 py-1 rounded-full">Configuración</span>
          <div className="h-1 w-1 rounded-full bg-gray-300" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Panel de Control</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Ajustes del Estudio</h1>
        <p className="text-sm md:text-base text-gray-500 font-medium">Gestiona la identidad de tu academia y la infraestructura física.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-fuchsia-500/10 transition-all duration-700" />
        
        <div className="p-4 md:p-10 relative flex flex-col md:flex-row gap-6 md:gap-10 items-center">
          <div className="relative group/logo">
             <div className="h-28 w-28 md:h-40 md:w-40 rounded-[28px] md:rounded-[40px] bg-gray-50 border-4 border-white shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 group-hover/logo:scale-105">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <HiOutlineSparkles className="text-gray-200" size={60} />
                )}
             </div>
             <div className="absolute -bottom-2 -right-2 w-10 h-10 md:w-12 md:h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-fuchsia-600 border border-fuchsia-50">
                <HiOutlineCog size={20} />
             </div>
          </div>

          <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{settings.name || 'Estudio sin nombre'}</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1">{settings.city || 'Ciudad'}, {settings.country || 'País'}</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 md:gap-3 justify-center md:justify-start w-full">
               {settings.phone && (
                 <div className="w-full sm:w-auto flex items-center justify-center md:justify-start gap-2 px-3 py-2 bg-gray-50 rounded-xl text-[11px] md:text-xs font-black text-gray-600 uppercase tracking-[0.14em] break-all text-center md:text-left">
                   <HiOutlinePhone className="text-fuchsia-500" /> {settings.phone}
                 </div>
               )}
               {settings.contact_email && (
                 <div className="w-full sm:w-auto flex items-center justify-center md:justify-start gap-2 px-3 py-2 bg-gray-50 rounded-xl text-[11px] md:text-xs font-black text-gray-600 uppercase tracking-[0.14em] break-all text-center md:text-left">
                   <HiOutlineMail className="text-fuchsia-500" /> {settings.contact_email}
                 </div>
               )}
               {settings.instagram_url && (
                 <div className="w-full sm:w-auto flex items-center justify-center md:justify-start gap-2 px-3 py-2 bg-pink-50 rounded-xl text-[11px] md:text-xs font-black text-pink-600 uppercase tracking-[0.14em] break-all text-center md:text-left border border-pink-100">
                    Instagram: {settings.instagram_url}
                 </div>
               )}
               {settings.tiktok_url && (
                 <div className="w-full sm:w-auto flex items-center justify-center md:justify-start gap-2 px-3 py-2 bg-gray-50 rounded-xl text-[11px] md:text-xs font-black text-gray-600 uppercase tracking-[0.14em] break-all text-center md:text-left border border-gray-100">
                    TikTok: {settings.tiktok_url}
                 </div>
               )}
            </div>
            
            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50/50 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-gray-100 group-hover:bg-white transition-colors">
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dirección Física</div>
                 <div className="text-sm font-black text-gray-700 flex items-center gap-2">
                   <HiOutlineLocationMarker className="text-fuchsia-400" /> {settings.address || '--'}
                 </div>
              </div>
              <div className="bg-gray-50/50 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-gray-100 group-hover:bg-white transition-colors">
                 <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Moneda</div>
                 <div className="text-sm font-black text-gray-700 flex items-center gap-2">
                   <HiOutlineCog className="text-fuchsia-400" /> {settings.currency || 'CLP'}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Portal Card */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-5 md:space-y-7">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center shrink-0">
             <HiOutlineDeviceMobile className="text-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Portal Mobile</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Accesos del estudio</p>
          </div>
          <span className={`hidden md:inline-flex rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${settings.mobile_enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
            {settings.mobile_enabled ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {mobileModules.map((item) => (
            <div key={item.label} className={`rounded-2xl border px-4 py-3 ${item.enabled ? 'border-fuchsia-100 bg-fuchsia-50/60' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                <HiOutlineCheckCircle className={item.enabled ? 'text-fuchsia-600' : 'text-gray-300'} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${item.enabled ? 'text-gray-900' : 'text-gray-400'}`}>{item.label}</span>
              </div>
              <p className={`mt-2 text-xs font-black ${item.enabled ? 'text-fuchsia-600' : 'text-gray-400'}`}>{item.enabled ? 'Habilitado' : 'No activo'}</p>
            </div>
          ))}
        </div>

        {settings.mobile_enabled ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[24px] border border-gray-100 bg-gray-50/60 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Link alumnos</p>
                <p className="mt-1 break-all text-xs font-bold text-gray-700">{settings.student_portal_enabled ? studentPortalLink : 'Portal alumnos no habilitado'}</p>
              </div>
              <button
                type="button"
                disabled={!settings.student_portal_enabled || !studentPortalLink}
                onClick={() => copyMobileLink('Link alumnos', studentPortalLink)}
                className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:bg-gray-200 disabled:text-gray-400"
              >
                <HiOutlineClipboardCopy /> Copiar alumnos
              </button>
            </div>

            <div className="rounded-[24px] border border-gray-100 bg-gray-50/60 p-4 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Link profesores</p>
                <p className="mt-1 break-all text-xs font-bold text-gray-700">{settings.teacher_portal_enabled ? teacherPortalLink : 'Portal profesores no habilitado'}</p>
              </div>
              <button
                type="button"
                disabled={!settings.teacher_portal_enabled || !teacherPortalLink}
                onClick={() => copyMobileLink('Link profesores', teacherPortalLink)}
                className="inline-flex items-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:bg-gray-200 disabled:text-gray-400"
              >
                <HiOutlineClipboardCopy /> Copiar profesores
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-5">
            <p className="text-sm font-bold text-gray-500">El portal mobile aun no esta habilitado para este estudio.</p>
          </div>
        )}

        {mobileCopyMessage ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-600">{mobileCopyMessage}</p>
        ) : null}
      </div>

      {/* Communication Card */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-6 md:space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
             <HiOutlineChatAlt2 className="text-2xl" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Mensaje WhatsApp</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Mensajería Automática</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 space-y-5 md:space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between px-1 md:px-2 gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista previa del mensaje aprobado</span>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Referencial</span>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Mensaje utilizado en cobros por WhatsApp</label>

            <div className="p-4 md:p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 space-y-3">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3">
                  <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Previsualizacion del template</div>
                  <span className="px-2.5 py-1 rounded-full bg-white border border-indigo-100 text-[9px] font-black uppercase tracking-widest text-indigo-600 w-fit max-w-full"><span className="md:hidden">{activeTemplate.label}</span><span className="hidden md:inline">{activeTemplate.label} · {activeTemplate.name}</span></span>
               </div>
               <div className="bg-white p-4 rounded-xl text-[11px] md:text-xs text-gray-600 leading-relaxed shadow-sm border border-indigo-50">
                  {activeTemplatePreview}
                </div>
             </div>
          </div>

          <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
             <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
               Esta vista es solo referencial. La configuracion tecnica de la plantilla activa de WhatsApp se administra en Studios junto a Twilio.
             </p>
          </div>
        </div>
      </div>

      {/* Global Config Section (Currency + Region) */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-6 md:space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
             <HiOutlineCog className="text-2xl" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Moneda y Región</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Contexto comercial y telefónico</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 space-y-5 md:space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 items-end">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">País / Región</label>
                 <select
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-amber-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                    value={settings.country || regionPreset.country}
                    onChange={(e) => handleApplyRegionPreset(e.target.value)}
                 >
                    {REGION_PRESETS.map((preset) => (
                      <option key={preset.country} value={preset.country}>{preset.label}</option>
                    ))}
                 </select>
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Prefijo WhatsApp por defecto</label>
                 <input
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-amber-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    value={settings.phone_prefix || regionPreset.prefix}
                    onChange={(e) => setSettings((current) => ({ ...current, phone_prefix: sanitizePhonePrefix(e.target.value) }))}
                    placeholder="+56"
                 />
              </div>
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Tipo de Moneda</label>
                 <select
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-amber-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm appearance-none cursor-pointer"
                    value={settings.currency || regionPreset.currency}
                    onChange={(e) => setSettings((current) => ({ ...current, currency: e.target.value }))}
                 >
                    <option value="CLP">CLP - Peso Chileno ($)</option>
                    <option value="ARS">ARS - Peso Argentino ($)</option>
                    <option value="PEN">PEN - Sol Peruano (S/)</option>
                    <option value="COP">COP - Peso Colombiano ($)</option>
                    <option value="MXN">MXN - Peso Mexicano ($)</option>
                    <option value="USD">USD - Dólar Estadounidense (US$)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                 </select>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div className="p-4 md:p-5 bg-white rounded-2xl border border-gray-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm">
                    {settings.phone_prefix || regionPreset.prefix}
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prefijo activo</p>
                    <p className="text-sm font-black text-gray-700">Se usará como referencia para alumnos y WhatsApp.</p>
                 </div>
              </div>
              <div className="p-4 md:p-5 bg-white rounded-2xl border border-gray-100 flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-black text-lg">
                    {settings.currency === 'USD' ? 'US$' : settings.currency === 'EUR' ? '€' : settings.currency === 'PEN' ? 'S/' : '$'}
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Símbolo actual</p>
                    <p className="text-sm font-black text-gray-700">Se usará en todos los cobros y reportes.</p>
                 </div>
              </div>
           </div>

           <div className="px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                El país sugiere un prefijo telefónico y una moneda, pero ambos siguen siendo editables para casos especiales.
              </p>
           </div>

           <div className="flex justify-end">
              <button
                onClick={handleSaveRegionConfig}
                disabled={isSavingMsg}
                className="px-8 py-3.5 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all active:scale-95 disabled:opacity-50"
              >
                Guardar Región
              </button>
           </div>
        </div>
      </div>
      {/* Enrollment Fee Section */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-6 md:space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
             <HiOutlineCog className="text-2xl" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Matrícula</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Reglas de cobro inicial</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 space-y-5 md:space-y-6">
          <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100">
            <input
              type="checkbox"
              checked={!!settings.enrollment_fee_enabled}
              onChange={(e) => setSettings(s => ({ ...s, enrollment_fee_enabled: e.target.checked }))}
              className="h-5 w-5 accent-rose-600"
            />
            <div>
              <div className="text-sm font-black text-gray-800">Cobrar matrícula</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Activa cobro adicional en inscripción inicial</div>
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 px-1 md:px-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Monto matrícula</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={settings.enrollment_fee_amount ?? ''}
                onChange={(e) => setSettings(s => ({ ...s, enrollment_fee_amount: e.target.value === '' ? null : Number(e.target.value) }))}
                className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                placeholder="Ej: 15000"
                disabled={!settings.enrollment_fee_enabled}
              />
            </div>
            <div className="space-y-2 px-1 md:px-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Aplicar a</label>
              <select
                value={settings.enrollment_fee_apply_to || 'new_only'}
                onChange={(e) => setSettings(s => ({ ...s, enrollment_fee_apply_to: e.target.value as 'new_only' | 'new_and_reentry' }))}
                className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm appearance-none"
                disabled={!settings.enrollment_fee_enabled}
              >
                <option value="new_only">Solo nuevos alumnos</option>
                <option value="new_and_reentry">Nuevos y reingresos</option>
              </select>
            </div>
            <div className="space-y-2 px-1 md:px-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Tipo de matrícula</label>
              <select
                value={settings.enrollment_fee_kind || 'incorporation'}
                onChange={(e) => setSettings(s => ({ ...s, enrollment_fee_kind: e.target.value as 'incorporation' | 'annual' }))}
                className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm appearance-none"
                disabled={!settings.enrollment_fee_enabled}
              >
                <option value="incorporation">Incorporación</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div className="space-y-2 px-1 md:px-0">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Renovación de matrícula</label>
              <select
                value={settings.enrollment_fee_renewal || 'never'}
                onChange={(e) => setSettings(s => ({ ...s, enrollment_fee_renewal: e.target.value as 'never' | 'yearly' }))}
                className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-rose-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm appearance-none"
                disabled={!settings.enrollment_fee_enabled}
              >
                <option value="never">Por siempre (una sola vez)</option>
                <option value="yearly">Renovación anual</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100">
            <input
              type="checkbox"
              checked={!!settings.enrollment_fee_allow_waive}
              onChange={(e) => setSettings(s => ({ ...s, enrollment_fee_allow_waive: e.target.checked }))}
              className="h-5 w-5 accent-rose-600"
              disabled={!settings.enrollment_fee_enabled}
            />
            <div>
              <div className="text-sm font-black text-gray-800">Permitir omitir matrícula al cobrar</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Útil para becas, promociones o excepción administrativa</div>
            </div>
          </label>

          <div className="flex justify-end">
            <button
              onClick={handleSaveEnrollmentFee}
              disabled={isSavingMsg}
              className="px-8 py-3.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
            >
              Guardar Matrícula
            </button>
          </div>
        </div>
      </div>
      {/* Social Media Section */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-6 md:space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
             <HiOutlineSparkles className="text-2xl" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Redes Sociales</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Presencia Digital</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 space-y-5 md:space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
              <div className="space-y-2 px-1 md:px-0">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Instagram (@usuario)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: @puertomonttsalsa"
                    value={settings.instagram_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, instagram_url: e.target.value }))}
                 />
              </div>
              <div className="space-y-2 px-1 md:px-0">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">TikTok (@usuario)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: @puertomonttsalsa"
                    value={settings.tiktok_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, tiktok_url: e.target.value }))}
                 />
              </div>
              <div className="space-y-2 px-1 md:px-0">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Facebook (URL)</label>
                 <input 
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-pink-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm"
                    placeholder="Ej: facebook.com/academia"
                    value={settings.facebook_url || ''}
                    onChange={(e) => setSettings(s => ({ ...s, facebook_url: e.target.value }))}
                 />
              </div>
              <div className="space-y-2 px-1 md:px-0">
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

      {/* Attendance Mode Section */}
      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-6 md:space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
             <HiOutlineUserGroup className="text-2xl" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Modo Asistencia</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Auto-registro de alumnos</p>
          </div>
        </div>

        <div className="bg-gray-50/50 p-4 md:p-8 rounded-[24px] md:rounded-[32px] border border-gray-100 space-y-5 md:space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-end">
              <div className="space-y-3">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">PIN de Seguridad (4 dígitos)</label>
                 <input 
                    type="password"
                    maxLength={4}
                    className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-cyan-100 rounded-2xl font-bold text-gray-700 outline-none transition-all shadow-sm text-center text-2xl tracking-[0.5em]"
                    placeholder="1234"
                    value={settings.attendance_pin || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                      setSettings(s => ({ ...s, attendance_pin: val }))
                    }}
                 />
              </div>
              <div className="flex justify-start pb-1">
                <button
                  onClick={handleSavePin}
                  disabled={isSavingMsg}
                  className="px-8 py-4 bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  Guardar PIN
                </button>
              </div>
           </div>
           
           <div className="px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm mt-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                Nota: Este PIN se utilizará para salir de la pantalla de auto-asistencia y evitar que los alumnos ingresen a tu panel de administración. Si olvidas el PIN, puedes usar tu contraseña de administrador como respaldo.
              </p>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-sm p-4 md:p-10 space-y-6 md:space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
               <HiOutlineOfficeBuilding className="text-2xl" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Infraestructura</h2>
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
          <div className="space-y-2 px-1 md:px-0">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Nombre de Sala</label>
             <input
               className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-gray-700 outline-none transition-all"
               placeholder="Ej: Sala de Ballet"
               value={roomName}
               onChange={(e) => setRoomName(e.target.value)}
             />
          </div>
          <div className="space-y-2 px-1 md:px-0">
             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Ubicación / Piso</label>
             <input
               className="w-full px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl font-bold text-gray-700 outline-none transition-all"
               placeholder="Ej: Segundo Piso"
               value={roomLocation}
               onChange={(e) => setRoomLocation(e.target.value)}
             />
          </div>
          <div className="space-y-2 px-1 md:px-0">
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
            <div key={r.id} className="bg-gray-50/50 border border-gray-100 rounded-3xl p-4 md:p-6 hover:bg-white hover:shadow-xl hover:border-emerald-100 transition-all group">
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






