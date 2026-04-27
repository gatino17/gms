import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTenant } from '../lib/tenant'
import { api } from '../lib/api'
import { HiOutlineHome, HiOutlineUserGroup, HiOutlineBookOpen, HiOutlineViewList, HiOutlineCalendar, HiOutlineCurrencyDollar, HiOutlineLogout, HiOutlineOfficeBuilding, HiOutlineCog, HiOutlineSpeakerphone, HiChevronLeft, HiChevronRight, HiMenuAlt2 } from 'react-icons/hi'
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
        const res = await api.get('/api/pms/tenants/me', {
          headers: { 'X-Tenant-ID': tenantId },
        })
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
      if (!user || user?.is_superuser !== true) {
        setTenantOptions([])
        setCanSwitchTenants(false)
        setLoadingTenants(false)
        return
      }
      setLoadingTenants(true)
      try {
        const res = await api.get<TenantOption[]>('/api/pms/tenants')
        setTenantOptions(res.data)
        setCanSwitchTenants(true)
        if (res.data.length > 0 && (tenantId == null || !res.data.some((t) => t.id === tenantId))) {
          setTenantId(res.data[0].id)
        }
      } catch (e: any) {
        setTenantOptions([])
        setCanSwitchTenants(false)
      } finally {
        setLoadingTenants(false)
      }
    }
    loadTenants()
  }, [user?.is_superuser, tenantId, user, setTenantId])

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

  function initials(label: string) {
    const parts = label.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userDisplay = user?.full_name || user?.email || 'Usuario'
  const userEmail = user?.email || 'Sesión activa'

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans antialiased text-slate-900">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-20' : 'w-72'} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col z-30 shadow-2xl`}>
        {/* Logo Section */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <span className="text-white font-bold text-xl tracking-tight">P</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg leading-tight tracking-tight">PMS Studio</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none mt-0.5">Management</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar scrollbar-hide">
          <div className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-4 flex items-center ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? '—' : 'Menú Principal'}
          </div>
          
          {navTop.map((n) => {
            const isActive = pathname === n.to
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <span className={`text-xl transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                  {n.icon}
                </span>
                {!collapsed && <span className="font-semibold text-sm tracking-tight">{n.label}</span>}
                {isActive && !collapsed && (
                  <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/40 shadow-sm" />
                )}
                {collapsed && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-slate-700">
                    {n.label}
                  </div>
                )}
              </Link>
            )
          })}

          <div className="h-px bg-slate-800/50 my-8 mx-4" />
          
          <div className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-4 flex items-center ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? '—' : 'Administración'}
          </div>
          
          {navBottom.map((n) => {
            const isActive = pathname === n.to
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <span className={`text-xl transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'}`}>
                  {n.icon}
                </span>
                {!collapsed && <span className="font-semibold text-sm tracking-tight">{n.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap z-50 shadow-xl border border-slate-700">
                    {n.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Quick Switch / Footer */}
        <div className="p-4 border-t border-slate-800/50 bg-slate-900/50">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all group"
          >
            <span className="text-xl group-hover:scale-110 group-hover:-rotate-12 transition-transform"><HiOutlineLogout /></span>
            {!collapsed && <span className="font-bold text-sm tracking-tight">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setCollapsed(!collapsed); try{ localStorage.setItem('sidebarCollapsed', !collapsed ? '1' : '0') }catch{} }}
              className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all hover:text-indigo-600 active:scale-95"
              title={collapsed ? "Expandir" : "Contraer"}
            >
              {collapsed ? <HiChevronRight className="text-xl" /> : <HiChevronLeft className="text-xl" />}
            </button>
            <div className="h-6 w-px bg-slate-200 hidden md:block" />
            <div className="hidden md:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                <HiMenuAlt2 />
                <span>PMS</span>
              </div>
              <span className="text-slate-300 text-lg">/</span>
              <span className="text-slate-900 font-bold tracking-tight">
                {pathname === '/' ? 'Dashboard Overview' : pathname.slice(1).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-8">
            {/* Tenant Selector in Header */}
            {canSwitchTenants && (
              <div className="hidden sm:block min-w-[200px]">
                <div className="relative group">
                  <select
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block w-full pl-4 pr-10 py-2.5 transition-all hover:bg-white hover:border-slate-300 cursor-pointer"
                    value={tenantId ?? ''}
                    onChange={(e) => setTenantId(e.target.value ? Number(e.target.value) : null)}
                  >
                    {tenantOptions.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                    <HiChevronRight className="rotate-90" />
                  </div>
                </div>
              </div>
            )}

            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            {/* User Profile */}
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="text-right hidden lg:block">
                <div className="text-sm font-bold text-slate-900 leading-none group-hover:text-indigo-600 transition-colors">{userDisplay}</div>
                <div className="text-[10px] text-slate-500 mt-1.5 font-bold uppercase tracking-wider">{userEmail}</div>
              </div>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-sm shadow-sm transition-all group-hover:shadow-md group-hover:border-indigo-200 group-hover:-translate-y-0.5">
                  {initials(userDisplay)}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
