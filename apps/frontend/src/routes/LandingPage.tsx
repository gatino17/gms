import { Link, Navigate } from 'react-router-dom'
import {
  HiOutlineArrowRight,
  HiOutlineBookOpen,
  HiOutlineCalendar,
  HiOutlineChartBar,
  HiOutlineCurrencyDollar,
  HiOutlineOfficeBuilding,
  HiOutlineUserGroup,
} from 'react-icons/hi'
import { useAuth } from '../context/AuthContext'

const sectors = [
  {
    icon: <HiOutlineBookOpen className="text-xl" />,
    title: 'Studios y academias',
    text: 'Control de alumnos, asistencia, cursos, profesores y pagos desde una misma plataforma.',
  },
  {
    icon: <HiOutlineOfficeBuilding className="text-xl" />,
    title: 'APR y gestion operativa',
    text: 'Procesos administrativos y seguimiento interno para equipos que hoy dependen de papel o planillas.',
  },
  {
    icon: <HiOutlineCurrencyDollar className="text-xl" />,
    title: 'Boutique y ventas',
    text: 'Inventario, clientes y movimientos llevados a una solucion web mas clara y util.',
  },
]

const capabilities = [
  'Transformamos procesos manuales en flujos web claros y medibles.',
  'Creamos soluciones utiles para equipos que necesitan orden real.',
  'Partimos desde modulos probados y tambien construimos soluciones a medida.',
]

