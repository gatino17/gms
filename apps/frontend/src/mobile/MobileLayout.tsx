import { NavLink, Outlet } from 'react-router-dom'
import { HiOutlineBell, HiOutlineCash, HiOutlineHome, HiOutlineUserGroup } from 'react-icons/hi'
import MobileHeader from './components/MobileHeader'
import { getMobileTenantInfo, getMobileUser, mobileApi, setMobileTenantInfo, type MobileTenantInfo } from './services/mobileApi'
import { useEffect, useState } from 'react'
import { mobileThemeStyle } from '../lib/mobileTheme'

const navItems = [
  { to: '/mobile/home', label: 'Inicio', icon: <HiOutlineHome /> },
  { to: '/mobile/student', label: 'Alumno', icon: <HiOutlineUserGroup /> },
  { to: '/mobile/payments', label: 'Pagos', icon: <HiOutlineCash /> },
  { to: '/mobile/announcements', label: 'Avisos', icon: <HiOutlineBell /> },
]

export default function MobileLayout() {
  const user = getMobileUser()
  const [tenantInfo, setTenantInfo] = useState<MobileTenantInfo | null>(() => getMobileTenantInfo())
  const items = user?.role === 'teacher'
    ? [
        { to: '/mobile/home', label: 'Inicio', icon: <HiOutlineHome /> },
        { to: '/mobile/teacher', label: 'Cursos', icon: <HiOutlineUserGroup /> },
        { to: '/mobile/announcements', label: 'Avisos', icon: <HiOutlineBell /> },
      ]
    : navItems

  const gridCols = items.length === 3 ? 'grid-cols-3' : 'grid-cols-4'

  useEffect(() => {
    if (!user) return
    const endpoint = user.role === 'teacher' ? '/api/pms/teachers/portal/me' : '/api/pms/students/portal/me'
    mobileApi.get(endpoint).then((res) => {
      if (res.data?.tenant) {
        setMobileTenantInfo(res.data.tenant)
        setTenantInfo(res.data.tenant)
      }
    }).catch(() => undefined)
  }, [user?.id, user?.role])

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950" style={mobileThemeStyle(tenantInfo?.mobile_theme)}>
      <MobileHeader user={user} tenant={tenantInfo} />
      <main className="mx-auto min-h-[calc(100vh-148px)] max-w-md px-4 py-5 pb-28">
        <Outlet />
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-2xl shadow-slate-950/10 backdrop-blur-xl">
        <div className={`mx-auto grid max-w-md ${gridCols} gap-2`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                  isActive
                    ? 'mobile-bg-primary mobile-shadow-primary text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
