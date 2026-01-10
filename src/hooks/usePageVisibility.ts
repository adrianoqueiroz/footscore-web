import { useEffect, useRef } from 'react'

interface UsePageVisibilityOptions {
  /**
   * Callback chamado quando a página volta a ficar visível
   */
  onVisible?: () => void
  /**
   * Se true, também recarrega quando a página recebe foco (mesmo que já esteja visível)
   * Útil para quando o usuário volta de outra aba
   */
  reloadOnFocus?: boolean
  /**
   * Delay em milissegundos antes de chamar o callback (para evitar recarregar muito rápido)
   * @default 500
   */
  delay?: number
}

/**
 * Hook para detectar quando a página volta a ficar visível e recarregar dados
 * Útil para atualizar dados quando o usuário volta à página após estar ausente
 */
export function usePageVisibility({
  onVisible,
  reloadOnFocus = true,
  delay = 500,
}: UsePageVisibilityOptions = {}) {
  const callbackRef = useRef(onVisible)
  const lastHiddenTimeRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Atualizar ref do callback sem causar re-render
  useEffect(() => {
    callbackRef.current = onVisible
  }, [onVisible])

  useEffect(() => {
    if (!onVisible) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Página ficou visível
        const now = Date.now()
        const wasHidden = lastHiddenTimeRef.current !== null
        const timeHidden = wasHidden ? now - lastHiddenTimeRef.current : 0

        // Só recarregar se estava escondida por mais de 1 segundo
        // (evita recarregar em mudanças rápidas de aba)
        if (timeHidden > 1000 || !wasHidden) {
          // Limpar timeout anterior se houver
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }

          // Chamar callback com delay para evitar múltiplas chamadas
          timeoutRef.current = setTimeout(() => {
            if (callbackRef.current) {
              callbackRef.current()
            }
          }, delay)
        }

        lastHiddenTimeRef.current = null
      } else {
        // Página ficou escondida
        lastHiddenTimeRef.current = Date.now()
      }
    }

    const handleFocus = () => {
      if (reloadOnFocus && document.visibilityState === 'visible') {
        // Limpar timeout anterior se houver
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Chamar callback com delay
        timeoutRef.current = setTimeout(() => {
          if (callbackRef.current) {
            callbackRef.current()
          }
        }, delay)
      }
    }

    // Escutar mudanças de visibilidade
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Escutar foco da janela (útil quando volta de outra aba)
    if (reloadOnFocus) {
      window.addEventListener('focus', handleFocus)
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (reloadOnFocus) {
        window.removeEventListener('focus', handleFocus)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [onVisible, reloadOnFocus, delay])
}

