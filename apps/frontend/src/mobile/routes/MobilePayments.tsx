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
  const lastPayment = payments[0]
  const totalRecent = summary?.payments?.total_last_90 || 0

  const latestPeriod = useMemo(() => {
    const item = payments.find((payment) => payment.period_start || payment.period_end)
    if (!item) return null
    return `${formatDate(item.period_start)} / ${formatDate(item.period_end)}`
  }, [payments])

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

      {onlineEnabled ? (
        <button
          type="button"
          className="mobile-bg-primary mobile-shadow-primary w-full rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-widest text-white"
        >
          Pagar online
        </button>
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
    </div>
  )
}
