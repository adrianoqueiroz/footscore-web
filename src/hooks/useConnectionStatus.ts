import { useState, useEffect, useCallback, useRef } from 'react'
import { apiService } from '@/services/api.service'

interface ConnectionStatus {
  isOnline: boolean
  isChecking: boolean
  lastError: Error | null
}

// Removido HEALTH_CHECK_INTERVAL - verificações serão feitas apenas sob demanda
const MAX_CONSECUTIVE_FAILURES = 1 // Após 1 falha consecutiva, considerar offline
const MIN_SUCCESSFUL_CHECKS = 1 // Precisa de 1 verificação bem-sucedida para voltar a online

// Hook para verificar conexão sob demanda (apenas quando o usuário tentar fazer ações)
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: true,
    isChecking: false,
    lastError: null,
  })
  const isMountedRef = useRef(true)
  const isCheckingRef = useRef(false)

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!isMountedRef.current) return true

    // Evitar múltiplas verificações simultâneas
    if (isCheckingRef.current) {
      return status.isOnline
    }

    isCheckingRef.current = true
    setStatus(prev => ({ ...prev, isChecking: true }))

    try {
      // Tentar fazer uma requisição simples para verificar conexão
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
      const baseURL = API_BASE_URL.replace(/\/api$/, '')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 segundos de timeout

      const response = await fetch(`${baseURL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Conexão OK
      if (!isMountedRef.current) return true

      isCheckingRef.current = false
      setStatus({
        isOnline: true,
        isChecking: false,
        lastError: null,
      })

      return true

    } catch (error: any) {
      if (!isMountedRef.current) return false

      isCheckingRef.current = false
      setStatus({
        isOnline: false,
        isChecking: false,
        lastError: error instanceof Error ? error : new Error(error?.message || 'Erro de conexão'),
      })

      return false
    }
  }, [status.isOnline])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
      }
    }
  }, [])

  return {
    ...status,
    checkConnection,
  }
}