const modules = [
  { label: 'Studios', value: 'Modulo probado', detail: 'Academias, baile, karate, natacion y mas.' },
  { label: 'WhatsApp', value: 'Cobranza guiada', detail: 'Plantillas aprobadas, seguimiento y control operativo.' },
  { label: 'Procesos', value: 'Digitalizacion real', detail: 'Papel, planillas y tareas dispersas llevadas a un sistema web.' },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div id="top" className="min-h-screen bg-[#06060a] text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(180deg,_#08080f_0%,_#0d0d16_45%,_#050509_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,transparent_0,transparent_39px,rgba(255,255,255,0.12)_40px),linear-gradient(to_bottom,transparent_0,transparent_39px,rgba(255,255,255,0.12)_40px)] bg-[size:40px_40px]" />
      </div>

      <header className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/gms-soluciones-digitales.jpg"
              alt="GMS Soluciones Digitales"
              className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-[0_24px_50px_-20px_rgba(236,72,153,0.55)]"
            />
            <div>
              <p className="text-lg font-black tracking-tight text-white">GMS Soluciones Digitales</p>
              <p className="text-[10px] uppercase tracking-[0.35em] font-bold text-white/45">Digitalizacion para emprendimientos</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#soluciones"
              className="hidden sm:inline-flex px-5 py-3 rounded-2xl border border-white/10 bg-white/5 text-white/70 text-xs font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
            >
              Ver soluciones
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-950 text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-fuchsia-500/15"
            >
              Login
              <HiOutlineArrowRight className="text-base" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-8 lg:pt-16 pb-20 lg:pb-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-200">
              <HiOutlineChartBar className="text-sm" />
              GMS soluciones digitales
            </div>

            <div className="space-y-5">
              <h1 className="max-w-5xl text-5xl lg:text-7xl font-black tracking-tight leading-[0.94] text-white">
                Digitalizamos emprendimientos con sistemas web para procesos reales.
              </h1>
              <p className="max-w-3xl text-base lg:text-lg leading-8 text-white/68 font-medium">
                Si hoy trabajas con papel, planillas o tareas manuales, te ayudamos a ordenar y mejorar tu operacion con sistemas web utiles para tu negocio.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 max-w-4xl">
              {modules.map((module) => (
                <div
                  key={module.label}
                  className="rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.8)]"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-200/80">{module.label}</p>
                  <p className="mt-4 text-xl lg:text-2xl font-black tracking-tight text-white">{module.value}</p>
                  <p className="mt-3 text-xs lg:text-sm leading-6 text-white/55">{module.detail}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href="#contacto"
                className="inline-flex items-center gap-3 px-7 py-4 rounded-[22px] bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-sm font-black uppercase tracking-widest shadow-[0_28px_60px_-28px_rgba(217,70,239,0.8)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Solicitar reunion
                <HiOutlineArrowRight className="text-lg" />
              </a>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-[22px] border border-white/10 bg-white/5 text-white text-sm font-black uppercase tracking-widest hover:bg-white/10 transition-all"
              >
                Ingresar al sistema
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-fuchsia-500/25 blur-3xl" />
            <div className="relative rounded-[40px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-6 lg:p-8 shadow-[0_40px_90px_-40px_rgba(236,72,153,0.45)]">
              <div className="rounded-[32px] border border-white/10 bg-[#0f1018] p-6 lg:p-7">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-200/80">Modulo destacado</p>
                    <h2 className="mt-3 text-2xl lg:text-3xl font-black tracking-tight text-white">Studios</h2>
                    <p className="mt-3 text-sm leading-6 text-white/58 max-w-sm">
                      Ya contamos con un modulo operativo para estudios y academias: baile, karate, natacion y otros formatos con control diario.
                    </p>
                  </div>
                  <img
                    src="/gms-soluciones-digitales.jpg"
                    alt="Logo GMS"
                    className="hidden sm:block w-20 h-20 rounded-[26px] object-cover border border-white/10"
                  />
                </div>

                <div className="mt-8 grid gap-4">
                  {capabilities.map((capability, idx) => (
                    <div key={capability} className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4 flex items-start gap-4">
                      <div className="w-9 h-9 rounded-2xl bg-fuchsia-500/12 border border-fuchsia-400/15 text-fuchsia-200 flex items-center justify-center text-sm font-black">
                        0{idx + 1}
                      </div>
                      <p className="text-sm leading-6 text-white/68 font-medium">{capability}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-3 gap-3">
                  <div className="rounded-[22px] bg-white/[0.03] border border-white/8 p-4">
                    <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/12 text-fuchsia-200 flex items-center justify-center">
                      <HiOutlineUserGroup className="text-xl" />
                    </div>
                    <p className="mt-4 text-sm font-black text-white">Alumnos y clientes</p>
                  </div>
                  <div className="rounded-[22px] bg-white/[0.03] border border-white/8 p-4">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/12 text-cyan-200 flex items-center justify-center">
                      <HiOutlineCalendar className="text-xl" />
                    </div>
                    <p className="mt-4 text-sm font-black text-white">Agenda y asistencia</p>
                  </div>
                  <div className="rounded-[22px] bg-white/[0.03] border border-white/8 p-4">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/12 text-emerald-200 flex items-center justify-center">
                      <HiOutlineCurrencyDollar className="text-xl" />
                    </div>
                    <p className="mt-4 text-sm font-black text-white">Cobranza y pagos</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="soluciones" className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="max-w-3xl">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-200/80">Que podemos digitalizar</p>
              <h2 className="mt-4 text-2xl lg:text-4xl font-black tracking-tight text-white">
                Soluciones listas y desarrollos a medida para distintos rubros.
              </h2>
            </div>
            <p className="max-w-xl text-sm lg:text-base leading-7 text-white/58 font-medium">
              No todo emprendimiento necesita la misma herramienta. Partimos por la operacion real del negocio y desde ahi definimos la solucion correcta.
            </p>
          </div>

          <div className="mt-10 grid lg:grid-cols-3 gap-5">
            {sectors.map((sector) => (
              <div
                key={sector.title}
                className="rounded-[30px] border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 shadow-[0_26px_70px_-40px_rgba(15,23,42,0.85)]"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/8 text-fuchsia-200 flex items-center justify-center">
                  {sector.icon}
                </div>
                <h3 className="mt-6 text-xl lg:text-2xl font-black tracking-tight text-white">{sector.title}</h3>
                <p className="mt-4 text-sm lg:text-base leading-7 text-white/58 font-medium">{sector.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
          <div className="rounded-[40px] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/15 via-white/[0.05] to-cyan-500/12 p-8 lg:p-14 shadow-[0_40px_120px_-50px_rgba(217,70,239,0.55)]">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 items-start">
              <div id="contacto">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-200/80">Hablemos de tu proceso</p>
                <h2 className="mt-4 text-2xl lg:text-4xl font-black tracking-tight text-white">
                  Si tu operacion aun depende de papel, podemos modernizarla.
                </h2>
                <p className="mt-5 text-sm lg:text-base leading-7 text-white/60 font-medium">
                  Ya tenemos un modulo para studios y academias, y tambien desarrollamos soluciones personalizadas para APR de aguas, boutique y otros modelos de gestion.
                </p>
                <div className="mt-8 rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40">Contacto referencial</p>
                  <a
                    href="mailto:contacto@gms.com"
                    className="mt-3 inline-flex text-lg lg:text-2xl font-black tracking-tight text-white hover:text-fuchsia-200 transition-colors"
                  >
                    contacto@gms.com
                  </a>
                  <p className="mt-2 text-sm leading-7 text-white/55">
                    Agenda una reunion y revisamos que parte de tu operacion conviene digitalizar primero.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40">Paso 1</p>
                  <p className="mt-4 text-base lg:text-lg font-black text-white">Reunion y diagnostico</p>
                  <p className="mt-3 text-sm leading-6 text-white/58">Revisamos como trabajas hoy y que conviene digitalizar primero.</p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/40">Paso 2</p>
                  <p className="mt-4 text-base lg:text-lg font-black text-white">Propuesta concreta</p>
                  <p className="mt-3 text-sm leading-6 text-white/58">Definimos si conviene usar un modulo existente, adaptarlo o construir una solucion a medida.</p>
                </div>
                <div className="rounded-[28px] border border-white/10 bg-black/20 p-6 sm:col-span-2">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-fuchsia-200/75">Resultado esperado</p>
                  <p className="mt-4 text-2xl lg:text-3xl font-black tracking-tight text-white">Menos desorden. Mejor seguimiento. Una operacion mas profesional.</p>
                  <p className="mt-4 max-w-2xl text-sm lg:text-base leading-6 text-white/58 font-medium">
                    Llevamos tu operacion a un sistema claro, medible y listo para crecer.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {['Menos papel', 'Mas control', 'Mejor seguimiento'].map((item) => (
                      <span
                        key={item}
                        className="inline-flex px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.22em] text-white/70"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="mailto:contacto@gms.com"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-slate-950 text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                    >
                      Solicitar reunion
                      <HiOutlineArrowRight className="text-base" />
                    </a>
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Acceso clientes
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
