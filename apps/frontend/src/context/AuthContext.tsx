import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useTenant } from '../lib/tenant'

interface User {
  id?: number
  email: string
  full_name?: string
  is_superuser?: boolean
  tenant_id?: number
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, userInfo?: Partial<User>) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function decodeSub(token: string): number | undefined {
  try {
    const [, payload] = token.split('.')
    if (!payload) return undefined
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const sub = json?.sub
    const num = Number(sub)
    return Number.isFinite(num) ? num : undefined
  } catch {
    return undefined
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId, setTenantId } = useTenant()
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`
    } else {
      delete api.defaults.headers.common.Authorization
      setUser(null)
      try {
        localStorage.removeItem('user')
      } catch {}
    }
    setIsLoading(false)
  }, [token])

  useEffect(() => {
    console.debug('[AuthContext] token/user change', { hasToken: !!token, user })
    if (token && user?.tenant_id != null && user?.is_superuser !== true) {
      console.debug('[AuthContext] setting tenant from user', user.tenant_id)
      setTenantId(user.tenant_id)
    }
  }, [token, user?.tenant_id, user?.is_superuser, setTenantId])

  const login = (newToken: string, userInfo?: Partial<User>) => {
    // Limpia tenant previo por si venimos de otra sesion
    console.debug('[AuthContext] login clearing tenant', { prevTenant: tenantId, userInfo })
    setTenantId(null)
    localStorage.setItem('token', newToken)
    api.defaults.headers.common.Authorization = `Bearer ${newToken}`
    setToken(newToken)
    console.debug('[AuthContext] login set token')
    const decodedId = decodeSub(newToken)
    if (userInfo || decodedId != null) {
      const isSuper = userInfo?.is_superuser === true
      const nextUser: User = {
        id: userInfo?.id ?? decodedId ?? user?.id,
        email: userInfo?.email || user?.email || '',
        full_name: userInfo?.full_name ?? user?.full_name,
        is_superuser: isSuper,
        tenant_id: userInfo?.tenant_id ?? user?.tenant_id,
      }
      setUser(nextUser)
      try {
        localStorage.setItem('user', JSON.stringify(nextUser))
      } catch {}
      // Si no es superusuario y tiene tenant asignado, fijarlo globalmente
      if (nextUser.tenant_id != null && nextUser.is_superuser !== true) {
        console.debug('[AuthContext] login set tenant from user', nextUser.tenant_id)
        setTenantId(nextUser.tenant_id)
      } else {
        console.debug('[AuthContext] login did not set tenant', { tenant: nextUser.tenant_id, isSuper: nextUser.is_superuser })
      }
    }
  }

  const logout = () => {
    // Limpia tenant para evitar arrastrar headers a la próxima sesion
    console.debug('[AuthContext] logout clearing tenant', { prevTenant: tenantId })
    setTenantId(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete api.defaults.headers.common.Authorization
    console.debug('[AuthContext] logout')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
