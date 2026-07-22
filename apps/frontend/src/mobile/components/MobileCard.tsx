import type { ReactNode } from 'react'

interface Props {
  eyebrow?: string
  title: string
  children?: ReactNode
  accent?: 'pink' | 'dark' | 'green' | 'blue' | 'plain'
}

const accentStyles = {
  pink: 'mobile-bg-primary-soft mobile-border-primary',
  dark: 'from-slate-950 to-slate-900 border-slate-800 text-white',
  green: 'from-emerald-500/15 to-white border-emerald-100',
  blue: 'from-blue-500/15 to-white border-blue-100',
  plain: 'from-transparent to-transparent border-transparent shadow-none',
}

export default function MobileCard({ eyebrow, title, children, accent = 'pink' }: Props) {
  return (
    <section className={`rounded-[28px] border bg-gradient-to-br p-5 shadow-xl shadow-slate-200/70 ${accentStyles[accent]}`}>
      {eyebrow ? <p className="mobile-text-primary mb-2 text-[10px] font-black uppercase tracking-[0.24em]">{eyebrow}</p> : null}
      <h2 className="text-xl font-black leading-tight">{title}</h2>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  )
}
