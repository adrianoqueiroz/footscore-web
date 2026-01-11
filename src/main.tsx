import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import './mobile.css'

// Registrar service worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('[SW] 🔄 Starting SW registration...')

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] ✅ Registered successfully:', registration.scope)
        console.log('[SW] 📊 State:', registration.active ? 'active' : 'installing')
        console.log('[SW] 🌐 Browser:', navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other')

        registration.update().catch((error) => {
          console.log('[SW] ❌ Update error:', error.message)
        })

        // Verificar se tem push manager
        if ('pushManager' in registration) {
          console.log('[SW] ✅ Push Manager available')
        } else {
          console.log('[SW] ❌ Push Manager not available')
        }
      })
      .catch((error) => {
        console.log('[SW] ❌ Registration failed:', error.message)
      })
  })
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Verificar se o client_id está configurado
if (!GOOGLE_CLIENT_ID) {
  console.warn(
    '⚠️ VITE_GOOGLE_CLIENT_ID não está configurado!\n' +
    'Por favor, crie um arquivo .env com:\n' +
    'VITE_GOOGLE_CLIENT_ID=seu-client-id-aqui\n\n' +
    'Veja o README.md para instruções de como obter o Client ID.'
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#0f172a',
        color: '#e2e8f0'
      }}>
        <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#fbbf24' }}>⚠️ Configuração Necessária</h1>
        <p style={{ marginBottom: '8px', lineHeight: '1.6' }}>
          O Google Client ID não está configurado.
        </p>
        <p style={{ marginBottom: '16px', lineHeight: '1.6', color: '#94a3b8' }}>
          Por favor, crie um arquivo <code style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>.env</code> na raiz do projeto com:
        </p>
        <pre style={{
          backgroundColor: '#1e293b',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'left',
          overflow: 'auto',
          border: '1px solid #334155'
        }}>
          <code style={{ color: '#10b981' }}>
            VITE_API_BASE_URL=http://localhost:3000/api{'\n'}
            VITE_GOOGLE_CLIENT_ID=seu-client-id-aqui
          </code>
        </pre>
        <p style={{ marginTop: '16px', fontSize: '14px', color: '#94a3b8' }}>
          Veja o <code style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>README.md</code> para instruções detalhadas.
        </p>
      </div>
    )}
  </ErrorBoundary>,
)

