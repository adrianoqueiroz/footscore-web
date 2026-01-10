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
        // iOS pode precisar de padrões mais longos, mas a API pode não funcionar mesmo assim
        let pattern: number | number[]
        
        if (isIOS) {
          // No iOS, tentar padrões mais longos
          // Nota: iOS Safari pode não suportar vibrate mesmo assim
          pattern = type === 'light' ? 50 : type === 'medium' ? 100 : 200
        } else {
          // Android e outros
          pattern = type === 'light' ? 10 : type === 'medium' ? 20 : 30
        }
        
        // Tentar vibrar
        const result = navigator.vibrate(pattern)
        
        // Log para debug
        console.log('[Haptic] Attempted:', { 
          type, 
          pattern, 
          isIOS, 
          result,
          userAgent: navigator.userAgent,
          hasVibrate: 'vibrate' in navigator
        })
        
        // Se vibrate retornou false, a API não está disponível ou foi bloqueada
        if (result === false) {
          console.warn('[Haptic] Vibration API returned false - not supported or blocked')
        }
        
        // Se no iOS e não funcionou, informar sobre limitações
        if (isIOS && result === false) {
          console.info('[Haptic] iOS Safari/PWA has limited vibration support. Native haptic feedback requires a native app.')
        }
      } catch (error) {
        console.error('[Haptic] Error triggering vibration:', error)
      }
    } else {
      // API não disponível
      console.warn('[Haptic] Vibration API not available', {
        hasVibrate: 'vibrate' in navigator,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      })
    }
  }, [])

  return triggerHaptic
}

