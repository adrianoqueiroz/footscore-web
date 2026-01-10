import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hook para garantir que navegações em PWA sejam tratadas como SPA
 * Previne que o Safari crie novas "páginas" para cada rota
 */
export function usePWANavigation() {
  const location = useLocation()

  useEffect(() => {
    // Verifica se está em modo standalone (PWA)
    const isStandalone = 
      (window.navigator as any).standalone || 
      window.matchMedia('(display-mode: standalone)').matches

    if (isStandalone) {
      // Força o Safari a tratar como SPA
      // Previne que o histórico crie entradas separadas
      if (window.history.state === null) {
        window.history.replaceState({ index: 0 }, '')
      }
    }
  }, [location])
}

