import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HiOutlineLockClosed, HiOutlineMail, HiOutlineUserGroup } from 'react-icons/hi'
import { mobileApi, setMobileSession, setMobileTenant, setMobileTenantInfo, type MobileTenantInfo } from '../services/mobileApi'
import { toAbsoluteUrl } from '../../lib/api'
import MobileAuthBackground from '../components/MobileAuthBackground'

export default function StaffLogin() {
  const navigate = useNavigate()
  const { studioSlug } = useParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantInfo, setTenantInfo] = useState<MobileTenantInfo | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const tenantLogoSrc = toAbsoluteUrl(tenantInfo?.logo_url)

  useEffect(() => {
    if (!studioSlug) return
    mobileApi.get<MobileTenantInfo>(`/api/pms/tenants/public/${studioSlug}`)
      .then((res) => {
        setTenantInfo(res.data)
        setMobileTenant(res.data.id)
        if (!res.data.mobile_enabled || !res.data.teacher_portal_enabled) {
          setMessage('El portal de profesores no esta habilitado para este estudio.')
        }
      })
      .catch((err) => setMessage(err?.message || 'No se pudo cargar el estudio.'))
  }, [studioSlug])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const { data } = await mobileApi.post('/api/pms/teachers/portal/login', {
        email: email.trim(),
        password,
        tenant_id: tenantInfo?.id,
      })
      const teacher = data.teacher
      if (data.tenant) {
        setMobileTenantInfo(data.tenant)
      }
      setMobileSession(data.access_token, {
        id: teacher.id,
        email: teacher.email,
        full_name: teacher.full_name,
        tenant_id: teacher.tenant_id,
        role: 'teacher',
      })
      navigate('/mobile/home', { replace: true })
    } catch (err: any) {
      setMessage(err?.message || 'No se pudo iniciar sesion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#090912] px-5 py-8 text-white">
      <MobileAuthBackground />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mb-6 flex items-center justify-center gap-1">
            <div className="h-28 w-28 overflow-hidden rounded-full border border-white/15 bg-white shadow-2xl shadow-slate-950/30">
              <img src="/gms-soluciones-digitales.jpg" alt="GMS Soluciones Digitales" className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500 shadow-lg shadow-fuchsia-500/50" />
              <span className="h-px w-2 bg-fuchsia-500/80" />
              <span className="h-2.5 w-2.5 rounded-full border border-fuchsia-300 bg-fuchsia-500 shadow-lg shadow-fuchsia-500/50" />
              <span className="h-px w-3 bg-gradient-to-r from-fuchsia-500 to-white/60" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              <span className="h-px w-2 bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
            </div>
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-fuchsia-600 shadow-2xl shadow-fuchsia-700/25">
              {tenantLogoSrc ? <img src={tenantLogoSrc} alt={tenantInfo?.name || 'Estudio'} className="h-full w-full object-cover" /> : <HiOutlineUserGroup size={34} />}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-300">{tenantInfo?.name || 'Equipo'}</p>
          <h1 className="mt-2 text-4xl font-black leading-none">Acceso profesores.</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
            Entrada separada para docentes y equipo interno del estudio.
          </p>
        </div>

        <div className="rounded-[34px] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Email profesor</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <HiOutlineMail className="text-fuchsia-500" size={20} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  placeholder="profesor@estudio.cl"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Clave</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <HiOutlineLockClosed className="text-slate-500" size={20} />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  placeholder="Clave asignada"
                />
              </div>
            </label>

            {message ? <p className="rounded-2xl bg-fuchsia-50 px-4 py-3 text-sm font-bold text-fuchsia-700">{message}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-fuchsia-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-fuchsia-500/20 transition hover:bg-fuchsia-700 disabled:opacity-60"
            >
              {loading ? 'Ingresando...' : 'Ingresar equipo'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link to={studioSlug ? `/mobile/${studioSlug}` : '/mobile/login'} className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 hover:text-fuchsia-600">
              Volver a alumnos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
