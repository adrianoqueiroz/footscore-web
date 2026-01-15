import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const PULL_THRESHOLD = 220 // Deve corresponder ao valor no hook

/**
 * Componente visual que mostra o feedback durante pull-to-refresh
 * Aparece/desaparece instantaneamente sem animações de transição
 * O reload acontece quando o usuário SOLTA após ultrapassar o threshold
 */
interface PullToRefreshIndicatorProps {
  isPulling: boolean
  pullDistance: number
  canRefresh: boolean
  isRefreshing?: boolean
  visualOffset?: number
}

export default function PullToRefreshIndicator({
  isPulling,
  pullDistance,
  canRefresh,
  isRefreshing = false,
  visualOffset = 0
}: PullToRefreshIndicatorProps) {
  // Não renderiza nada se não está puxando nem recarregando
  // Isso garante sumiço INSTANTÂNEO quando o usuário solta
  if (!isPulling && !isRefreshing) {
    return null
  }

  // Calcula a opacidade baseada na distância do pull (0 a 1)
  // Quando está recarregando, mantém opacidade fixa para evitar mudanças visuais
  const opacity = isRefreshing 
    ? 0.8  // Opacidade fixa quando está recarregando
    : Math.min(pullDistance / (PULL_THRESHOLD * 0.5), 1)
  
  // Calcula a rotação progressiva baseada na distância (0 a 360 graus)
  const progressRotation = (pullDistance / PULL_THRESHOLD) * 360
  
  // Calcula o progresso (0 a 1) para feedback visual
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  
  // Escala aumenta conforme se aproxima do threshold
  // Quando está recarregando, mantém escala fixa baseada no threshold para evitar "pulsar"
  const scale = isRefreshing 
    ? 1.2  // Escala fixa quando está recarregando (1 + 1.0 * 0.2)
    : 1 + (progress * 0.2)
  
  // Posição vertical: acompanha o visual offset para parecer "preso" ao conteúdo
  // mas limitado para não ir muito para baixo
  // Quando está recarregando, mantém posição fixa no topo
  const topOffset = isRefreshing 
    ? 0  // Posição fixa no topo quando está recarregando
    : Math.min(visualOffset * 0.5, 40)
  
  // Quando pode fazer refresh (atingiu threshold) ou está recarregando, gira continuamente
  const shouldSpin = canRefresh || isRefreshing

  return (
    <div
      style={{
        position: 'fixed',
        top: `calc(max(16px, env(safe-area-inset-top, 16px) + 8px) + ${topOffset}px)`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
        opacity: isRefreshing ? 0.8 : opacity,
      }}
    >
      {/* Wrapper para aplicar escala sem interferir na rotação quando está girando */}
      <div
        style={shouldSpin ? {
          transform: `scale(${scale})`,
          display: 'inline-block',
        } : undefined}
      >
        <div
          className={cn(
            "transition-colors duration-150",
            shouldSpin && "animate-spin",
            shouldSpin ? "text-primary" : "text-muted-foreground"
          )}
          style={{
            // Quando não está girando, aplica rotação progressiva e escala juntas
            // Quando está girando, a rotação é feita pela classe animate-spin
            // e a escala é aplicada no wrapper pai
            transform: shouldSpin 
              ? undefined  // Deixa animate-spin fazer a rotação
              : `rotate(${progressRotation}deg) scale(${scale})`,
          }}
        >
          <RefreshCw className="h-6 w-6" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}
