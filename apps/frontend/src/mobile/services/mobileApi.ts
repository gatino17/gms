import axios, { AxiosError } from 'axios'
import { BASE_URL } from '../../lib/api'

export const MOBILE_TOKEN_KEY = 'mobileToken'
export const MOBILE_USER_KEY = 'mobileUser'
export const MOBILE_TENANT_KEY = 'mobileTenantId'
export const MOBILE_TENANT_INFO_KEY = 'mobileTenantInfo'

export type MobileRole = 'student' | 'teacher'

export interface MobileUser {
  id: number
  email?: string
  first_name?: string
  last_name?: string
  full_name?: string
  tenant_id?: number
  role: MobileRole
}

export interface MobileTenantInfo {
  id: number
  name: string
  slug: string
  logo_url?: string | null
  mobile_enabled: boolean
  teacher_portal_enabled: boolean
  student_portal_enabled: boolean
  online_payments_enabled: boolean
}

export const mobileApi = axios.create({
  baseURL: BASE_URL,
})

export function getMobileToken() {
  try {
    return localStorage.getItem(MOBILE_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getMobileUser(): MobileUser | null {
  try {
    const raw = localStorage.getItem(MOBILE_USER_KEY)
    return raw ? (JSON.parse(raw) as MobileUser) : null
  } catch {
    return null
  }
}

export function setMobileSession(token: string, user: MobileUser) {
  localStorage.setItem(MOBILE_TOKEN_KEY, token)
  localStorage.setItem(MOBILE_USER_KEY, JSON.stringify(user))
  if (user.tenant_id != null) {
    localStorage.setItem(MOBILE_TENANT_KEY, String(user.tenant_id))
  }
  mobileApi.defaults.headers.common.Authorization = `Bearer ${token}`
}

export function setMobileTenant(tenantId: number | string) {
  localStorage.setItem(MOBILE_TENANT_KEY, String(tenantId))
}

export function getMobileTenantInfo(): MobileTenantInfo | null {
  try {
    const raw = localStorage.getItem(MOBILE_TENANT_INFO_KEY)
    return raw ? (JSON.parse(raw) as MobileTenantInfo) : null
  } catch {
    return null
  }
}

export function setMobileTenantInfo(tenant: Partial<MobileTenantInfo>) {
  if (tenant.id != null) {
    setMobileTenant(tenant.id)
  }
  localStorage.setItem(MOBILE_TENANT_INFO_KEY, JSON.stringify(tenant))
}

export function clearMobileSession() {
  try {
    localStorage.removeItem(MOBILE_TOKEN_KEY)
    localStorage.removeItem(MOBILE_USER_KEY)
    localStorage.removeItem(MOBILE_TENANT_KEY)
    localStorage.removeItem(MOBILE_TENANT_INFO_KEY)
  } catch {}
  delete mobileApi.defaults.headers.common.Authorization
}

export function mobileUserName(user?: MobileUser | null) {
  if (!user) return 'Usuario'
  const composed = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return user.full_name || composed || user.email || 'Usuario'
}

mobileApi.interceptors.request.use((config) => {
  const token = getMobileToken()
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  try {
    const tenantId = localStorage.getItem(MOBILE_TENANT_KEY)
    if (tenantId && !config.headers?.['X-Tenant-ID'] && !config.headers?.['x-tenant-id']) {
      config.headers = config.headers ?? {}
      config.headers['X-Tenant-ID'] = tenantId
    }
  } catch {}
  return config
})

mobileApi.interceptors.response.use(
  (res) => res,
  (err: AxiosError<any>) => {
    const raw = err.response?.data?.detail ?? err.response?.data?.message ?? err.message
    err.message = typeof raw === 'string' ? raw : JSON.stringify(raw || 'Error de red')
    if (err.response?.status === 401 || err.response?.status === 403) {
      clearMobileSession()
    }
    return Promise.reject(err)
  },
)
