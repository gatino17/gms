import type { CourseLite } from '../routes/StudentsPage'
import { api, toAbsoluteUrl } from '../lib/api'
import React from 'react'

const formatDisplay = (iso?: string | null) => {
  if (!iso) return ''
  if (iso.includes('/')) return iso
  const parts = iso.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return iso
}

const toIso = (dmy?: string | null) => {
  if (!dmy) return ''
  const clean = dmy.trim()
  if (!clean) return ''
  if (clean.includes('-') && clean.length === 10) return clean
  const parts = clean.split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    if (y && m && d) {
      return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  return clean
}

type Props = {
  showCreate: boolean
  setShowCreate: (v:boolean)=>void
  saving: boolean
  setSaving: (v:boolean)=>void
  saveError: string|null
  setSaveError: (v:string|null)=>void

  form: any
  setForm: (updater: any)=>void

  imageFile: File | null
  setImageFile: (f:File|null)=>void
  imageError: string | null
  setImageError: (s:string|null)=>void
  imagePreview: string | null

  enrollItems: any[]
  setEnrollItems: (updater:any)=>void
  summaryMethod: 'cash'|'card'|'transfer'|'convenio'
  setSummaryMethod: (m:any)=>void
  summaryDiscount: string
  setSummaryDiscount: (s:string)=>void
  paymentMode: 'none'|'total'|'per_course'
  setPaymentMode: (m:any)=>void
  summaryPaymentDate: string
  setSummaryPaymentDate: (s:string)=>void
  summaryReference: string
  setSummaryReference: (s:string)=>void

  getCourse: (cid:string)=>CourseLite|undefined
  suggestedAmountFor: (it:any)=>number|null
  updateEnroll: (idx:number, patch:any)=>void
  computeEnd: (start:string, lessons:'1'|'2', plan:'monthly'|'single_class')=>string
  courses: CourseLite[]
  load: ()=>Promise<void>

  /** NUEVO: para que el padre limpie búsqueda/estado tras crear */
  onCreated?: () => void | Promise<void>
}

export default function CreateStudentModal(props: Props){
  const {
    showCreate, setShowCreate, saving, setSaving, saveError, setSaveError,
    form, setForm, imageFile, setImageFile, imageError, setImageError, imagePreview,
    enrollItems, setEnrollItems, summaryMethod, setSummaryMethod, summaryDiscount, setSummaryDiscount,
    paymentMode, setPaymentMode, summaryPaymentDate, setSummaryPaymentDate, summaryReference, setSummaryReference,
    getCourse, suggestedAmountFor, updateEnroll, computeEnd,
    courses, load, onCreated
  } = props

  const priceCLP = (v:any) =>
    (v==null ? null : new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP'}).format(Number(v)))

  if (!showCreate) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={()=> setShowCreate(false)} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[95vw] sm:w-[90vw] md:w-auto max-w-4xl my-6 h-[90vh] max-h-[90vh] overflow-hidden overscroll-contain border">
        <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-semibold">Agregar alumno</h2>
            <button className="rounded-full hover:bg-white/10 px-2 py-1 text-2xl leading-none" onClick={()=> setShowCreate(false)}>&times;</button>
          </div>
        </div>

        <div className="bg-white px-4 sm:px-6 py-5 max-h-[75vh] overflow-y-auto">
          {saveError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nombre</label>
              <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
                value={form.first_name}
                onChange={(e)=>setForm((f:any)=>({...f, first_name:e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Apellido</label>
              <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
                value={form.last_name}
                onChange={(e)=>setForm((f:any)=>({...f, last_name:e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                type="email"
                autoComplete="off"
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
                value={form.email}
                onChange={(e)=>setForm((f:any)=>({...f, email:e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
              <input className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fuchsia-200"
                value={form.phone}
                onChange={(e)=>setForm((f:any)=>({...f, phone:e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Género</label>
              <select className="w-full border rounded px-3 py-2"
                value={form.gender}
                onChange={(e)=>setForm((f:any)=>({...f, gender:e.target.value}))}
              >
                <option value="">No responde</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fecha de ingreso</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 border rounded px-3 py-2"
                  value={form.joined_at}
                  onChange={(e)=>setForm((f:any)=>({...f, joined_at: e.target.value}))}
                />
                <button
                  type="button"
                  className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  onClick={() => setForm((f:any) => ({ ...f, joined_at: new Date().toISOString().slice(0,10) }))}
                >
                  Hoy
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={form.birthdate}
                onChange={(e)=>setForm((f:any)=>({...f, birthdate: e.target.value}))}
              />
            </div>

            <div className="md:order-2">
              <label className="block text-sm text-gray-600 mb-2">Foto del alumno</label>
              <div className="flex gap-4 items-start">
                <div className="w-28 h-28 rounded-full ring-1 ring-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                  {imagePreview ? (
                    <img
                      src={imagePreview.startsWith('blob:') || imagePreview.startsWith('data:') ? imagePreview : toAbsoluteUrl(imagePreview)}
                      alt="Vista previa"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-xs text-gray-400 px-2 text-center">Sin vista previa</span>
                  )}
                </div>
                <div className="flex-1">
                  <label className="block">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-fuchsia-400 hover:bg-fuchsia-50/40 transition">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium text-fuchsia-700">Haz clic para subir</span> o arrastra una imagen
                      </div>
                      <div className="text-xs text-gray-400 mt-1">PNG o JPG, hasta 2MB</div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e)=>{ 
                        const f=e.target.files?.[0] ?? null
                        if (f){
                          if(!f.type.startsWith('image/')) { setImageError('Archivo no es imagen'); return }
                          if (f.size> 2*1024*1024){ setImageError('Máximo 2MB'); return }
                          setImageError(null); setImageFile(f); setForm((x:any)=>({...x, photo_url:''}))
                        } else { setImageFile(null) }
                      }}
                    />
                  </label>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50"
                      onClick={()=>{ setImageFile(null); setForm((x:any)=>({ ...x, photo_url: '' })); setImageError(null) }}>
                      Quitar foto
                    </button>
                    {imagePreview && (
                      <a href={imagePreview.startsWith('blob:') || imagePreview.startsWith('data:') ? imagePreview : toAbsoluteUrl(imagePreview)}
                         target="_blank" rel="noreferrer"
                         className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50">
                        Ver grande
                      </a>
                    )}
                  </div>
                  {imageError && <div className="text-xs text-red-600 mt-2">{imageError}</div>}
                </div>
              </div>
            </div>

            <div className="md:order-1">
              <label className="block text-sm text-gray-600 mb-1">Notas</label>
              <textarea className="w-full border rounded px-3 py-2" rows={5}
                value={form.notes}
                onChange={(e)=>setForm((f:any)=>({...f, notes:e.target.value}))}
              />
            </div>

            <div className="md:col-span-2 md:order-3"><div className="my-4 border-t" /></div>

            {/* Inscripción (opcional) */}
            <div className="md:col-span-2 md:order-4">
              <div className="p-3 border rounded bg-gray-50">
                <div className="font-medium mb-2">Inscripción (opcional)</div>
                <div className="space-y-4">
                  <div>
                    <button
                      className="px-3 py-1.5 text-sm rounded text-white shadow-sm transition bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
                      onClick={()=> setEnrollItems((list:any[]) => [...list, { ...list[list.length-1] }])}
                    >
                      + Agregar curso
                    </button>
                  </div>

                  {enrollItems.map((it:any, idx:number) => {
                    const c = getCourse(it.courseId)
                    return (
                      <div key={idx} className="rounded border bg-white">
                        <div className="p-3 border-b flex items-center justify-between">
                          <div className="font-medium">Curso {idx+1}</div>
                          <div className="flex items-center gap-2">
                            {enrollItems.length > 1 && (
                              <button className="text-sm px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                                onClick={()=> setEnrollItems((list:any[]) => list.filter((_:any,i:number)=>i!==idx))}>
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                          <div className="md:col-span-2">
                            <label className="block text-sm text-gray-600 mb-1">Curso</label>
                            <select className="w-full border rounded px-3 py-2"
                              value={it.courseId}
                              onChange={(e)=>updateEnroll(idx,{ courseId: e.target.value })}
                            >
                              <option value="">-- Sin inscripción --</option>
                              {courses.map(c=> {
                                const dn = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo']
                                const d = (typeof c.day_of_week === 'number') ? dn[c.day_of_week] : null
                                const t = c.start_time ? String(c.start_time) : null
                                const label = (d && t) ? `${c.name}, ${d} ${t}hrs.` : c.name
                                return <option key={c.id} value={String(c.id)}>{label}</option>
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Plan</label>
                            <select className="w-full border rounded px-3 py-2"
                              value={it.planType}
                              onChange={(e)=>updateEnroll(idx,{ planType: e.target.value as any })}
                            >
                              <option value="monthly">Mensual</option>
                              <option value="single_class">Clase suelta</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Inicio</label>
                            <input type="date" className="w-full border rounded px-3 py-2"
                              value={it.start}
                              onChange={(e)=>updateEnroll(idx,{ start: e.target.value, endAuto: true })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Clases/semana</label>
                            <select className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
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
                            <input type="date" className="w-full border rounded px-3 py-2"
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
                                    {c && <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs">
                                      {(c.course_type||'regular').toLowerCase()==='choreography'?'Coreográfico':'Normal'}
                                    </span>}
                                    {c && <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs">
                                      {`Clases/semana: ${c.classes_per_week ?? 1}`}
                                    </span>}
                                    {c?.start_date && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">
                                      Inicio curso: {c.start_date}
                                    </span>}
                                    {c && (priceCLP(c.price)) && <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                                      Mensualidad: {priceCLP(c.price)}
                                    </span>}
                                    {c && (priceCLP(c.class_price)) && <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 text-xs">
                                      Por clase: {priceCLP(c.class_price)}
                                    </span>}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Pago por curso (si corresponde) */}
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
                                        setEnrollItems((list:any[])=>{ 
                                          const next=[...list]
                                          const cur={...next[idx]}
                                          cur.payNow=checked
                                          if(checked){
                                            const cc=getCourse(cur.courseId)
                                            const suggested=cur.planType==='single_class'? cc?.class_price : cc?.price
                                            if(suggested!=null && !Number.isNaN(Number(suggested))) cur.paymentAmount=String(suggested)
                                            const td=new Date(); const y=td.getFullYear(); const m=String(td.getMonth()+1).padStart(2,'0'); const d=String(td.getDate()).padStart(2,'0')
                                            cur.paymentDate= summaryPaymentDate || cur.start || `${y}-${m}-${d}`
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
                                    <input className="w-full border rounded px-3 py-2"
                                      inputMode="numeric"
                                      value={it.paymentAmount}
                                      onChange={(e)=>updateEnroll(idx,{ paymentAmount: e.target.value })}
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

                  {/* Selector de modo de pago */}
                  <div className="p-3 rounded border bg-white">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymode"
                          checked={paymentMode==='none'}
                          onChange={()=>{
                            setPaymentMode('none')
                            setEnrollItems((list:any[]) => list.map((it:any)=>({ ...it, payNow:false })))
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
                            const td=new Date(); const y=td.getFullYear(); const m=String(td.getMonth()+1).padStart(2,'0'); const d=String(td.getDate()).padStart(2,'0')
                            const today = `${y}-${m}-${d}`
                            setSummaryPaymentDate(today)
                            setEnrollItems((list:any[])=>list.map((it:any)=>{
                              if(!it.courseId) return { ...it, payNow:false }
                              const c = getCourse(it.courseId)
                              const suggested = it.planType==='single_class' ? c?.class_price : c?.price
                              return {
                                ...it,
                                payNow:true,
                                paymentAmount: (suggested!=null && !Number.isNaN(Number(suggested)))
                                  ? String(suggested)
                                  : (it.paymentAmount||''),
                                paymentDate: today
                              }
                            }))
                          }}
                        />
                        <span className="text-sm">Pago total</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="paymode"
                          checked={paymentMode==='per_course'}
                          onChange={()=> setPaymentMode('per_course')}
                        />
                        <span className="text-sm">Pago por curso</span>
                      </label>
                    </div>
                  </div>

                  {/* Resumen pago */}
                  {(() => {
                    if (paymentMode === 'none') return null
                    const items = paymentMode === 'total'
                      ? enrollItems.filter((it:any)=>it.courseId)
                      : enrollItems.filter((it:any)=>it.courseId && it.payNow)
                    const count = items.length
                    if (count === 0) return null

                    const subtotal = items.reduce((acc:number, it:any)=>{
                      if (paymentMode === 'total') {
                        const sug = suggestedAmountFor(it) ?? 0
                        return acc + (Number.isFinite(Number(sug)) ? Number(sug) : 0)
                      } else {
                        const sug = suggestedAmountFor(it) ?? 0
                        const val = Number(it.paymentAmount || '0')
                        const amt = Number.isFinite(val) && val > 0 ? val : sug
                        return acc + (Number.isFinite(amt) ? amt : 0)
                      }
                    }, 0)

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
                    const fmt = (n:number)=> new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP' }).format(n)

                    return (
                      <div className="mt-3 p-4 rounded border bg-white flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                          <div className="text-xs text-gray-600">
                            <div>Sub-total ({count} curso{count>1?'s':''}): <span className="font-medium">{fmt(subtotal)}</span></div>
                            <div className="mt-1 space-y-0.5 text-gray-700">
                              {items.map((it:any,i:number)=>{
                                const c=getCourse(it.courseId)
                                const sug = suggestedAmountFor(it) ?? 0
                                const val = Number(it.paymentAmount || '0')
                                const amt = paymentMode==='total'
                                  ? (Number(sug)||0)
                                  : ((Number.isFinite(val)&&val>0)?val:(Number(sug)||0))
                                const name = c?.name || `Curso ${i+1}`
                                return (
                                  <div key={i} className="flex items-center justify-between gap-3">
                                    <span className="truncate">{name}</span>
                                    <span className="font-medium">{fmt(amt)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Método</label>
                              <select className="w-full border rounded px-3 py-2"
                                value={summaryMethod}
                                onChange={(e)=>setSummaryMethod(e.target.value as any)}
                              >
                                <option value="cash">Efectivo</option>
                                <option value="card">Tarjeta</option>
                                <option value="transfer">Transferencia</option>
                                <option value="convenio">Convenio</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Fecha pago</label>
                              <input type="date" className="w-44 border rounded px-3 py-2"
                                value={summaryPaymentDate}
                                onChange={(e)=> setSummaryPaymentDate(e.target.value)}
                              />
                            </div>
                            {paymentMode !== 'total' && (
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">Referencia</label>
                                <input className="w-48 border rounded px-3 py-2"
                                  placeholder="Opcional"
                                  value={summaryReference}
                                  onChange={(e)=>setSummaryReference(e.target.value)}
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">Descuento</label>
                              <input className="w-40 border rounded px-3 py-2"
                                inputMode="text"
                                placeholder="0 o 0%"
                                value={summaryDiscount}
                                onChange={(e)=>setSummaryDiscount(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">Aplicado: <span className="font-medium">{fmt(discountApplied)}</span></div>
                          <div className="text-xl md:text-2xl font-bold text-gray-900">Total a cobrar: {fmt(totalAfter)}</div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input id="is_active" type="checkbox"
                checked={form.is_active}
                onChange={(e)=>setForm((f:any)=>({...f, is_active:e.target.checked}))}
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Activo</label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-4 sm:px-6 py-3 sticky bottom-0">
          <div className="flex justify-end gap-2">
            <button className="px-4 py-2 rounded border hover:bg-gray-50" onClick={()=> setShowCreate(false)}>Cancelar</button>
            <button
              className="px-4 py-2 text-white rounded disabled:opacity-50 bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700"
              disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
              onClick={async ()=>{
                setSaving(true); setSaveError(null)
                try{
                  const payload:any = {
                    first_name: form.first_name.trim(),
                    last_name: form.last_name.trim(),
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                    gender: form.gender || undefined,
                    notes: form.notes || undefined,
                    photo_url: form.photo_url || undefined,
                    joined_at: form.joined_at || undefined,
                    birthdate: form.birthdate || undefined,
                    is_active: !!form.is_active,
                  }
                  // Crear alumno
                  const res = await api.post('/api/pms/students', payload)
                  const studentId = res.data?.id
                  if (!studentId) throw new Error('No se creó el alumno')

                  // Subir foto si corresponde
                  if (imageFile) {
                    const fd = new FormData()
                    fd.append('file', imageFile)
                    await api.post(`/api/pms/students/${studentId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
                  }

                  // Inscripciones y pagos
                  let remainingDiscount = 0
                  const discRaw = String(summaryDiscount || '').trim()
                  if (!discRaw.endsWith('%')) {
                    const n = Number(discRaw || '0')
                    if (Number.isFinite(n) && n > 0) remainingDiscount = n
                  }

                  for (const it of enrollItems) {
                    if (!it.courseId) continue
                    const ePayload:any = { student_id: studentId, course_id: Number(it.courseId) }
                    if (it.start) ePayload.start_date = it.start
                    if (it.end) ePayload.end_date = it.end
                    await api.post('/api/pms/enrollments', ePayload)

                    const shouldPay = paymentMode==='total' ? true : !!it.payNow
                    if (shouldPay) {
                      const manual = Number(it.paymentAmount || '0')
                      const suggested = suggestedAmountFor(it)
                      let amt = paymentMode==='total'
                        ? (suggested ?? 0)
                        : (Number.isFinite(manual) && manual > 0 ? manual : (suggested ?? 0))

                      if (remainingDiscount > 0 && amt > 0) {
                        const apply = Math.min(amt, remainingDiscount)
                        amt -= apply
                        remainingDiscount -= apply
                      }

                      if (Number.isFinite(amt) && amt > 0) {
                        let pdate = it.paymentDate
                        if (!pdate) {
                          const td = new Date()
                          const y=td.getFullYear(); const m=String(td.getMonth()+1).padStart(2,'0'); const d=String(td.getDate()).padStart(2,'0')
                          pdate = `${y}-${m}-${d}`
                        }
                        const pPayload:any = {
                          student_id: studentId,
                          course_id: Number(it.courseId),
                          amount: amt,
                          method: summaryMethod,
                          type: it.planType,
                          payment_date: paymentMode==='total' ? (summaryPaymentDate || pdate) : pdate,
                        }
                        if (paymentMode !== 'total' && (summaryReference || '').trim()) {
                          pPayload.reference = (summaryReference || '').trim()
                        }
                        await api.post('/api/pms/payments', pPayload)
                      }
                    }
                  }

                  setShowCreate(false)
                  if (props.onCreated) {
                    await props.onCreated()
                  } else {
                    await load()
                  }
                }catch(e:any){
                  setSaveError(e?.response?.data?.detail || e?.message || 'Error al guardar')
                }finally{
                  setSaving(false)
                }
              }}
            >
              {saving? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
