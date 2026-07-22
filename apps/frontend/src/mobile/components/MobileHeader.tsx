import { HiOutlineLogout, HiOutlineSparkles } from 'react-icons/hi'
import { clearMobileSession, getMobileTenantInfo, mobileUserName, type MobileTenantInfo, type MobileUser } from '../services/mobileApi'
import { useNavigate } from 'react-router-dom'
import { toAbsoluteUrl } from '../../lib/api'

interface Props {
  user?: MobileUser | null
  tenant?: MobileTenantInfo | null
}

export default function MobileHeader({ user, tenant }: Props) {
  const navigate = useNavigate()
  const tenantInfo = tenant || getMobileTenantInfo()
  const tenantLogoSrc = toAbsoluteUrl(tenantInfo?.logo_url)

  const logout = () => {
    const slug = tenantInfo?.slug
    const target = slug
      ? user?.role === 'teacher'
        ? `/mobile/staff/${slug}`
        : `/mobile/${slug}`
      : '/mobile/login'
    clearMobileSession()
    navigate(target, { replace: true })
  }

  return (
    <header className="mobile-bg-header sticky top-0 z-20 border-b border-white/10 px-5 py-4 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="mobile-text-primary flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-lg shadow-slate-950/20">
            {tenantLogoSrc ? <img src={tenantLogoSrc} alt={tenantInfo?.name || 'Estudio'} className="h-full w-full object-cover" /> : <HiOutlineSparkles size={22} />}
          </div>
          <div>
            <p className="mobile-text-accent max-w-[210px] truncate text-[10px] font-black uppercase tracking-[0.24em]">{tenantInfo?.name || 'Portal Mobile'}</p>
            <h1 className="max-w-[190px] truncate text-lg font-black text-white">{mobileUserName(user)}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
          aria-label="Cerrar sesion"
        >
          <HiOutlineLogout size={20} />
        </button>
      </div>
    </header>
  )
}
