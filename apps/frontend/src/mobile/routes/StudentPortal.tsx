import { useEffect, useState } from 'react'
import { HiOutlineAcademicCap, HiOutlineChartBar } from 'react-icons/hi'
import { mobileApi } from '../services/mobileApi'

interface StudentSummary {
  attendance?: { percent?: number; recent?: any[] }
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
      label: 'Al día',
      className: 'bg-emerald-500 text-white border-emerald-300 shadow-emerald-200/80',
    }
  }
  return {
    label: 'Pendiente',
    className: 'bg-rose-500 text-white border-rose-300 shadow-rose-200/80',
  }
}

export default function StudentPortal() {
  const [summary, setSummary] = useState<StudentSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    mobileApi.get('/api/pms/students/portal/me')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err?.message || 'No se pudo cargar el portal.'))
  }, [])

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/70">
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="mobile-text-primary mb-2 text-[10px] font-black uppercase tracking-[0.24em]">Progreso</p>
            <h2 className="text-2xl font-black leading-tight text-slate-950">{Math.round(summary?.attendance?.percent || 0)}% asistencia</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Tu avance registrado en el estudio.</p>
          </div>
          <div className="mobile-bg-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-white shadow-lg shadow-slate-300/70">
            <HiOutlineChartBar size={30} />
          </div>
        </div>
        <div className="relative mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="mobile-bg-primary h-full rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, Math.round(summary?.attendance?.percent || 0)))}%` }}
          />
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
    </div>
  )
}
