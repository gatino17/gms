import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { TenantProvider } from './lib/tenant'
import { AuthProvider } from './context/AuthContext'
import './styles.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TenantProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TenantProvider>
  </React.StrictMode>
)
