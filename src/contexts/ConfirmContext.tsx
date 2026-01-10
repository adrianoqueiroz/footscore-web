import { createContext, useContext, ReactNode } from 'react'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const confirmHook = useConfirm()

  return (
    <ConfirmContext.Provider value={{ confirm: confirmHook.confirm }}>
      {children}
      {confirmHook.confirmState && (
        <ConfirmDialog
          open={confirmHook.confirmState.open}
          title={confirmHook.confirmState.title}
          message={confirmHook.confirmState.message}
          confirmText={confirmHook.confirmState.confirmText}
          cancelText={confirmHook.confirmState.cancelText}
          variant={confirmHook.confirmState.variant}
          onConfirm={confirmHook.handleConfirm}
          onCancel={confirmHook.handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirmContext() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirmContext must be used within ConfirmProvider')
  }
  return context
}

