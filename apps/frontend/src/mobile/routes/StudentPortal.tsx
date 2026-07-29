import { useEffect, useState } from 'react'
import {
  HiOutlineAcademicCap,
  HiOutlineChartBar,
  HiOutlineEmojiHappy,
  HiOutlineFire,
  HiOutlineGift,
  HiOutlineLightningBolt,
  HiOutlineSparkles,
  HiOutlineStar,
} from 'react-icons/hi'
import { toAbsoluteUrl } from '../../lib/api'
import { getMobileCache, getMobileUser, mobileApi, mobileCacheKey, setMobileCache } from '../services/mobileApi'

interface StudentSummary {
  tenant?: {
    id?: number
    name?: string | null
    logo_url?: string | null
  }
  attendance?: {
    percent?: number
    attendance_rate?: number
    period_progress_percent?: number
    attended?: number
    expected?: number
    elapsed_expected?: number
    recent?: any[]
  }
  highlight_progress?: {
    status?: string
    message?: string
    payments_current?: boolean
    months_completed?: number
    progress_percent?: number
    stage_months?: number
    stage_progress_percent?: number
    current_tier_months?: number | null
    current_tier_label?: string | null
    next_tier_months?: number | null
    next_tier_label?: string | null
    target_tier_months?: number | null
    target_tier_label?: string | null
    required_attendance?: number | null
    attendance_rate?: number
    attended?: number
    expected?: number
    celebration_key?: string | null
    celebration_months?: number | null
    celebration_title?: string | null
    celebration_message?: string | null
  }
  enrollments?: Array<{
    course_name?: string
    is_active?: boolean
    payment_status?: string | null
    start_date?: string
    end_date?: string
    course?: {
      name?: string | null
      teacher_name?: string | null
    }
  }>
}

const enrollmentStatus = (item: NonNullable<StudentSummary['enrollments']>[number]) => {
  if (item.is_active === false) {
    return {
      label: 'Inactivo',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
    }
  }
  if (item.payment_status === 'activo') {
    return {
      label: 'Al dia',
      className: 'bg-emerald-500 text-white border-emerald-300 shadow-emerald-200/80',
    }
  }
  return {
    label: 'Pendiente',
    className: 'bg-rose-500 text-white border-rose-300 shadow-rose-200/80',
  }
}

const celebrationVariants = {
  1: {
    Icon: HiOutlineSparkles,
    Decoration: HiOutlineSparkles,
    accent: 'mobile-text-primary',
    badge: 'mobile-bg-primary',
    glow: 'shadow-fuchsia-200/80',
    dot: 'bg-fuchsia-300',
  },
  2: {
    Icon: HiOutlineStar,
    Decoration: HiOutlineStar,
    accent: 'text-amber-500',
    badge: 'bg-gradient-to-br from-amber-300 to-yellow-500',
    glow: 'shadow-amber-200/80',
    dot: 'bg-amber-300',
  },
  3: {
    Icon: HiOutlineFire,
    Decoration: HiOutlineFire,
    accent: 'text-orange-500',
    badge: 'bg-gradient-to-br from-orange-500 to-rose-600',
    glow: 'shadow-orange-200/80',
    dot: 'bg-orange-300',
  },
  4: {
    Icon: HiOutlineEmojiHappy,
    Decoration: HiOutlineSparkles,
    accent: 'text-emerald-500',
    badge: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    glow: 'shadow-emerald-200/80',
    dot: 'bg-emerald-300',
  },
  6: {
    Icon: HiOutlineLightningBolt,
    Decoration: HiOutlineLightningBolt,
    accent: 'text-sky-500',
    badge: 'bg-gradient-to-br from-sky-400 to-indigo-600',
    glow: 'shadow-sky-200/80',
    dot: 'bg-sky-300',
  },
  12: {
    Icon: HiOutlineGift,
    Decoration: HiOutlineStar,
    accent: 'text-rose-500',
    badge: 'bg-gradient-to-br from-rose-500 to-slate-950',
    glow: 'shadow-rose-200/80',
    dot: 'bg-rose-300',
  },
}

