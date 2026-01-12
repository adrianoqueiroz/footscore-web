import React from 'react'
import { RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Componente visual que mostra o feedback durante pull-to-refresh
 */
interface PullToRefreshIndicatorProps {
  isPulling: boolean
  pullDistance: number
  canRefresh: boolean
  isReloading?: boolean
}

export default function PullToRefreshIndicator({
  isPulling,
  pullDistance,
  canRefresh,
  isReloading = false
}: PullToRefreshIndicatorProps) {
  // Calcula a opacidade baseada na distância do pull
  const opacity = Math.min(pullDistance / 80, 1)
  const scale = 0.5 + (pullDistance / 80) * 0.5 // Escala de 0.5 para 1.0

  return (
    <AnimatePresence>
      {(isPulling || isReloading) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{
            opacity: isReloading ? 0.3 : opacity, // Opacidade baixa durante reloading
            y: 0
          }}
          exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.01 } }}
          style={{
            // Posicionamento fixed para viewport, isolamento completo
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            pointerEvents: 'none',
            // Garante isolamento visual e performance
            willChange: 'transform, opacity',
            isolation: 'isolate',
            contain: 'layout style paint'
          }}
        >
          {/* Container adicional para garantir overflow perfeito */}
          <div
            className="relative"
            style={{
              width: '56px', // 16px padding * 2 + 24px icon = 56px
              height: '56px',
              borderRadius: '50%',
              overflow: 'hidden',
              // Garante isolamento completo
              isolation: 'isolate'
            }}
          >
            <motion.div
              animate={{
                scale: scale
              }}
              transition={{
                scale: { duration: 0.3 }
              }}
              className={cn(
                "w-full h-full p-4 rounded-full transition-all duration-300 flex items-center justify-center",
                isReloading
                  ? "bg-primary/90 border-2 border-primary text-primary-foreground shadow-primary/50 shadow-lg"
                  : canRefresh
                  ? "bg-primary/90 border-2 border-primary text-primary-foreground shadow-primary/50 shadow-lg"
                  : "bg-background/80 backdrop-blur-md border-2 border-muted-foreground/40 text-muted-foreground shadow-md"
              )}
              style={{
                // Efeito de glow elegante
                boxShadow: (canRefresh || isReloading)
                  ? '0 0 20px rgba(var(--primary), 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)'
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                borderRadius: '50%' // Borda perfeitamente arredondada
              }}
            >
              {/* Círculo interno para profundidade */}
              <div
                className={cn(
                  "absolute inset-1 rounded-full transition-colors duration-300",
                  canRefresh
                    ? "bg-primary/20"
                    : "bg-muted-foreground/10"
                )}
                style={{
                  borderRadius: '50%' // Borda perfeitamente arredondada
                }}
              />

              {/* Ícone com rotação dedicada */}
              <motion.div
                animate={{
                  rotate: (canRefresh || isReloading) ? 360 : 0
                }}
                transition={{
                  rotate: (canRefresh || isReloading) ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }
                }}
                className="relative z-10"
              >
                <RefreshCw className="h-5 w-5" />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}