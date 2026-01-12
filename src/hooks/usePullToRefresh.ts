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
  const startScrollYRef = useRef<number>(0) // Armazenar scrollY inicial
  const lastScrollYRef = useRef<number>(0) // Rastrear scrollY durante o movimento
  const [pullState, setPullState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    canRefresh: false,
    isReloading: false
  })
  const pullThreshold = 80 // Distância mínima para ativar o refresh

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Sempre armazena a posição inicial e scrollY atual
    startYRef.current = e.touches[0].clientY
    startScrollYRef.current = window.scrollY
    lastScrollYRef.current = window.scrollY // Inicializa o rastreamento
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === null) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - startYRef.current
    const currentScrollY = window.scrollY
    
    // Verifica se o scroll mudou durante este movimento específico
    const scrollChangedThisMove = currentScrollY !== lastScrollYRef.current
    
    // Atualiza o último scrollY para o próximo movimento
    lastScrollYRef.current = currentScrollY

    // Só ativa se:
    // 1. Começou no topo
    // 2. Há conteúdo scrollável
    // 3. Está movendo para baixo
    const canPageScroll = document.body.scrollHeight > window.innerHeight + 10
    const isAtTop = startScrollYRef.current <= 5

    if (isAtTop && canPageScroll && deltaY > 0) {
      // Se o scroll mudou durante o movimento, mostra indicador imediatamente
      // Se não mudou ainda mas está arrastando, mostra também (aparece antes do scroll)
      const isPulling = deltaY > 10 // Threshold menor para aparecer imediatamente
      const canRefresh = deltaY > pullThreshold

      // Só mostra se realmente há scroll ou se está tentando scrollar (deltaY suficiente)
      if (scrollChangedThisMove || deltaY > 15) {
        setPullState({
          isPulling,
          pullDistance: Math.min(deltaY, pullThreshold + 20),
          canRefresh
        })

        // Só previne scroll quando já confirmou que vai recarregar
        if (canRefresh) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    } else {
      // Se não está no topo ou não há scroll, cancela pull-to-refresh
      if (deltaY > 0 && (!isAtTop || !canPageScroll)) {
        setPullState({
          isPulling: false,
          pullDistance: 0,
          canRefresh: false,
          isReloading: false
        })
      }
    }
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (startYRef.current === null) return

    const currentY = e.changedTouches[0].clientY
    const deltaY = currentY - startYRef.current

    // Desaparece INSTANTANEAMENTE usando requestAnimationFrame para garantir que acontece antes do próximo frame
    requestAnimationFrame(() => {
      setPullState(prev => ({
        ...prev,
        isPulling: false,
        pullDistance: 0,
        canRefresh: false
      }))
    })

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
    lastScrollYRef.current = 0
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