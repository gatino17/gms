import { useEffect, useMemo, useState } from 'react'
import { HiOutlineCash, HiOutlineCheckCircle, HiOutlineClock, HiOutlineCreditCard } from 'react-icons/hi'
import MobileCard from '../components/MobileCard'
import { mobileApi } from '../services/mobileApi'

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
  const [summary, setSummary] = useState<StudentPaymentSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    mobileApi.get<StudentPaymentSummary>('/api/pms/students/portal/me')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err?.response?.data?.detail || err?.message || 'No se pudo cargar el historial de pagos.'))
      .finally(() => setLoading(false))
  }, [])

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
      <MobileCard eyebrow="Pagos" title="Historial de pagos">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
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
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Último periodo registrado</p>
              <p className="mt-1 text-sm font-black text-slate-950">{latestPeriod}</p>
            </div>
          ) : null}
        </div>
      </MobileCard>

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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{payment.course_name || payment.reference || paymentTypeLabel(payment.type)}</p>
                    {payment.teacher_name ? <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-fuchsia-600">Prof. {payment.teacher_name}</p> : null}
                    <p className="mt-2 text-xs font-bold text-slate-500">{formatDate(payment.payment_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-950">{money(payment.amount)}</p>
                    <span className="mt-1 inline-flex rounded-full bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                      #{payment.id}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-blue-600">
                    <HiOutlineCreditCard size={12} /> {methodLabel(payment.method)}
                  </span>
                  <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-fuchsia-600">
                    {paymentTypeLabel(payment.type)}
                  </span>
                </div>
                {(payment.period_start || payment.period_end) ? (
                  <div className="mt-3 rounded-xl bg-white px-3 py-2 text-[10px] font-black text-slate-500">
                    Periodo: {formatDate(payment.period_start)} / {formatDate(payment.period_end)}
                  </div>
                ) : null}
                <HiOutlineCheckCircle className="absolute -bottom-3 -right-3 text-emerald-100" size={58} />
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">Aún no hay pagos registrados para mostrar.</p>
        )}
      </section>
    </div>
  )
}
