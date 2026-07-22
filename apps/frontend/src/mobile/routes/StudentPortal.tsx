import { useEffect, useState } from 'react'
import MobileCard from '../components/MobileCard'
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
      label: 'Pagado',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    }
  }
  return {
    label: 'Pendiente',
    className: 'bg-rose-50 text-rose-700 border-rose-100',
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
      <MobileCard eyebrow="Progreso" title={`${Math.round(summary?.attendance?.percent || 0)}% de asistencia`}>
        <p className="text-sm font-semibold text-slate-600">Resumen inicial del alumno conectado al portal.</p>
      </MobileCard>

      <MobileCard accent="blue" eyebrow="Cursos activos" title={`${summary?.enrollments?.filter((item) => item.is_active).length || 0} cursos`}>
        <div className="space-y-3">
          {summary?.enrollments?.length ? summary.enrollments.map((item, index) => {
            const courseName = item.course?.name || item.course_name || 'Curso sin nombre'
            const status = enrollmentStatus(item)
            return (
              <div key={`${courseName}-${index}`} className="relative rounded-2xl bg-white/80 p-4 pt-6 shadow-sm shadow-slate-200/70">
                <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${status.className}`}>
                  {status.label}
                </span>
                <p className="font-black">{courseName}</p>
                {item.course?.teacher_name ? (
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Prof. {item.course.teacher_name}</p>
                ) : null}
                <p className="mt-1 text-xs font-bold text-slate-500">{item.start_date || '-'} / {item.end_date || '-'}</p>
              </div>
            )
          }) : <p className="text-sm font-semibold text-slate-600">Sin cursos para mostrar.</p>}
        </div>
      </MobileCard>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p> : null}
    </div>
  )
}
