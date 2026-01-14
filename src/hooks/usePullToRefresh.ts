import { useEffect, useRef, useCallback, useState, RefObject } from 'react'

// Configurações
const ACTIVATION_DELAY = 50    // ms para esperar antes de ativar (permite scroll normal acontecer)
const DEAD_ZONE = 20           // pixels antes de mostrar indicador
const PULL_THRESHOLD = 220     // pixels para ativar refresh (similar ao nativo)
const RESISTANCE = 0.4         // resistência do rubber band (menor = mais resistência)

export interface PullToRefreshState {
  isPulling: boolean
  pullDistance: number
  canRefresh: boolean
  isRefreshing: boolean
  visualOffset: number        // offset visual para aplicar no conteúdo (rubber band)
}

interface UsePullToRefreshOptions {
  contentRef: RefObject<HTMLElement | null>
}

/**
 * Verifica se o elemento está dentro de um contexto de scroll horizontal
 * (carrossel, elementos com touch-action: pan-x, etc.)
 */
function isInHorizontalScrollContext(element: HTMLElement | null): boolean {
  if (!element) return false
  
  let current: HTMLElement | null = element
  while (current && current !== document.body) {
    const style = getComputedStyle(current)
    const touchAction = style.touchAction
    const overflowX = style.overflowX
    
    // Se tem touch-action que bloqueia vertical (pan-x, pan-x pinch-zoom)
    if (touchAction.includes('pan-x') && !touchAction.includes('pan-y')) {
      return true
    }
    
    // Se é um container com scroll horizontal ativo
    if ((overflowX === 'scroll' || overflowX === 'auto') && 
        current.scrollWidth > current.clientWidth + 5) {
      return true
    }
    
    // Verifica data attributes que indicam carrossel/slider
    if (current.hasAttribute('data-carousel') || 
        current.hasAttribute('data-slider') ||
        current.classList.contains('embla') ||
        current.classList.contains('swiper')) {
      return true
    }
    
    current = current.parentElement
  }
  return false
}

/**
 * Verifica se o elemento está dentro de um container scrollável
 */
function isInScrollableContainer(element: HTMLElement | null): boolean {
  if (!element) return false
  
  let current: HTMLElement | null = element.parentElement
  while (current && current !== document.body) {
    const style = getComputedStyle(current)
    const overflowY = style.overflowY
    
    // Se é um container com scroll vertical
    if ((overflowY === 'scroll' || overflowY === 'auto') && 
        current.scrollHeight > current.clientHeight + 5) {
      // Verifica se não está no topo desse container
      if (current.scrollTop > 0) {
        return true
      }
    }
    
    current = current.parentElement
  }
  return false
}

/**
 * Calcula o offset visual com efeito de resistência (rubber band)
 */
function calculateVisualOffset(pullDistance: number): number {
  if (pullDistance <= 0) return 0
  // Efeito de resistência: quanto mais puxa, mais difícil fica
  return Math.pow(pullDistance, 0.6) * RESISTANCE
}

/**
 * Hook para implementar pull-to-refresh em PWA no iOS
 * O reload SÓ acontece quando o usuário SOLTA a tela após ultrapassar o threshold
 */
