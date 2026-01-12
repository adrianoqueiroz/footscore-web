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

  return (
    <AnimatePresence>
      {(isPulling || isReloading) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{
            opacity: isReloading ? 0.3 : opacity,
            y: 0
          }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top, 16px) + 8px)',
            left: '50%',
            marginLeft: '-12px', // Metade da largura do ícone (24px / 2)
            zIndex: 50,
            pointerEvents: 'none',
            willChange: 'opacity',
            isolation: 'isolate',
            contain: 'layout style paint'
          }}
        >
          {/* Apenas o ícone girando, sem fundo */}
          <motion.div
            animate={{
              rotate: (canRefresh || isReloading) ? 360 : 0
            }}
            transition={{
              rotate: (canRefresh || isReloading) ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }
            }}
            className={cn(
              "transition-colors duration-300",
              (canRefresh || isReloading)
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <RefreshCw className="h-6 w-6" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}