import React, { useEffect, useMemo, useState } from 'react'
import type { CourseLite } from '../routes/StudentsPage'
import { api, toAbsoluteUrl } from '../lib/api'

type EnrollItem = {
  courseId: string
  planType: 'monthly'|'single_class'
  lessonsPerWeek: '1'|'2'
  start: string
  end: string
  endAuto: boolean
  payNow: boolean
  paymentAmount: string
  paymentDate: string
}
const newEnrollItem = (): EnrollItem => ({
  courseId: '',
  planType: 'monthly',
  lessonsPerWeek: '1',
  start: '',
  end: '',
  endAuto: true,
  payNow: false,
  paymentAmount: '',
  paymentDate: ''
})

type PortalData = {
  student: { id:number; first_name:string; last_name:string; email?:string|null }
  enrollments: {
    id:number; is_active:boolean;
    start_date?:string|null; end_date?:string|null;
    course:{ id:number; name:string; day_of_week?:number|null; start_time?:string|null; end_time?:string|null }
  }[]
}

type CurrentEnrollment = {
  enrollment_id: number
  course_id: number
  name: string
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
  schedule?: string
  status: 'activo'|'vencido'|'sin_fechas'
}

type Props = {
  open: boolean
  onClose: ()=>void
  studentId: number
  studentName: string
  courses: CourseLite[]
  getCourse: (cid:string)=>CourseLite|undefined
  suggestedAmountFor: (it: EnrollItem)=>number|null
  computeEnd: (start:string, lessons:'1'|'2', plan:'monthly'|'single_class', courseId?: string)=>string
  load: ()=>Promise<void>
}

