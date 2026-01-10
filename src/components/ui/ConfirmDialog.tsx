import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import Button from './Button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: 'bg-red-500/20 border-red-500/50 text-red-400',
    warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            {/* Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-xl',
                'backdrop-blur-sm'
              )}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={cn('p-2 rounded-full flex-shrink-0', variantStyles[variant])}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  {title && (
                    <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {message}
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="flex-shrink-0 hover:opacity-70 transition-opacity text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  {cancelText}
                </Button>
                <Button
                  variant={variant === 'danger' ? 'primary' : 'primary'}
                  onClick={onConfirm}
                  className={cn(
                    'flex-1',
                    variant === 'danger' && 'bg-red-500 hover:bg-red-600'
                  )}
                >
                  {confirmText}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