export function usePullToRefresh({ contentRef }: UsePullToRefreshOptions): PullToRefreshState {
  // Refs para rastrear o estado do touch
  const touchActiveRef = useRef(false)          // Se há um toque ativo
  const isConfirmedRef = useRef(false)          // Se pull-to-refresh foi confirmado para este toque
  const startYRef = useRef<number>(0)           // Posição Y inicial do toque
  const startTimeRef = useRef<number>(0)        // Timestamp do início do toque
  const touchTargetRef = useRef<HTMLElement | null>(null) // Elemento que recebeu o toque
  const lastScrollYRef = useRef<number>(0)      // Último valor de scrollY observado
  
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    canRefresh: false,
    isRefreshing: false,
    visualOffset: 0
  })

  const resetState = useCallback(() => {
    setState({
      isPulling: false,
      pullDistance: 0,
      canRefresh: false,
      isRefreshing: false,
      visualOffset: 0
    })
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Reset do estado
    touchActiveRef.current = true
    isConfirmedRef.current = false
    touchTargetRef.current = e.target as HTMLElement
    startTimeRef.current = Date.now()
    lastScrollYRef.current = window.scrollY
    
    // Salva posição inicial
    startYRef.current = e.touches[0].clientY
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Se não há toque ativo, ignora
    if (!touchActiveRef.current) {
      return
    }
    
    const currentY = e.touches[0].clientY
    const deltaY = currentY - startYRef.current
    const currentScrollY = window.scrollY
    const timeSinceStart = Date.now() - startTimeRef.current
    
    // Se está movendo para cima ou lateralmente, não é pull-to-refresh
    if (deltaY <= 0) {
      if (state.isPulling) {
        resetState()
      }
      isConfirmedRef.current = false
      return
    }
    
    // Se o scroll saiu do topo em algum momento, não é pull-to-refresh
    if (currentScrollY > 0 || lastScrollYRef.current > 0) {
      if (state.isPulling) {
        resetState()
      }
      isConfirmedRef.current = false
      lastScrollYRef.current = currentScrollY
      return
    }
    
    lastScrollYRef.current = currentScrollY
    
    // Se ainda não confirmou que é pull-to-refresh, faz as verificações
    if (!isConfirmedRef.current) {
      // Verifica se está em contexto de scroll horizontal (carrossel, etc.)
      if (isInHorizontalScrollContext(touchTargetRef.current)) {
        touchActiveRef.current = false
        return
      }
      
      // Verifica se está dentro de um container scrollável que não está no topo
      if (isInScrollableContainer(touchTargetRef.current)) {
        touchActiveRef.current = false
        return
      }
      
      // IMPORTANTE: Espera um tempo mínimo para ver se o scroll vai acontecer
      // Isso permite que o scroll normal tenha chance de acontecer antes de assumirmos overscroll
      if (timeSinceStart < ACTIVATION_DELAY) {
        return
      }
      
      // Se chegou aqui após o delay, o scroll ainda está em 0, e está puxando para baixo
      // Isso significa que é overscroll confirmado!
      isConfirmedRef.current = true
    }
    
    // A partir daqui, pull-to-refresh está confirmado
    // Calcula a distância efetiva após a zona morta
    const effectiveDistance = Math.max(0, deltaY - DEAD_ZONE)
    
    if (effectiveDistance > 0) {
      // Agora sim, previne o comportamento padrão
      e.preventDefault()
      
      const canRefresh = effectiveDistance >= PULL_THRESHOLD
      const visualOffset = calculateVisualOffset(effectiveDistance)
      
      setState({
        isPulling: true,
        pullDistance: effectiveDistance,
        canRefresh,  // Indica visualmente que pode soltar para recarregar
        isRefreshing: false,
        visualOffset
      })
    } else if (state.isPulling) {
      // Ainda na zona morta
      resetState()
    }
  }, [state.isPulling, resetState])

  const handleTouchEnd = useCallback(() => {
    // Se não havia toque ativo, nada a fazer
    if (!touchActiveRef.current) {
      return
    }
    
    // Captura se pode fazer refresh antes de resetar
    const shouldRefresh = state.canRefresh
    
    // Reset das refs
    touchActiveRef.current = false
    isConfirmedRef.current = false
    touchTargetRef.current = null
    
    if (shouldRefresh) {
      // Se vai fazer reload, mantém o indicador girando
      // mas reseta o visualOffset para o conteúdo voltar à posição
      setState({
        isPulling: true,  // Mantém true para o indicador continuar visível
        pullDistance: state.pullDistance,  // Mantém a distância para a opacidade
        canRefresh: true,  // Mantém true para continuar girando
        isRefreshing: true,
        visualOffset: 0  // Reseta para o conteúdo voltar à posição
      })
      
      // Espera a animação de volta do conteúdo terminar (transição CSS de 300ms)
      setTimeout(() => {
        window.scrollTo(0, 0)
        window.location.reload()
      }, 350)
    } else {
      // Se não vai fazer reload, reseta tudo imediatamente
      setState({
        isPulling: false,
        pullDistance: 0,
        canRefresh: false,
        isRefreshing: false,
        visualOffset: 0
      })
    }
  }, [state.canRefresh, state.pullDistance])

  useEffect(() => {
    // Verifica se está em modo PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as unknown as { standalone?: boolean }).standalone

    // Só ativa em PWA, pois no Safari/Chrome normal já funciona nativamente
    if (!isStandalone) return

    // Adiciona event listeners
    // touchstart precisa ser passive para melhor performance
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    // touchmove NÃO pode ser passive pois precisamos chamar preventDefault()
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return state
}
