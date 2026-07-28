import { useEffect, useMemo, useState } from 'react'
import { HiOutlineDeviceMobile, HiOutlineDownload } from 'react-icons/hi'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type Props = {
  portalType: 'alumnos' | 'profesores'
}

const isStandaloneMode = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

export default function MobileInstallPrompt({ portalType }: Props) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showManualHelp, setShowManualHelp] = useState(false)

  const platform = useMemo(() => {
    if (typeof navigator === 'undefined') return 'other'
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) return 'ios'
    if (/android/.test(ua)) return 'android'
    if (/mobile/.test(ua)) return 'mobile'
    return 'desktop'
  }, [])

  useEffect(() => {
    setInstalled(isStandaloneMode())
    if ((window as any).__gmsDeferredInstallPrompt) {
      setInstallEvent((window as any).__gmsDeferredInstallPrompt as BeforeInstallPromptEvent)
    }
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      ;(window as any).__gmsDeferredInstallPrompt = event
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstallReady = () => {
      if ((window as any).__gmsDeferredInstallPrompt) {
        setInstallEvent((window as any).__gmsDeferredInstallPrompt as BeforeInstallPromptEvent)
      }
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
      ;(window as any).__gmsDeferredInstallPrompt = null
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('gms-pwa-install-ready', onInstallReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('gms-pwa-install-ready', onInstallReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!installEvent) {
      setShowManualHelp(true)
      return
    }
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    }
    setInstallEvent(null)
    ;(window as any).__gmsDeferredInstallPrompt = null
  }

  if (installed || dismissed || platform === 'desktop') return null

  const hasNativePrompt = Boolean(installEvent)
  const portalLabel = portalType === 'alumnos' ? 'alumnos' : 'profesores'

  return (
    <div className="mb-5 rounded-[26px] border border-white/15 bg-white/10 p-3 text-left text-white shadow-xl shadow-slate-950/20 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="mobile-bg-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg shadow-slate-950/20">
          <HiOutlineDeviceMobile size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">App mobile</p>
          <h3 className="mt-0.5 text-sm font-black">Instala el portal de {portalLabel}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/70">
            Queda como aplicacion en tu celular para entrar directo al portal.
          </p>
          {platform === 'ios' && (!hasNativePrompt || showManualHelp) ? (
            <p className="mt-2 rounded-2xl bg-white/10 px-3 py-2 text-[11px] font-bold leading-5 text-white/80">
              En iPhone: toca Compartir y luego Agregar a pantalla de inicio.
            </p>
          ) : null}
          {platform !== 'ios' && (!hasNativePrompt || showManualHelp) ? (
            <p className="mt-2 rounded-2xl bg-white/10 px-3 py-2 text-[11px] font-bold leading-5 text-white/80">
              Si no aparece el boton, abre el menu del navegador y elige Instalar app.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={install}
          className="mobile-bg-primary flex-1 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/20"
        >
          <span className="inline-flex items-center justify-center gap-2">
            <HiOutlineDownload size={16} /> Instalar app {portalLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-2xl border border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/70"
        >
          Luego
        </button>
      </div>
    </div>
  )
}
