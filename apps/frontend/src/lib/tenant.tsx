import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setTenant as setApiTenant, clearTenant } from './api'

type TenantCtx = {
  tenantId: number | null
  setTenantId: (v: number | null) => void
}

const Ctx = createContext<TenantCtx | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantIdState] = useState<number | null>(() => {
    const raw = localStorage.getItem('tenantId')
    const v = raw ? Number(raw) : null
    return Number.isFinite(v) ? v : null
  })

  useEffect(() => {
    if (tenantId != null) {
      setApiTenant(tenantId)
      localStorage.setItem('tenantId', String(tenantId))
    } else {
      clearTenant()
      localStorage.removeItem('tenantId')
    }
  }, [tenantId])

  const handleSetTenantId = useCallback((value: number | null) => {
    setTenantIdState(value)
  }, [])

  const api = useMemo<TenantCtx>(() => ({
    tenantId,
    setTenantId: handleSetTenantId,
  }), [tenantId, handleSetTenantId])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useTenant() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTenant must be used within TenantProvider')
  return ctx
}
