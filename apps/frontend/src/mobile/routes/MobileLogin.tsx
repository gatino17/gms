import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { HiOutlineMail, HiOutlineShieldCheck } from 'react-icons/hi'
import { mobileApi, setMobileSession, setMobileTenant, setMobileTenantInfo, type MobileTenantInfo } from '../services/mobileApi'
import { toAbsoluteUrl } from '../../lib/api'
import MobileAuthBackground from '../components/MobileAuthBackground'

export default function MobileLogin() {
  const navigate = useNavigate()
  const { studioSlug } = useParams()
  const [email, setEmail] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [tenantInfo, setTenantInfo] = useState<MobileTenantInfo | null>(null)
  const [code, setCode] = useState('')
  const [debugCode, setDebugCode] = useState('')
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tenantLogoSrc = toAbsoluteUrl(tenantInfo?.logo_url)

  useEffect(() => {
    if (!studioSlug) return
    setError('')
    mobileApi.get<MobileTenantInfo>(`/api/pms/tenants/public/${studioSlug}`)
      .then((res) => {
        setTenantInfo(res.data)
        setTenantId(String(res.data.id))
        setMobileTenant(res.data.id)
        setMobileTenantInfo(res.data)
        if (!res.data.mobile_enabled || !res.data.student_portal_enabled) {
          setError('El portal de alumnos no esta habilitado para este estudio.')
        }
      })
      .catch((err) => setError(err?.message || 'No se pudo cargar el estudio.'))
  }, [studioSlug])

  const requestCode = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        email: email.trim(),
        tenant_id: tenantId.trim() ? Number(tenantId.trim()) : undefined,
      }
      const { data } = await mobileApi.post('/api/pms/students/portal/request_code', payload)
      setDebugCode(data?.code || '')
      setStep('confirm')
    } catch (err: any) {
      setError(err?.message || 'No se pudo solicitar el codigo.')
    } finally {
      setLoading(false)
    }
  }

  const confirmCode = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        email: email.trim(),
        code: code.trim(),
        tenant_id: tenantId.trim() ? Number(tenantId.trim()) : undefined,
      }
      const { data } = await mobileApi.post('/api/pms/students/portal/login', payload)
      const student = data.student
      setMobileSession(data.access_token, {
        id: student.id,
        email: student.email,
        first_name: student.first_name,
        last_name: student.last_name,
        tenant_id: student.tenant_id,
        role: 'student',
      })
      navigate('/mobile/home', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'No se pudo iniciar sesion.')
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
            <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-white bg-white shadow-2xl shadow-fuchsia-700/25">
              <img src={tenantLogoSrc || '/gms-soluciones-digitales.jpg'} alt={tenantInfo?.name || 'Estudio'} className="h-full w-full object-cover" />
            </div>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-fuchsia-300">{tenantInfo?.name || 'GMS Mobile'}</p>
          <h1 className="mt-2 text-4xl font-black leading-none">Portal de alumnos.</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
            Ingresa con tu correo para revisar asistencia, pagos, cursos y novedades de tu estudio.
          </p>
        </div>

        <div className="rounded-[34px] border border-white/10 bg-white p-5 text-slate-950 shadow-2xl">
          <div className="mb-5 rounded-2xl bg-fuchsia-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-600">Acceso alumno</p>
            <p className="mt-1 text-xs font-bold text-slate-600">Recibiras un codigo temporal para entrar.</p>
          </div>

          <form onSubmit={step === 'request' ? requestCode : confirmCode} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Email</span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <HiOutlineMail className="text-fuchsia-500" size={20} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </label>

            {!studioSlug ? <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Tenant ID opcional</span>
              <input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-fuchsia-400"
                placeholder="Solo si el alumno existe en mas de un estudio"
              />
            </label> : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Estudio</p>
                <p className="mt-1 text-sm font-black text-slate-950">{tenantInfo?.name || studioSlug}</p>
              </div>
            )}

            {step === 'confirm' ? (
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Codigo</span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <HiOutlineShieldCheck className="text-emerald-500" size={20} />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    required
                    className="w-full bg-transparent text-sm font-bold outline-none"
                    placeholder="000000"
                  />
                </div>
                {debugCode ? (
                  <p className="mt-2 rounded-xl bg-fuchsia-50 px-3 py-2 text-xs font-bold text-fuchsia-700">
                    Codigo de prueba: {debugCode}
                  </p>
                ) : null}
              </label>
            ) : null}

            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 transition hover:bg-fuchsia-700 disabled:opacity-60"
            >
              {loading ? 'Procesando...' : step === 'request' ? 'Solicitar codigo' : 'Ingresar'}
            </button>
          </form>
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <Link to={studioSlug ? `/mobile/staff/${studioSlug}` : '/mobile/staff'} className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 hover:text-fuchsia-600">
              Acceso equipo
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
