import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

const ToastComponent = ({ toast, onClose }: ToastProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const [shouldExit, setShouldExit] = useState(false)
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-150, 0, 150], [0, 1, 0])
  const scale = useTransform(x, [-150, 0, 150], [0.8, 1, 0.8])

  useEffect(() => {
    const duration = toast.duration || 3000
    // Adicionar tempo para a animação de saída (400ms) antes de remover do DOM
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
  }

  const styles = {
    success: 'bg-green-500/20 border-green-500/50 text-green-400',
    error: 'bg-red-500/20 border-red-500/50 text-red-400',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  }

  const Icon = icons[toast.type]
  const style = styles[toast.type]

  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false)
    // Se arrastou mais de 80px para qualquer lado, fecha o toast
    if (Math.abs(info.offset.x) > 80) {
      setShouldExit(true)
      // Animar para fora na direção do arrasto
      const targetX = info.offset.x > 0 ? 500 : -500
      x.set(targetX)
      // Fechar após a animação
      setTimeout(() => {
        onClose(toast.id)
      }, 300)
    } else {
      // Se não arrastou o suficiente, volta para a posição original
      x.set(0)
    }
  }

  return (
    <motion.div
      drag="x"
      dragElastic={0.3}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      style={{ x, opacity, scale }}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ 
        opacity: isDragging ? undefined : shouldExit ? 0 : 1, 
        y: 0, 
        scale: isDragging ? undefined : shouldExit ? 0.8 : 1 
      }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ 
        duration: 0.3, 
        ease: [0.4, 0, 0.2, 1],
        exit: { 
          duration: 0.4, 
          ease: [0.4, 0, 0.6, 1],
          opacity: { duration: 0.4 },
          y: { duration: 0.4 },
          scale: { duration: 0.4 }
        }
      }}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl min-w-[340px] max-w-[95vw]',
        'bg-background/95 cursor-grab active:cursor-grabbing',
        style
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium leading-relaxed pr-1">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity p-0.5 rounded hover:bg-foreground/10"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export const ToastContainer = ({ toasts, onClose }: ToastContainerProps) => {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="flex flex-col gap-2 items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {toasts.map((toast) => (
            <motion.div 
              key={toast.id} 
              className="pointer-events-auto"
              layout
            >
              <ToastComponent toast={toast} onClose={onClose} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

