import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type Props = {
  children: React.ReactElement
}

export const RequireSuperuser: React.FC<Props> = ({ children }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }
  if (!user?.is_superuser) {
    return <Navigate to="/" replace />
  }
  return children
}
