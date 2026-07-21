import { useEffect, useState } from 'react'
import MobileCard from '../components/MobileCard'
import { mobileApi } from '../services/mobileApi'

interface StudentSummary {
  attendance?: { percent?: number; recent?: any[] }
  enrollments?: Array<{ course_name?: string; is_active?: boolean; start_date?: string; end_date?: string }>
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
          {summary?.enrollments?.length ? summary.enrollments.map((item, index) => (
            <div key={`${item.course_name}-${index}`} className="rounded-2xl bg-white/80 p-4">
              <p className="font-black">{item.course_name || 'Curso'}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{item.start_date || '-'} / {item.end_date || '-'}</p>
            </div>
          )) : <p className="text-sm font-semibold text-slate-600">Sin cursos para mostrar.</p>}
        </div>
      </MobileCard>

      {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p> : null}
    </div>
  )
}
