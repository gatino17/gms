import { useEffect, useMemo, useState } from 'react'
import { HiOutlineCash, HiOutlineCheckCircle, HiOutlineClock, HiOutlineCreditCard, HiOutlineEye, HiOutlineX } from 'react-icons/hi'
import { getMobileCache, getMobileUser, mobileApi, mobileCacheKey, setMobileCache } from '../services/mobileApi'

type PaymentItem = {
  id: number
  amount: number
  payment_date?: string | null
  method?: string | null
  type?: string | null
  reference?: string | null
  course_name?: string | null
  teacher_name?: string | null
  period_start?: string | null
  period_end?: string | null
}

type StudentPaymentSummary = {
  tenant?: { online_payments_enabled?: boolean }
  enrollments?: Array<{
    id?: number
    course_name?: string | null
    is_active?: boolean
    payment_status?: string | null
    start_date?: string | null
    end_date?: string | null
    next_payment_period_start?: string | null
    next_payment_period_end?: string | null
    payment_amount?: number | null
    course?: {
      id?: number
      name?: string | null
      teacher_name?: string | null
    }
  }>
  payments?: {
    recent?: PaymentItem[]
    total_last_90?: number
  }
}

const money = (value?: number | null) => `$${Number(value || 0).toLocaleString('es-CL')}`

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}-${month}-${year}`
}

const paymentTypeLabel = (type?: string | null) => {
  if (type === 'registration') return 'Matrícula'
  if (type === 'single_class') return 'Clase suelta'
  if (type === 'teacher_payment') return 'Pago profesor'
  return 'Mensualidad'
}

const methodLabel = (method?: string | null) => {
  if (!method) return 'Método no registrado'
  const normalized = method.toLowerCase()
  if (normalized.includes('debit') || normalized.includes('debito')) return 'Débito'
  if (normalized.includes('credit') || normalized.includes('credito') || normalized.includes('tarjeta')) return 'Tarjeta'
  if (normalized.includes('transfer')) return 'Transferencia'
  if (normalized.includes('cash') || normalized.includes('efectivo')) return 'Efectivo'
  return method
}

export default function MobilePayments() {
  const user = getMobileUser()
  const cacheKey = mobileCacheKey('student-summary', user)
  const [summary, setSummary] = useState<StudentPaymentSummary | null>(() => getMobileCache<StudentPaymentSummary>(cacheKey))
  const [loading, setLoading] = useState(() => !getMobileCache<StudentPaymentSummary>(cacheKey))
  const [error, setError] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)
  const [selectedPendingEnrollment, setSelectedPendingEnrollment] = useState<NonNullable<StudentPaymentSummary['enrollments']>[number] | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  useEffect(() => {
    if (!summary) setLoading(true)
    mobileApi.get<StudentPaymentSummary>('/api/pms/students/portal/me')
      .then((res) => {
        setSummary(res.data)
        setMobileCache(cacheKey, res.data)
      })
      .catch((err) => {
        if (!summary) setError(err?.response?.data?.detail || err?.message || 'No se pudo cargar el historial de pagos.')
      })
      .finally(() => setLoading(false))
  }, [cacheKey])

  const payments = summary?.payments?.recent || []
  const onlineEnabled = !!summary?.tenant?.online_payments_enabled
  const pendingEnrollments = (summary?.enrollments || []).filter((item) => item.is_active !== false && item.payment_status !== 'activo')
  const lastPayment = payments[0]
  const totalRecent = summary?.payments?.total_last_90 || 0

  const latestPeriod = useMemo(() => {
    const item = payments.find((payment) => payment.period_start || payment.period_end)
    if (!item) return null
    return `${formatDate(item.period_start)} / ${formatDate(item.period_end)}`
  }, [payments])

  const startMercadoPagoCheckout = async (enrollment: NonNullable<StudentPaymentSummary['enrollments']>[number]) => {
    if (!enrollment.id) {
      setCheckoutError('No se encontro la inscripcion del curso.')
      return
    }
    try {
      setCheckoutLoading(true)
      setCheckoutError('')
      const { data } = await mobileApi.post('/api/pms/mercadopago/checkout', {
        enrollment_id: enrollment.id,
      })
      const checkoutUrl = data?.sandbox_init_point || data?.init_point
      if (!checkoutUrl) {
        throw new Error('Mercado Pago no devolvio link de pago.')
      }
      window.location.assign(checkoutUrl)
    } catch (err: any) {
      setCheckoutError(err?.message || 'No se pudo iniciar el pago online.')
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="px-1 pt-1">
        <p className="mobile-text-primary mb-2 text-[10px] font-black uppercase tracking-[0.24em]">Pagos</p>
        <h2 className="text-2xl font-black leading-tight text-slate-950">Historial de pagos</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          Pagos y periodos registrados.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-white px-3 py-2.5 shadow-sm shadow-slate-200/70">
            <div className="flex items-center gap-2">
              <HiOutlineCash className="text-emerald-500" size={20} />
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pagado</p>
            </div>
            <p className="mt-1 text-center text-lg font-black text-slate-950">{money(totalRecent)}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white px-3 py-2.5 shadow-sm shadow-slate-200/70">
            <div className="flex items-center gap-2">
              <HiOutlineClock className="text-blue-500" size={20} />
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Último pago</p>
            </div>
            <p className="mt-1 text-center text-sm font-black text-slate-950">{lastPayment ? formatDate(lastPayment.payment_date) : '-'}</p>
          </div>
        </div>
        {latestPeriod ? (
          <div className="mt-3 rounded-2xl bg-white px-4 py-3 shadow-sm shadow-slate-200/70">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Último periodo registrado</p>
            <p className="mt-1 text-sm font-black text-slate-950">{latestPeriod}</p>
          </div>
        ) : null}
      </section>

      {onlineEnabled && pendingEnrollments.length ? (
        <section className="rounded-[28px] border border-rose-100 bg-white p-4 shadow-xl shadow-slate-200/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mobile-text-primary text-[10px] font-black uppercase tracking-[0.22em]">Pagos pendientes</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                {pendingEnrollments.length} {pendingEnrollments.length === 1 ? 'curso pendiente' : 'cursos pendientes'}
              </h2>
            </div>
            <div className="mobile-bg-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-slate-200/80">
              <HiOutlineCreditCard size={20} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {pendingEnrollments.map((item, index) => {
              const courseName = item.course?.name || item.course_name || 'Curso'
              return (
                <button
                  key={`${item.id || courseName}-${index}`}
                  type="button"
                  onClick={() => {
                    setCheckoutError('')
                    setSelectedPendingEnrollment(item)
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{courseName}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                      {formatDate(item.next_payment_period_start || item.start_date)} / {formatDate(item.next_payment_period_end || item.end_date)}
                    </p>
                  </div>
                  <span className="mobile-bg-primary shrink-0 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white">
                    Pagar
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ) : onlineEnabled ? (
        <section className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Pagos online activos</p>
          <p className="mt-1 text-sm font-bold text-slate-700">No tienes cursos pendientes para pagar.</p>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-slate-100 bg-white p-4 shadow-xl shadow-slate-200/70">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Movimientos</p>
            <h2 className="text-lg font-black text-slate-950">Pagos recientes</h2>
          </div>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black text-white">{payments.length}</span>
        </div>

        {loading ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">Cargando historial...</p>
        ) : error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">{error}</p>
        ) : payments.length ? (
          <div className="space-y-3">
            {payments.map((payment) => (
              <article key={payment.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm shadow-slate-200/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-slate-950">{payment.course_name || payment.reference || paymentTypeLabel(payment.type)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                        {formatDate(payment.payment_date)}
                      </span>
                      <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-600">
                        {paymentTypeLabel(payment.type)}
                      </span>
                    </div>
                  </div>
                  <p className="shrink-0 text-lg font-black text-slate-950">{money(payment.amount)}</p>
                </div>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setSelectedPayment(payment)}
                    className="mobile-bg-primary-soft mobile-text-primary mobile-border-primary inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[9px] font-black uppercase tracking-widest"
                  >
                    <HiOutlineEye size={14} />
                    Ver detalle
                  </button>
                </div>
                <HiOutlineCheckCircle className="absolute -bottom-3 -right-3 text-emerald-100" size={58} />
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">Aún no hay pagos registrados para mostrar.</p>
        )}
      </section>

      {selectedPayment ? (
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setSelectedPayment(null)}
            className="absolute inset-0"
            aria-label="Cerrar detalle"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white bg-white shadow-2xl shadow-slate-950/30">
            <div className="relative bg-slate-950 p-5 text-white">
              <HiOutlineCheckCircle className="pointer-events-none absolute -right-9 top-0 text-emerald-300/40 drop-shadow-sm" size={148} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">Detalle del pago</p>
                  <h3 className="mt-2 text-3xl font-black leading-tight">{money(selectedPayment.amount)}</h3>
                  <p className="mt-2 text-sm font-black text-white">{selectedPayment.course_name || paymentTypeLabel(selectedPayment.type)}</p>
                  {selectedPayment.teacher_name ? (
                    <p className="mt-1 text-[11px] font-black uppercase tracking-widest text-fuchsia-300">{selectedPayment.teacher_name}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPayment(null)}
                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"
                >
                  <HiOutlineX size={18} />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                  <HiOutlineCreditCard size={14} />
                  {paymentTypeLabel(selectedPayment.type)}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  <HiOutlineCheckCircle size={15} />
                  Pagado
                </div>
              </div>
              <span className="absolute bottom-5 right-5 rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/55">
                ID #{selectedPayment.id}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-500">Fecha de pago</p>
                <p className="mt-1 text-sm font-black text-slate-950">{formatDate(selectedPayment.payment_date)}</p>
              </div>
              <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-500">Método</p>
                <p className="mt-1 text-sm font-black text-slate-950">{methodLabel(selectedPayment.method)}</p>
              </div>
              {(selectedPayment.period_start || selectedPayment.period_end) ? (
                <div className="col-span-2 rounded-2xl border border-fuchsia-100 bg-fuchsia-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-500">Periodo</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{formatDate(selectedPayment.period_start)} / {formatDate(selectedPayment.period_end)}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedPendingEnrollment ? (
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setSelectedPendingEnrollment(null)}
            className="absolute inset-0"
            aria-label="Cerrar pago pendiente"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white bg-white shadow-2xl shadow-slate-950/30">
            <div className="mobile-bg-primary p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/70">Resumen de pago</p>
                  <h3 className="mt-2 text-2xl font-black leading-tight">
                    {selectedPendingEnrollment.course?.name || selectedPendingEnrollment.course_name || 'Curso'}
                  </h3>
                  {selectedPendingEnrollment.course?.teacher_name ? (
                    <p className="mt-2 text-[11px] font-black uppercase tracking-widest text-white/80">
                      Prof. {selectedPendingEnrollment.course.teacher_name}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPendingEnrollment(null)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white"
                >
                  <HiOutlineX size={18} />
                </button>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Periodo a pagar</p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {formatDate(selectedPendingEnrollment.next_payment_period_start || selectedPendingEnrollment.start_date)} / {formatDate(selectedPendingEnrollment.next_payment_period_end || selectedPendingEnrollment.end_date)}
                </p>
              </div>
              {selectedPendingEnrollment.payment_amount != null ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Monto</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    ${Number(selectedPendingEnrollment.payment_amount || 0).toLocaleString('es-CL')}
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Mercado Pago</p>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-700">
                  Seras redirigido al checkout de prueba para completar el pago.
                </p>
              </div>
              {checkoutError ? (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-600">{checkoutError}</p>
              ) : null}
              <button
                type="button"
                onClick={() => startMercadoPagoCheckout(selectedPendingEnrollment)}
                disabled={checkoutLoading}
                className="mobile-bg-primary w-full rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-300/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutLoading ? 'Preparando pago...' : 'Pagar con Mercado Pago'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
