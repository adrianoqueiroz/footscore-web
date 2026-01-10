import { createContext, useContext, ReactNode } from 'react'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/ui/Toast'
import { useConnectionContext } from './ConnectionContext'

interface ToastContextType {
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const { isOffline } = useConnectionContext()

  // Wrapper para suprimir toasts de erro quando estiver offline ou quando for erro de conexão
  const wrappedToast = {
    ...toast,
    error: (message: string, duration?: number) => {
      // Não mostrar toast de erro se estiver offline ou se a mensagem for sobre conexão
      if (isOffline || 
          message.toLowerCase().includes('conexão') || 
          message.toLowerCase().includes('conexao') ||
          message.toLowerCase().includes('servidor') ||
          message.toLowerCase().includes('network') ||
          message.toLowerCase().includes('fetch failed')) {
        return ''
      }
      return toast.error(message, duration)
    }
  }

  return (
    <ToastContext.Provider value={wrappedToast}>
      {children}
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }
  return context
}