export default function StudentPortal() {
  const user = getMobileUser()
  const cacheKey = mobileCacheKey('student-summary', user)
  const [summary, setSummary] = useState<StudentSummary | null>(() => getMobileCache<StudentSummary>(cacheKey))
  const [error, setError] = useState('')
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const highlight = summary?.highlight_progress
  const tenantLogo = toAbsoluteUrl(summary?.tenant?.logo_url)
  const targetMonths = highlight?.target_tier_months || highlight?.next_tier_months || highlight?.current_tier_months || 4
  const progressPercent = Math.min(100, Math.max(0, Math.round(highlight?.stage_progress_percent ?? highlight?.progress_percent ?? 0)))
  const stageMonths = highlight?.stage_months || targetMonths
  const highlightTitle = highlight?.current_tier_label
    ? `Alumno destacado ${highlight.current_tier_months}M`
    : `Camino a destacado ${targetMonths}M`
  const highlightStatus = highlight?.payments_current === false
    ? 'Pago pendiente'
    : highlight?.current_tier_label
      ? 'Meta lograda'
      : 'En progreso'
  const periodAttended = summary?.attendance?.attended || 0
  const periodExpected = summary?.attendance?.expected || 0
  const elapsedExpected = summary?.attendance?.elapsed_expected || 0
  const attendanceRate = Math.round(summary?.attendance?.percent ?? summary?.attendance?.attendance_rate ?? 0)
  const periodProgress = Math.round(summary?.attendance?.period_progress_percent ?? summary?.attendance?.percent ?? 0)
  const celebrationMonth = (highlight?.celebration_months || 1) as keyof typeof celebrationVariants
  const celebrationVariant = celebrationVariants[celebrationMonth] || celebrationVariants[1]
  const CelebrationIcon = celebrationVariant.Icon
  const CelebrationDecoration = celebrationVariant.Decoration

  useEffect(() => {
    mobileApi.get('/api/pms/students/portal/me')
      .then((res) => {
        setSummary(res.data)
        setMobileCache(cacheKey, res.data)
      })
      .catch((err) => setError(err?.message || 'No se pudo cargar el portal.'))
  }, [cacheKey])

  useEffect(() => {
    const key = highlight?.celebration_key
    if (!key || !summary?.tenant?.id || !user?.id) return
    const storageKey = `gms-mobile-celebration:${summary.tenant.id}:${user.id}:${key}`
    if (localStorage.getItem(storageKey)) return
    setCelebrationOpen(true)
  }, [highlight?.celebration_key, summary?.tenant?.id, user?.id])

  const closeCelebration = () => {
    const key = highlight?.celebration_key
    if (key && summary?.tenant?.id && user?.id) {
      localStorage.setItem(`gms-mobile-celebration:${summary.tenant.id}:${user.id}:${key}`, '1')
    }
    setCelebrationOpen(false)
  }

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/70">
        <HiOutlineSparkles className="pointer-events-none absolute -right-4 -top-4 text-fuchsia-100" size={104} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mobile-text-primary mb-2 text-[10px] font-black uppercase tracking-[0.24em]">Progreso destacado</p>
            <h2 className="text-2xl font-black leading-tight text-slate-950">{highlightTitle}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {highlight?.message || 'Tu avance registrado en el estudio.'}
            </p>
          </div>
          <div className="mobile-bg-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-white shadow-lg shadow-slate-300/70">
            <HiOutlineChartBar size={30} />
          </div>
        </div>

        <div className="relative mt-5 flex items-center justify-end">
          <span className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${highlight?.payments_current === false ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {highlight?.payments_current === false ? 'Pendiente' : 'Al dia'}
          </span>
        </div>

        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Asistencia</p>
            <p className="mt-1 text-sm font-black text-slate-950">{attendanceRate}%</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{periodAttended}/{periodExpected} clases</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Periodo</p>
            <p className="mt-1 text-sm font-black text-slate-950">{periodProgress}%</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{elapsedExpected}/{periodExpected} clases</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-2 py-3 text-center">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Meses</p>
            <p className="mt-1 text-sm font-black text-slate-950">{highlight?.months_completed || 0}/{stageMonths}</p>
            <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">Objetivo</p>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white">{highlightStatus}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Objetivo: {stageMonths}M
          </span>
        </div>
        <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="mobile-bg-primary h-full rounded-full" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <section
        className="mobile-bg-primary rounded-[28px] border border-white/20 p-5 text-white shadow-xl shadow-slate-300/70"
      >
        <div className="flex items-center gap-3">
          <HiOutlineAcademicCap className="shrink-0 text-white" size={30} />
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">Cursos activos</p>
            <h2 className="text-xl font-black leading-tight">{summary?.enrollments?.filter((item) => item.is_active).length || 0} cursos</h2>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {summary?.enrollments?.length ? summary.enrollments.map((item, index) => {
            const courseName = item.course?.name || item.course_name || 'Curso sin nombre'
            const status = enrollmentStatus(item)
            return (
              <div key={`${courseName}-${index}`} className="relative mt-4 rounded-2xl border border-white/80 bg-white p-4 pt-7 text-slate-950 shadow-sm shadow-slate-300/50">
                <span className={`absolute right-4 top-0 -translate-y-1/2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-lg ${status.className}`}>
                  {status.label}
                </span>
                <p className="font-black">{courseName}</p>
                {item.course?.teacher_name ? (
                  <p className="mobile-text-primary mt-1 text-[10px] font-black uppercase tracking-widest">Prof. {item.course.teacher_name}</p>
                ) : null}
                <p className="mt-1 text-xs font-bold text-slate-500">{item.start_date || '-'} / {item.end_date || '-'}</p>
              </div>
            )
          }) : <p className="text-sm font-semibold text-slate-600">Sin cursos para mostrar.</p>}
        </div>
      </section>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p> : null}

      {celebrationOpen && highlight?.celebration_key ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 px-4 pb-5 pt-10 backdrop-blur-sm">
          <div className="relative w-full max-w-sm overflow-hidden rounded-[34px] bg-white p-6 text-center shadow-2xl shadow-slate-950/40">
            <CelebrationDecoration className={`${celebrationVariant.accent} absolute -left-3 top-7 opacity-25`} size={74} />
            <HiOutlineSparkles className={`${celebrationVariant.accent} absolute -right-2 top-24 opacity-20`} size={54} />
            <span className={`absolute left-10 top-28 h-2 w-2 rounded-full ${celebrationVariant.dot}`} />
            <span className={`absolute right-12 top-12 h-3 w-3 rounded-full ${celebrationVariant.dot} opacity-70`} />
            <span className={`absolute right-20 bottom-28 h-1.5 w-1.5 rounded-full ${celebrationVariant.dot} opacity-80`} />
            <div className={`relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-slate-950 shadow-xl ${celebrationVariant.glow}`}>
              {tenantLogo ? (
                <img src={tenantLogo} alt={summary?.tenant?.name || 'Estudio'} className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-white">{(summary?.tenant?.name || 'GMS').slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <p className={`${celebrationVariant.accent} mt-5 text-[10px] font-black uppercase tracking-[0.28em]`}>Logro desbloqueado</p>
            <h3 className="mt-2 text-3xl font-black leading-tight text-slate-950">
              {highlight.celebration_title || 'Meta cumplida'}
            </h3>
            <p className="mx-auto mt-3 max-w-[260px] text-sm font-bold leading-6 text-slate-500">
              {highlight.celebration_message || 'Tu constancia ya esta dando resultados.'}
            </p>
            <div className={`${celebrationVariant.badge} ${celebrationVariant.glow} mx-auto mt-5 flex h-16 min-w-20 items-center justify-center gap-2 rounded-2xl px-4 text-xl font-black text-white shadow-lg`}>
              <CelebrationIcon size={24} />
              <span>{highlight.celebration_months}M</span>
            </div>
            <button
              type="button"
              onClick={closeCelebration}
              className="mobile-bg-primary mt-6 w-full rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-300/80"
            >
              Seguir avanzando
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
