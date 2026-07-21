import MobileCard from '../components/MobileCard'

export default function MobilePayments() {
  return (
    <div className="space-y-4">
      <MobileCard eyebrow="Pagos" title="Estado de pagos">
        <p className="text-sm font-semibold leading-6 text-slate-600">
          Esta vista queda preparada para mostrar mensualidades, saldos pendientes y el boton de pago online cuando el tenant lo tenga habilitado.
        </p>
      </MobileCard>
      <button
        type="button"
        disabled
        className="w-full rounded-2xl bg-slate-200 px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-500"
      >
        Pago online pendiente
      </button>
    </div>
  )
}
