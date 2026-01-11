import { useCallback } from 'react'

/**
 * Hook para fornecer feedback háptico (vibração) em dispositivos móveis
 * 
 * NOTA: No iOS Safari/PWA, navigator.vibrate pode não funcionar devido a limitações do sistema.
 * O feedback háptico nativo do iOS só está disponível em apps nativos.
 * Esta implementação tenta usar a API de vibração, mas pode não funcionar em todos os casos.
 */
export function useHapticFeedback() {
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    // Verificar se está em um dispositivo móvel iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    
    // Verificar se a API de vibração está disponível
    if ('vibrate' in navigator) {
      try {
        // Tentar diferentes padrões dependendo do dispositivo
        // Para switches, usamos padrões curtos e rápidos para simular feedback tátil
        let pattern: number | number[]
        
        if (isIOS) {
          // No iOS PWA, usar padrões curtos que podem funcionar melhor
          // Padrão de vibração rápida similar ao feedback do alarme do iPhone
          pattern = type === 'light' ? [10, 5, 10] : type === 'medium' ? [15, 5, 15] : [20, 5, 20]
        } else {
          // Android e outros - padrões curtos para feedback rápido
          pattern = type === 'light' ? 10 : type === 'medium' ? 15 : 20
        }
        
        // Tentar vibrar
        navigator.vibrate(pattern)
      } catch (error) {
        // Silenciosamente falhar se não suportado
        // Não logar erro para não poluir o console em produção
      }
    }
  }, [])

  return triggerHaptic
}

