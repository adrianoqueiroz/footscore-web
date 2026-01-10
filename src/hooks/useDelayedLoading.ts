import { useState, useEffect } from 'react'

/**
 * Hook que adiciona um delay mínimo antes de mostrar o estado de loading.
 * Isso evita que skeletons apareçam em carregamentos muito rápidos,
 * causando um efeito de "piscar" desnecessário.
 * 
 * @param isLoading - Estado de loading atual
 * @param delay - Delay mínimo em milissegundos antes de mostrar loading (padrão: 300ms)
 * @returns true se o loading persistir por mais tempo que o delay
 */
export function useDelayedLoading(isLoading: boolean, delay: number = 300): boolean {
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    if (isLoading) {
      // Se começou a carregar, aguardar o delay antes de mostrar
      const timer = setTimeout(() => {
        setShowLoading(true)
      }, delay)

      return () => {
        clearTimeout(timer)
      }
    } else {
      // Se parou de carregar, esconder imediatamente
      setShowLoading(false)
    }
  }, [isLoading, delay])

  return showLoading
}

