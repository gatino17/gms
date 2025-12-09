import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTenant } from '../lib/tenant'
import { api } from '../lib/api'
import { HiOutlineHome, HiOutlineUserGroup, HiOutlineBookOpen, HiOutlineViewList, HiOutlineCalendar, HiOutlineCurrencyDollar, HiOutlineLogout, HiOutlineOfficeBuilding, HiOutlineCog, HiOutlineSpeakerphone } from 'react-icons/hi'
import { useAuth } from '../context/AuthContext'

type TenantOption = {
  id: number
  name: string
  slug: string
  contact_email?: string | null
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { tenantId, setTenantId } = useTenant()
  const { logout, user } = useAuth()
  const [tenantInfo, setTenantInfo] = useState<{ id:number; name:string; slug:string; created_at:string; email?: string | null; contact_email?: string | null; sidebar_theme?: string | null } | null>(null)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('sidebarCollapsed') === '1' } catch { return false }
  })
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [loadingTenants, setLoadingTenants] = useState(false)
  const [canSwitchTenants, setCanSwitchTenants] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        if (tenantId == null) { console.debug('[layout] tenantId null, skipping me'); setTenantInfo(null); return }
        console.debug('[layout] fetching tenant me', { tenantId })
        const res = await api.get('/api/pms/tenants/me', {
          headers: { 'X-Tenant-ID': tenantId },
        })
        console.debug('[layout] tenant me response', res.data)
        setTenantInfo(res.data)
      } catch (e) {
        console.debug('[layout] error fetching tenant me', e)
        setTenantInfo(null)
      }
    }
    load()
  }, [tenantId])

  useEffect(() => {
    const loadTenants = async () => {
      console.debug('[layout] effect loadTenants', { isSuper: user?.is_superuser, tenantId, hasUser: !!user })
      if (!user) {
        console.debug('[layout] no user yet, skip loadTenants')
        setTenantOptions([])
        setCanSwitchTenants(false)
        setLoadingTenants(false)
        return
      }
      // Solo superusuarios deben llamar a /tenants. Si el flag no es true, salir.
      if (user?.is_superuser !== true) {
        console.debug('[layout] user is not super (or unknown), skip tenant list')
        setTenantOptions([])
        setCanSwitchTenants(false)
        setLoadingTenants(false)
        return
      }
      setLoadingTenants(true)
      try {
        console.debug('[layout] loading tenants')
        const res = await api.get<TenantOption[]>('/api/pms/tenants')
        console.debug('[layout] tenants loaded', res.data)
        setTenantOptions(res.data)
        setCanSwitchTenants(true)
        if (res.data.length > 0 && (tenantId == null || !res.data.some((t) => t.id === tenantId))) {
          console.debug('[layout] auto-selecting tenant', res.data[0])
          setTenantId(res.data[0].id)
        }
      } catch (e: any) {
        console.debug('[layout] error loading tenants', e)
        setTenantOptions([])
        setCanSwitchTenants(false)
      } finally {
        setLoadingTenants(false)
      }
    }
    loadTenants()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.is_superuser, tenantId, user])

  // Reordenado: Profesores y Calendario junto a Pagos al final
  const navTop = [
    { to: '/', label: 'Dashboard', icon: <HiOutlineHome /> },
    { to: '/course-status', label: 'Estado cursos', icon: <HiOutlineViewList /> },
    { to: '/students', label: 'Alumnos', icon: <HiOutlineUserGroup /> },
    { to: '/courses', label: 'Cursos', icon: <HiOutlineBookOpen /> },
  ]

  const navBottomBase = [
    { to: '/payments', label: 'Pagos', icon: <HiOutlineCurrencyDollar /> },
    { to: '/calendar', label: 'Calendario', icon: <HiOutlineCalendar /> },
    { to: '/announcements', label: 'Novedades', icon: <HiOutlineSpeakerphone /> },
    { to: '/teachers', label: 'Profesores', icon: <HiOutlineUserGroup /> },
    { to: '/settings', label: 'Configuración', icon: <HiOutlineCog /> },
  ]
  const navBottom = user?.is_superuser ? [
    ...navBottomBase,
    { to: '/studios', label: 'Estudios', icon: <HiOutlineOfficeBuilding /> },
  ] : navBottomBase

  useEffect(() => {
    console.debug('[layout] nav state', { userIsSuper: user?.is_superuser, navBottomLabels: navBottom.map(n => n.label) })
  }, [user?.is_superuser])

  function initials(label: string) {
    const parts = label.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // ensure tenant gets set once options arrive
  useEffect(() => {
    if (tenantId == null && tenantOptions.length > 0) {
      console.debug('[layout] selecting first tenant because tenantId is null', tenantOptions[0])
      setTenantId(tenantOptions[0].id)
    }
  }, [tenantId, tenantOptions, setTenantId])

  const selectedTenant = tenantId != null ? tenantOptions.find((t) => t.id === tenantId) : undefined
  const selectedTenantName = selectedTenant?.name ?? tenantInfo?.name ?? tenantId ?? '-'
  const userDisplay = user?.full_name || user?.email || 'Usuario'
  const userEmail = user?.email || 'Sesion activa'

  const themeKey = tenantInfo?.sidebar_theme ?? 'fuchsia'
  const themes: Record<string, { aside: string; header: string; main: string }> = {
    fuchsia: {
      aside: 'bg-gradient-to-b from-fuchsia-600 via-fuchsia-500 to-purple-600',
      header: 'bg-gradient-to-r from-fuchsia-500/40 to-purple-600/40',
      main: 'bg-gradient-to-br from-white to-fuchsia-50/40',
    },
    sunset: {
      aside: 'bg-gradient-to-b from-orange-500 via-red-500 to-pink-600',
      header: 'bg-gradient-to-r from-orange-400/50 to-red-600/50',
      main: 'bg-gradient-to-br from-white to-orange-50/40',
    },
    ocean: {
      aside: 'bg-gradient-to-b from-sky-600 via-blue-600 to-indigo-700',
      header: 'bg-gradient-to-r from-sky-500/50 to-indigo-700/50',
      main: 'bg-gradient-to-br from-white to-sky-50/40',
    },
    onyx: {
      aside: 'bg-gradient-to-b from-gray-900 via-gray-800 to-black',
      header: 'bg-gradient-to-r from-gray-800/60 to-black/60',
      main: 'bg-gradient-to-br from-white to-gray-50/30',
    },
  }
  const themeClasses = themes[themeKey] ?? themes.fuchsia

  return (
    <div className="min-h-screen flex">
      <aside className={`${collapsed ? 'w-16' : 'w-64'} border-r transition-all duration-200 ${themeClasses.aside} text-white flex flex-col`}>
        <div className={`p-3 font-semibold flex items-center justify-between gap-2 ${themeClasses.header} border-b border-white/20`}>
          <span className="truncate">{collapsed ? 'P' : 'PMS'}</span>
          <div className="flex items-center gap-2">
            {!collapsed && <span className="text-xs text-white/80 hidden md:inline">Tenant: {selectedTenantName}</span>}
            <button
              type="button"
              title={collapsed ? 'Expandir' : 'Colapsar'}
              className="px-2 py-1 text-xs rounded border border-white/30 text-white hover:bg-white/10"
              onClick={() => { setCollapsed((c)=>{ const v = !c; try{ localStorage.setItem('sidebarCollapsed', v ? '1' : '0') }catch{}; return v }) }}
            >{collapsed ? '+' : '-'}</button>
          </div>
        </div>
        {!collapsed && (
          <div className="px-4 pb-4 space-y-3">
            {canSwitchTenants && tenantOptions.length > 0 ? (
              <div>
                <label className="block text-sm text-white/80 mb-1">Tenant</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white/90 text-gray-800"
                  value={tenantId ?? ''}
                  onChange={(e) => { const val = e.target.value ? Number(e.target.value) : null; console.debug('[layout] tenant select change', val); setTenantId(val) }}
                >
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
                {loadingTenants && <p className="text-xs text-white/70 mt-1">Cargando tenants...</p>}
              </div>
            ) : (
              <div>
                <label className="block text-sm text-white/80 mb-1">Tenant activo</label>
                <div className="w-full border rounded px-3 py-2 bg-white/90 text-gray-800 text-sm">
                  {tenantInfo?.name ?? "Sin informacion"}
                </div>
              </div>
            )}
            <div className="text-sm space-y-1 border border-white/20 rounded p-3 bg-white/10">
              <div className="text-white font-medium truncate">{tenantInfo?.name ?? '-'}</div>
              <div className="text-white/80 text-xs truncate">Slug: {tenantInfo?.slug ?? '-'}</div>
              <div className="text-white/80 text-xs truncate">Correo: {tenantInfo?.email ?? tenantInfo?.contact_email ?? '-'}</div>
            </div>
          </div>
        )}
        <div className="border-t border-white/20 my-2" />
        <nav className="px-2 space-y-1">
          {navTop.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              title={collapsed ? n.label : undefined}
              className={`flex items-center gap-2 rounded px-3 py-2 transition
                ${pathname === n.to
                  ? 'bg-white/20 text-white font-medium border border-white/20 shadow'
                  : 'hover:bg-white/10 text-white/90'}
              `}
            >
              {collapsed ? (
                <span className="w-7 h-7 inline-flex items-center justify-center rounded bg-white/20">
                  <span className="text-white text-lg">{n.icon}</span>
                </span>
              ) : (
                <>
                  <span className="text-white text-lg">{n.icon}</span>
                  <span className="truncate">{n.label}</span>
                </>
              )}
            </Link>
          ))}
          <div className="border-t border-white/10 my-2" />
          {navBottom.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              title={collapsed ? n.label : undefined}
              className={`flex items-center gap-2 rounded px-3 py-2 transition
                ${pathname === n.to
                  ? 'bg-white/20 text-white font-medium border border-white/20 shadow'
                  : 'hover:bg-white/10 text-white/90'}
              `}
            >
              {collapsed ? (
                <span className="w-7 h-7 inline-flex items-center justify-center rounded bg-white/20">
                  <span className="text-white text-lg">{n.icon}</span>
                </span>
              ) : (
                <>
                  <span className="text-white text-lg">{n.icon}</span>
                  <span className="truncate">{n.label}</span>
                </>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto w-full space-y-3 px-3 pb-4">
          <div className={`flex items-center gap-2 rounded border border-white/20 bg-white/10 px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center font-semibold uppercase">
              {initials(userDisplay)}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-white text-sm font-medium truncate">{userDisplay}</div>
                <div className="text-white/70 text-xs truncate">{userEmail}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 rounded px-3 py-2 text-sm font-medium transition border border-white/20 bg-white/10 hover:bg-white/20 text-white ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="text-lg"><HiOutlineLogout /></span>
            {!collapsed && <span className="truncate">Cerrar sesion</span>}
          </button>
        </div>
      </aside>
      <main className={`flex-1 p-4 md:p-6 transition-colors ${collapsed ? themeClasses.main : ''}`}>
        <Outlet />
      </main>
    </div>
  )
}


















