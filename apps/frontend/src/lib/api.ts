import axios, { AxiosError } from 'axios'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8002'
const TENANT_KEY = 'tenantId'

export const api = axios.create({
  baseURL: BASE_URL,
  // opcional:
  // timeout: 15000,
})

/** Lee el tenant actual (si existe). */
export function getTenant(): string | null {
  try {
    return api.defaults.headers.common['X-Tenant-ID'] as string
      ?? localStorage.getItem(TENANT_KEY)
  } catch {
    return null
  }
}

/** Define el tenant en headers por defecto y lo persiste. */
export function setTenant(tenantId: number | string) {
  const tid = String(tenantId)
  api.defaults.headers.common['X-Tenant-ID'] = tid
  try { localStorage.setItem(TENANT_KEY, tid) } catch {}
}

/** Limpia el tenant de headers y storage. */
export function clearTenant() {
  delete api.defaults.headers.common['X-Tenant-ID']
  try { localStorage.removeItem(TENANT_KEY) } catch {}
}

/** Interceptor: asegura que toda request lleve X-Tenant-ID. */
api.interceptors.request.use((config) => {
  const headerAlready = config.headers?.['X-Tenant-ID'] || config.headers?.['x-tenant-id']
  if (!headerAlready) {
    const tid = getTenant()
    if (tid) {
      config.headers = config.headers ?? {}
      config.headers['X-Tenant-ID'] = tid
      console.debug('[api] set tenant header', { url: config.url, method: config.method, tenant: tid })
    } else {
      console.debug('[api] no tenant available to set', { url: config.url, method: config.method })
    }
  } else {
    console.debug('[api] tenant header already present', { url: config.url, method: config.method, header: headerAlready })
  }
  return config
})

/** Interceptor opcional: normaliza errores en `error.message` */
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<any>) => {
    const rawDetail = err.response?.data?.detail
    let msg: any = rawDetail ?? err.response?.data?.message ?? err.message ?? 'Error de red'
    if (Array.isArray(msg)) {
      msg = msg.map((d: any) => d?.msg || d?.detail || JSON.stringify(d)).join(' | ')
    }
    if (msg && typeof msg === 'object') {
      msg = JSON.stringify(msg)
    }
    err.message = String(msg)
    return Promise.reject(err)
  }
)

/** Convierte URL relativa a absoluta usando BASE_URL. */
export function toAbsoluteUrl(pathOrUrl?: string | null): string | undefined {
  if (!pathOrUrl) return undefined
  try {
    const u = new URL(pathOrUrl) // ya es absoluta
    return u.toString()
  } catch {
    // Relativa: normaliza slashes
    const left = BASE_URL.replace(/\/+$/, '')
    const right = String(pathOrUrl).replace(/^\/+/, '')
    return `${left}/${right}`
  }
}
