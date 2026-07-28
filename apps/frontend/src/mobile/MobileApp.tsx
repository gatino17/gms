import { Navigate, Outlet } from 'react-router-dom'
import { getMobileLastEntry, getMobileToken, getMobileUser } from './services/mobileApi'

export function MobileRequireSession() {
  const token = getMobileToken()
  const user = getMobileUser()

  if (!token || !user) {
    return <Navigate to="/mobile/login" replace />
  }

  return <Outlet />
}

export function MobileIndexRedirect() {
  const token = getMobileToken()
  const lastEntry = getMobileLastEntry()
  return <Navigate to={token ? '/mobile/home' : (lastEntry || '/mobile/login')} replace />
}
