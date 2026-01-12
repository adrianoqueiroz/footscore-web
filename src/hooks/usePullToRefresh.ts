import { useEffect, useRef, useCallback, useState } from 'react'

interface PullToRefreshState {
  isPulling: boolean
  pullDistance: number
  canRefresh: boolean
  isReloading: boolean
}

/**
 * Hook para implementar pull-to-refresh em PWA no iOS
 * Simula o comportamento nativo do Safari quando o usuário arrasta para baixo
 */
export function usePullToRefresh(): PullToRefreshState {
  const startYRef = useRef<number | null>(null)
  const [pullState, setPullState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    canRefresh: false,
    isReloading: false
  })
  const pullThreshold = 80 // Distância mínima para ativar o refresh

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Só funciona se estiver no topo da página (scrollY <= 5 para tolerância)
    if (window.scrollY > 5) return

    startYRef.current = e.touches[0].clientY
    setPullState({
      isPulling: false,
      pullDistance: 0,
      canRefresh: false
    })
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null || window.scrollY > 0) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - startYRef.current

    // Só ativa se estiver arrastando para baixo (deltaY > 0)
    if (deltaY > 0) {
      const isPulling = deltaY > 20 // Pequeno threshold para confirmar intenção
      const canRefresh = deltaY > pullThreshold

      setPullState({
        isPulling,
        pullDistance: Math.min(deltaY, pullThreshold + 20), // Limita o feedback visual
        canRefresh
      })

      // Previne scroll padrão durante qualquer pull-to-refresh
      if (isPulling) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (startYRef.current === null) return

    const currentY = e.changedTouches[0].clientY
    const deltaY = currentY - startYRef.current

    // SEMPRE faz o indicador desaparecer quando solta o dedo (evita sobreposição)
    setPullState(prev => ({
      ...prev,
      isPulling: false,
      pullDistance: 0,
      canRefresh: false
    }))

    // Se arrastou o suficiente para baixo, recarrega a página
    if (deltaY > pullThreshold) {
      // Define estado de reloading (mas indicador já está invisível)
      setPullState(prev => ({ ...prev, isReloading: true }))

      // Pequeno delay para dar feedback visual
      setTimeout(() => {
        // Garante que estamos no topo antes do reload e previne problemas de viewport no iOS
        window.scrollTo(0, 0)

        // Pequeno delay adicional para garantir que o scroll foi aplicado
        setTimeout(() => {
          window.location.reload()
        }, 50)
      }, 150)
      return // Não faz reset pois está recarregando
    }

    // Se NÃO vai recarregar, reset completo
    startYRef.current = null
    setPullState({
      isPulling: false,
      pullDistance: 0,
      canRefresh: false,
      isReloading: false
    })

    // Só volta ao topo se realmente necessário, sem animação brusca
    if (window.scrollY > 10) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [])

  useEffect(() => {
    // Verifica se está em modo PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone

    // Só ativa em PWA, pois no Safari normal já funciona nativamente
    if (!isStandalone) return

    // Adiciona event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return pullState
}