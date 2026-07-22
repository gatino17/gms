export default function MobileAuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="mobile-auth-glow absolute -left-24 top-10 h-64 w-64 rounded-full blur-3xl" />
      <div className="mobile-auth-glow absolute -right-28 top-52 h-72 w-72 rounded-full opacity-70 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-slate-700/30 blur-3xl" />

      <div className="mobile-auth-dot-soft absolute left-7 top-28 h-2 w-2 rounded-full opacity-80 shadow-lg" />
      <div className="absolute right-10 top-36 h-1.5 w-1.5 rounded-full bg-white/70" />
      <div className="mobile-auth-dot-soft absolute left-16 top-60 h-1.5 w-1.5 rounded-full opacity-80" />
      <div className="mobile-auth-dot absolute right-20 bottom-48 h-2 w-2 rounded-full opacity-80" />
      <div className="absolute left-10 bottom-28 h-1 w-1 rounded-full bg-white/60" />

      <div className="mobile-auth-ring absolute -left-10 top-44 h-32 w-72 rotate-[-18deg] rounded-full border" />
      <div className="mobile-auth-ring absolute right-[-80px] top-72 h-40 w-80 rotate-[22deg] rounded-full border opacity-70" />
      <div className="mobile-auth-line absolute left-1/2 top-24 h-[1px] w-56 -translate-x-1/2 rotate-[-14deg]" />
      <div className="absolute left-1/2 bottom-44 h-[1px] w-72 -translate-x-1/2 rotate-[12deg] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:22px_22px] opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#090912]/40 to-[#090912]" />
    </div>
  )
}
