import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ConnectionContextType {
  isOffline: boolean
  setIsOffline: (value: boolean) => void
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined)

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const handleConnectionStatusChange = (event: CustomEvent) => {
      setIsOffline(event.detail.isOffline)
    }

    window.addEventListener('connection-status-changed', handleConnectionStatusChange as EventListener)

    return () => {
      window.removeEventListener('connection-status-changed', handleConnectionStatusChange as EventListener)
    }
  }, [])

  return (
    <ConnectionContext.Provider value={{ isOffline, setIsOffline }}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnectionContext() {
  const context = useContext(ConnectionContext)
  if (context === undefined) {
    // Retornar valores padrão se não estiver dentro do provider
    return { isOffline: false, setIsOffline: () => {} }
  }
  return context
}