function formatDateDDMMYYYY(ymd?: string | null) {
  if (!ymd) return ''
  const [y,m,d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

function addDays(ymd: string, days: number) {
  const d = new Date(ymd)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0,10)
}

export default function AddCourseModal(props: Props){
  const {
    open, onClose, studentId, studentName,
    courses, getCourse, suggestedAmountFor, computeEnd, load
  } = props

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string|null>(null)

  const [enrollItems, setEnrollItems] = useState<EnrollItem[]>([newEnrollItem()])
  const [paymentMode, setPaymentMode] = useState<'none'|'total'|'per_course'>('none')
  const [summaryMethod, setSummaryMethod] = useState<'cash'|'card'|'transfer'|'convenio'>('cash')
  const [summaryDiscount, setSummaryDiscount] = useState<string>('')   // "0" | "10%" | "5000"
  const [summaryPaymentDate, setSummaryPaymentDate] = useState<string>('')
  const [summaryReference, setSummaryReference] = useState<string>('')

  // Extrae cursos ya inscritos desde /portal
  const [portal, setPortal] = useState<PortalData | null>(null)
  const [alreadyEnrolledIds, setAlreadyEnrolledIds] = useState<Set<number>>(new Set())
  const [currentEnrs, setCurrentEnrs] = useState<CurrentEnrollment[]>([])
  const [loadError, setLoadError] = useState<string|null>(null)
  const pendingRenewIds = useMemo(() => {
    const set = new Set<number>()
    enrollItems.forEach(it => {
      if (it.courseId) set.add(Number(it.courseId))
    })
    return set
  }, [enrollItems])
  const visibleEnrs = useMemo(
    () => currentEnrs.filter(e => !pendingRenewIds.has(e.course_id)),
    [currentEnrs, pendingRenewIds]
  )

  const priceCLP = (v:any) => (v==null? null : new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(Number(v)))
  const todayStr = () => {
    const td=new Date(); const y=td.getFullYear(); const m=String(td.getMonth()+1).padStart(2,'0'); const d=String(td.getDate()).padStart(2,'0')
    return `${y}-${m}-${d}`
  }

  useEffect(()=>{
    if(!open) return
    // reset UI
    setEnrollItems([newEnrollItem()])
    setPaymentMode('none')
    setSummaryMethod('cash')
    setSummaryDiscount('')
    setSummaryPaymentDate(todayStr())
    setSummaryReference('')
    setSaveError(null)
    setLoadError(null)

    ;(async ()=>{
      try{
        const res = await api.get(`/api/pms/students/${studentId}/portal`)
        const p = res.data as PortalData
        setPortal(p)
        const ids = new Set<number>((p.enrollments || []).map(e => e.course.id))
        setAlreadyEnrolledIds(ids)

        const now = new Date().toISOString().slice(0,10)
        const list: CurrentEnrollment[] = (p.enrollments || []).map(e => {
          const w = e.course.day_of_week
          const dn = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
          const name = e.course.name
          const schedule = [
            typeof w === 'number' ? dn[(w+7)%7] : null,
            e.course.start_time ? String(e.course.start_time).slice(0,5) : null,
            e.course.end_time ? ` - ${String(e.course.end_time).slice(0,5)}` : null
          ].filter(Boolean).join(' ')
          let status: CurrentEnrollment['status'] = 'sin_fechas'
          if (e.start_date || e.end_date){
            if (!e.end_date || now <= e.end_date) status = 'activo'
            else status = 'vencido'
          }
          return {
            enrollment_id: e.id,
            course_id: e.course.id,
            name,
            start_date: e.start_date ?? null,
            end_date: e.end_date ?? null,
            is_active: e.is_active,
            schedule,
            status
          }
        })
        // deduplicar: quedarnos con la inscripción más reciente por curso
        const byCourse = new Map<number, CurrentEnrollment[]>()
        for (const enr of list) {
          const arr = byCourse.get(enr.course_id) || []
          arr.push(enr)
          byCourse.set(enr.course_id, arr)
        }
        const dedup: CurrentEnrollment[] = []
        for (const arr of byCourse.values()) {
          arr.sort((a,b) => {
            const aEnd = a.end_date || a.start_date || ''
            const bEnd = b.end_date || b.start_date || ''
            if (aEnd !== bEnd) return bEnd.localeCompare(aEnd) // más reciente primero
            return (b.start_date || '').localeCompare(a.start_date || '')
          })
          dedup.push(arr[0])
        }
        dedup.sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'es'))
        setCurrentEnrs(dedup)
      }catch(e:any){
        setPortal(null)
        setAlreadyEnrolledIds(new Set())
        setCurrentEnrs([])
        setLoadError(e?.message || 'No se pudo cargar el perfil del alumno')
      }
    })()
  }, [open, studentId])

  const paymentPreview = useMemo(()=>{
    if (paymentMode === 'none') return null
    const items = paymentMode === 'total'
      ? enrollItems.filter((it)=>it.courseId)
      : enrollItems.filter((it)=>it.courseId && it.payNow)
    const lines = items.map((it, i)=>{
      const c = getCourse(it.courseId)
      const sug = suggestedAmountFor(it) ?? 0
      const manual = Number(it.paymentAmount || '0')
      const amt = paymentMode==='total' ? (Number(sug)||0) : ((Number.isFinite(manual)&&manual>0)?manual:(Number(sug)||0))
      return { name: c?.name || `Curso ${i+1}`, amt: Number.isFinite(amt)?amt:0 }
    })
    const subtotal = lines.reduce((a, x)=> a + (Number.isFinite(x.amt)?x.amt:0), 0)
    const discRaw = String(summaryDiscount || '').trim()
    let discountApplied = 0
    if (discRaw.endsWith('%')) {
      const p = Number(discRaw.slice(0, -1))
      if (Number.isFinite(p) && p > 0) discountApplied = subtotal * Math.min(100, Math.max(0, p)) / 100
    } else {
      const n = Number(discRaw || '0')
      if (Number.isFinite(n) && n > 0) discountApplied = n <= 100 ? (subtotal * n / 100) : n
    }
    discountApplied = Math.min(subtotal, discountApplied)
    const totalAfter = Math.max(0, subtotal - discountApplied)
    return { count: items.length, subtotal, discountApplied, totalAfter, lines }
  }, [paymentMode, enrollItems, summaryDiscount]) // eslint-disable-line

  const handleRenewFromEnrollment = (enr: CurrentEnrollment) => {
    const courseId = String(enr.course_id)
    const c = getCourse(courseId)
    const lessons: '1'|'2' = (c?.classes_per_week ?? 1) >= 2 ? '2' : '1'
    const start = enr.end_date ? addDays(enr.end_date, 1) : todayStr()
    const end = computeEnd(start, lessons, 'monthly', courseId)
    const suggested = c?.price
    const paymentAmount = (suggested != null && !Number.isNaN(Number(suggested))) ? String(suggested) : ''
    const renewal: EnrollItem = {
      courseId,
      planType: 'monthly',
      lessonsPerWeek: lessons,
      start,
      end,
      endAuto: true,
      payNow: true,
      paymentAmount,
      paymentDate: start || todayStr()
    }
    setEnrollItems([renewal])
    setPaymentMode('per_course')
    setSummaryPaymentDate(start || todayStr())
    setSaveError(null)
  }

  const startRenewFromCourseId = (courseId: string) => {
    const enr = currentEnrs.find(e => String(e.course_id) === String(courseId))
    if (enr) handleRenewFromEnrollment(enr)
  }

  const updateEnroll = (idx:number, patch: Partial<EnrollItem>) => {
    setEnrollItems(list=>{
      const next = [...list]
      const cur  = { ...next[idx], ...patch }

      if (patch.courseId !== undefined && cur.planType === 'monthly') {
        // Si el curso ya está inscrito, lanzar flujo de renovación y no duplicar fila
        if (alreadyEnrolledIds.has(Number(patch.courseId))) {
          startRenewFromCourseId(patch.courseId)
          return list
        }
        const c = getCourse(cur.courseId)
        const cpw = (c?.classes_per_week ?? 1)
        cur.lessonsPerWeek = cpw >= 2 ? '2' : '1'
      }
      if (patch.planType === 'single_class') cur.lessonsPerWeek = '1'

      const needEndAuto = patch.start !== undefined || patch.lessonsPerWeek !== undefined || patch.planType !== undefined || patch.courseId !== undefined
      if (needEndAuto && cur.endAuto) cur.end = computeEnd(cur.start, cur.lessonsPerWeek, cur.planType, cur.courseId)

      if ((patch.courseId !== undefined || patch.planType !== undefined) && cur.payNow) {
        const c = getCourse(cur.courseId)
        const suggested = cur.planType === 'single_class' ? c?.class_price : c?.price
        if (suggested != null && !Number.isNaN(Number(suggested))) cur.paymentAmount = String(suggested)
      }

      next[idx] = cur
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    try{
      // crear inscripciones
      for (const it of enrollItems) {
        if (!it.courseId) continue
        // Normaliza fechas: si falta "end" y endAuto está activo, calcular antes de guardar
        const normStart = it.start
        const normEnd = (!it.end && it.endAuto && it.start)
          ? computeEnd(it.start, (it.planType==='single_class' ? '1' : it.lessonsPerWeek), it.planType, it.courseId)
          : it.end
        const ePayload:any = { student_id: studentId, course_id: Number(it.courseId) }
        if (normStart) ePayload.start_date = normStart
        if (normEnd) ePayload.end_date = normEnd
        await api.post('/api/pms/enrollments', ePayload)
      }

      // pagos
      if (paymentMode !== 'none') {
        const items = paymentMode === 'total'
          ? enrollItems.filter(it=>it.courseId)
          : enrollItems.filter(it=>it.courseId && it.payNow)

        let remainingDiscount = 0
        const discRaw = String(summaryDiscount || '').trim()
        let discountAsAmount = 0
        if (discRaw.endsWith('%')) {
          const subtotal = items.reduce((acc, it)=>{
            const sug = suggestedAmountFor(it) ?? 0
            const manual = Number(it.paymentAmount || '0')
            const amt = paymentMode==='total' ? (Number(sug)||0) : ((Number.isFinite(manual)&&manual>0)?manual:(Number(sug)||0))
            return acc + (Number.isFinite(amt)? amt:0)
          }, 0)
          const p = Number(discRaw.slice(0, -1))
          if (Number.isFinite(p) && p > 0) discountAsAmount = subtotal * Math.min(100, Math.max(0, p)) / 100
        } else {
          const n = Number(discRaw || '0')
          if (Number.isFinite(n) && n > 0) discountAsAmount = n <= 100 ? 0 : n
        }
        remainingDiscount = discountAsAmount

        for (const it of items) {
          const manual = Number(it.paymentAmount || '0')
          const suggested = suggestedAmountFor(it)
          let amt = paymentMode==='total' ? (suggested ?? 0) : (Number.isFinite(manual) && manual > 0 ? manual : (suggested ?? 0))
          if (remainingDiscount > 0 && amt > 0) {
            const apply = Math.min(amt, remainingDiscount)
            amt -= apply
            remainingDiscount -= apply
          }
          if (Number.isFinite(amt) && amt > 0) {
            let pdate = it.paymentDate || summaryPaymentDate || todayStr()
            const pPayload:any = {
              student_id: studentId,
              course_id: Number(it.courseId),
              amount: amt,
              method: summaryMethod,
              type: it.planType,
              payment_date: paymentMode==='total' ? (summaryPaymentDate || pdate) : pdate,
            }
            if (paymentMode !== 'total' && (summaryReference || '').trim()) pPayload.reference = (summaryReference || '').trim()
            await api.post('/api/pms/payments', pPayload)
          }
        }
      }

      onClose()
      await load()
    }catch(e:any){
      setSaveError(e?.response?.data?.detail || e?.message || 'Error al guardar')
    }finally{
      setSaving(false)
    }
  }

  if(!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] sm:w-[90vw] md:w-auto max-w-4xl my-6 h-[90vh] max-h-[90vh] overflow-hidden overscroll-contain border">
        {/* Header */}
        <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-semibold">Agregar curso a {studentName}</h2>
            <button className="rounded-full hover:bg-white/10 px-2 py-1 text-2xl leading-none" onClick={onClose}>&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-4 sm:px-6 py-5 max-h-[75vh] overflow-y-auto">
          {saveError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}
          {loadError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>}

          {/* Cursos YA inscritos desde /portal */}
          <div className="mb-4 p-3 rounded-2xl border bg-gradient-to-b from-gray-50 to-white shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-100 text-purple-700 text-lg shadow-inner">📚</span>
              <div>
                <div className="font-semibold text-gray-900">Cursos ya inscritos</div>
                <div className="text-xs text-gray-500">Historial y estado actual del alumno</div>
              </div>
            </div>
            {(visibleEnrs.length === 0) ? (
              <div className="text-sm text-gray-500">
                {pendingRenewIds.size > 0
                  ? 'Curso en renovación en el formulario (se ocultó aquí para no duplicar).'
                  : 'Este alumno no tiene cursos inscritos aún.'}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleEnrs.map(e => {
                  const isPendingRenew = pendingRenewIds.has(e.course_id)
                  return (
                  <div key={e.enrollment_id} className={`p-3 rounded-xl border border-gray-100 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex items-start justify-between gap-3 ${isPendingRenew ? 'opacity-75' : ''}`}>
                    <div className="min-w-0 space-y-1">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-700 text-sm shadow-inner">📖</span>
                        <span className="truncate">{e.name}</span>
                        {isPendingRenew && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">Renovación en progreso</span>}
                      </div>
                      <div className="text-xs text-gray-600 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">🕒</span>
                          {e.schedule || 'Sin horario'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">📅</span>
                          <span className="font-semibold text-gray-800">{e.start_date ? formatDateDDMMYYYY(e.start_date) : 'Sin inicio'}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-gray-700 text-[11px]">🏁</span>
                          <span className="font-semibold text-gray-800">{e.end_date ? formatDateDDMMYYYY(e.end_date) : 'Sin fin'}</span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className={
                        e.status === 'activo'
                          ? 'px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium'
                          : e.status === 'vencido'
                          ? 'px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium'
                          : 'px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-xs font-medium'
                      }>
                        {e.status}
                      </span>
                      {e.status === 'vencido' && !isPendingRenew && (
                        <button
                          className="px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-semibold hover:bg-emerald-50 inline-flex items-center gap-1"
                          onClick={() => handleRenewFromEnrollment(e)}
                        >
                          🔄 Renovar
                        </button>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* Agregar nuevas filas */}
          <div className="mb-3">
            <button
              className="px-3 py-1.5 text-sm rounded text-white shadow-sm transition bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
              onClick={()=> setEnrollItems(list => {
                const last = list[list.length-1] || newEnrollItem()
                // Nueva fila basada en plan del anterior, pero reseteando curso/fechas/pago
                const seed: EnrollItem = {
                  courseId: '',
                  planType: last.planType,
                  lessonsPerWeek: last.lessonsPerWeek,
                  start: '',
                  end: '',
                  endAuto: true,
                  payNow: false,
                  paymentAmount: '',
                  paymentDate: ''
                }
                return [...list, seed]
              })}
            >
              + Agregar curso
            </button>
          </div>

          {/* Filas a agregar */}
          <div className="space-y-4">
            {enrollItems.map((it, idx) => {
              const c = getCourse(it.courseId)
              const isDup = it.courseId && alreadyEnrolledIds.has(Number(it.courseId))
              return (
                <div key={idx} className="rounded border bg-white">
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="font-medium">Curso {idx+1}</div>
                    <div className="flex items-center gap-2">
                      {enrollItems.length > 1 && (
                        <button
                          className="text-sm px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                          onClick={()=> setEnrollItems(list => list.filter((_,i)=>i!==idx))}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">Curso</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={it.courseId}
                        onChange={(e)=>updateEnroll(idx,{ courseId: e.target.value })}
                      >
                        <option value="">-- Selecciona un curso --</option>
                        {courses.map(c0=>{
                          const dn = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
                          const d  = (typeof c0.day_of_week === 'number') ? dn[c0.day_of_week] : null
                          const t  = c0.start_time ? String(c0.start_time) : null
                          const base = (d && t) ? `${c0.name}, ${d} ${t}hrs.` : c0.name
                          const enrolled = alreadyEnrolledIds.has(Number(c0.id))
                          const label = enrolled ? `${base} (inscrito)` : base
                          return (
                            <option key={c0.id} value={String(c0.id)}>
                              {label}
                            </option>
                          )
                        })}
                      </select>
                      {isDup && (
                        <div className="mt-1 text-xs text-amber-700">
                          Este curso ya está inscrito. Puedes renovarlo ajustando fechas.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Plan</label>
                      <select
                        className="w-full border rounded px-3 py-2"
                        value={it.planType}
                        onChange={(e)=>updateEnroll(idx,{ planType: e.target.value as any })}
                      >
                        <option value="monthly">Mensual</option>
                        <option value="single_class">Clase suelta</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Inicio</label>
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2"
                        value={it.start}
                        onChange={(e)=>updateEnroll(idx,{ start: e.target.value, endAuto: true })}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Clases/semana</label>
                      <select
                        className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
                        disabled={it.planType==='monthly'}
                        value={it.lessonsPerWeek}
                        onChange={(e)=>updateEnroll(idx,{ lessonsPerWeek: e.target.value as any })}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Fin (sugerido)</label>
                      <input
                        type="date"
                        className="w-full border rounded px-3 py-2"
                        value={it.end}
                        onChange={(e)=>updateEnroll(idx,{ end: e.target.value, endAuto: false })}
                      />
                    </div>
                  </div>

                  {!!it.courseId && (
                    <div className="px-3 pb-3 space-y-3">
                      {/* Resumen curso */}
                      <div className="p-3 rounded border bg-white">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded border overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                            {c?.image_url ? (
                              <img src={toAbsoluteUrl(c.image_url)} alt={c?.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white flex items-center justify-center text-lg font-semibold">
                                {c?.name?.[0] ?? 'C'}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{c?.name}</div>
                            <div className="text-sm text-gray-600 flex flex-wrap gap-2 mt-0.5">
                              {c && <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs">{(c.course_type||'regular').toLowerCase()==='choreography'?'Coreográfico':'Normal'}</span>}
                              {c && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">{`Clases/semana: ${c.classes_per_week ?? 1}`}</span>}
                              {c?.start_date && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">Inicio curso: {c.start_date}</span>}
                              {c && (priceCLP(c.price)) && <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">Mensualidad: {priceCLP(c.price)}</span>}
                              {c && (priceCLP(c.class_price)) && <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 text-xs">Por clase: {priceCLP(c.class_price)}</span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pago por curso */}
                      {paymentMode === 'per_course' && it.courseId && (
                        <div className="p-2 rounded border bg-gray-50">
                          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                            <label className="inline-flex items-center gap-2 sm:col-span-2">
                              <input
                                id={`payCourse-${idx}`}
                                type="checkbox"
                                checked={!!it.payNow}
                                onChange={(e)=>{
                                  const checked=e.target.checked
                                  setEnrollItems(list=>{
                                    const next=[...list]
                                    const cur = {...next[idx]}
                                    cur.payNow=checked
                                    if(checked){
                                      const cc=getCourse(cur.courseId)
                                      const suggested=cur.planType==='single_class'? cc?.class_price : cc?.price
                                      if(suggested!=null && !Number.isNaN(Number(suggested))) cur.paymentAmount=String(suggested)
                                      cur.paymentDate = cur.start || summaryPaymentDate || todayStr()
                                    }
                                    next[idx]=cur
                                    return next
                                  })
                                }}
                              />
                              <span className="text-sm font-medium">Pagar este curso</span>
                            </label>
                            <div className="sm:col-span-2">
                              <label className="block text-sm text-gray-600 mb-1">Monto</label>
                              <input
                                className="w-full border rounded px-3 py-2"
                                inputMode="numeric"
                                value={it.paymentAmount}
                                onChange={(e)=>updateEnroll(idx,{ paymentAmount: e.target.value })}
                                disabled={!it.payNow}
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-sm text-gray-600 mb-1">Fecha pago</label>
                              <input
                                type="date"
                                className="w-full border rounded px-3 py-2"
                                value={it.paymentDate || summaryPaymentDate}
                                onChange={(e)=>updateEnroll(idx,{ paymentDate: e.target.value })}
                                disabled={!it.payNow}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Selector de modo de pago */}
          <div className="mt-4 p-3 rounded border bg-white">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="paymode"
                  checked={paymentMode==='none'}
                  onChange={()=>{
                    setPaymentMode('none')
                    setEnrollItems(list=>list.map(it=>({...it, payNow:false})))
                  }}
                />
                <span className="text-sm">Sin pago ahora</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="paymode"
                  checked={paymentMode==='total'}
                  onChange={()=>{
                    setPaymentMode('total')
                    const today = todayStr()
                    setSummaryPaymentDate(today)
                    setEnrollItems(list=>list.map(it=>{
                      if(!it.courseId) return { ...it, payNow:false }
                      const c = getCourse(it.courseId)
                      const suggested = it.planType==='single_class' ? c?.class_price : c?.price
                      return { ...it, payNow:true, paymentAmount: (suggested!=null && !Number.isNaN(Number(suggested))) ? String(suggested) : (it.paymentAmount||''), paymentDate: today }
                    }))
                  }}
                />
                <span className="text-sm">Pago total</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="paymode"
                  checked={paymentMode==='per_course'}
                  onChange={()=> setPaymentMode('per_course')}
                />
                <span className="text-sm">Pago por curso</span>
              </label>
            </div>
          </div>

          {/* Resumen de pago */}
          {paymentPreview && paymentMode!=='none' && (
            <div className="mt-3 p-4 rounded border bg-white flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div className="text-xs text-gray-600">
                  <div>
                    Sub-total ({paymentPreview.count} curso{paymentPreview.count>1?'s':''}):
                    {' '}<span className="font-medium">{new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(paymentPreview.subtotal)}</span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-gray-700">
                    {paymentPreview.lines.map((ln, i)=>(
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="truncate">{ln.name}</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(ln.amt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Método</label>
                    <select className="w-full border rounded px-3 py-2" value={summaryMethod} onChange={(e)=>setSummaryMethod(e.target.value as any)}>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                      <option value="convenio">Convenio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fecha pago</label>
                    <input type="date" className="w-44 border rounded px-3 py-2" value={summaryPaymentDate} onChange={(e)=> setSummaryPaymentDate(e.target.value)} />
                  </div>
                  {paymentMode !== 'total' && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Referencia</label>
                      <input className="w-48 border rounded px-3 py-2" placeholder="Opcional" value={summaryReference} onChange={(e)=>setSummaryReference(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Descuento</label>
                    <input className="w-40 border rounded px-3 py-2" inputMode="text" placeholder="0 o 0%" value={summaryDiscount} onChange={(e)=>setSummaryDiscount(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Aplicado:{' '}
                  <span className="font-medium">
                    {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(paymentPreview.discountApplied)}
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-gray-900">
                  Total a cobrar:{' '}
                  {new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(paymentPreview.totalAfter)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-4 sm:px-6 py-3 sticky bottom-0">
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 rounded border hover:bg-gray-50" onClick={onClose}>Cancelar</button>
            <button
              className="px-4 py-2 text-white rounded disabled:opacity-50 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
              disabled={saving}
              onClick={handleSave}
            >
              {saving? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
