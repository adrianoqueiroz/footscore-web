import { useToastContext } from '@/contexts/ToastContext'
import { API_BASE_URL } from '@/config/api'

// Função para verificar conexão com o servidor
export async function checkServerConnection(): Promise<boolean> {
  try {
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

    return response.ok
  } catch (error) {
    return false
  }
}

// Hook para mostrar erro de conexão
export function useConnectionError() {
  const toast = useToastContext()

  const showConnectionError = () => {
    toast.error(
      'Erro de conexão com o servidor. Verifique sua internet e tente novamente.',
      5000
    )
  }

  return { showConnectionError }
}

// Função utilitária para tentar uma ação com tratamento de erro de conexão
export async function withConnectionError<T>(
  action: () => Promise<T>,
  onConnectionError?: () => void
): Promise<T | null> {
  try {
    return await action()
  } catch (error: any) {
    // Verificar se é erro de conexão
    if (
      error?.status === 0 ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      error?.name === 'TypeError' ||
      error?.message?.includes('Erro de conexão')
    ) {
      if (onConnectionError) {
        onConnectionError()
      }
      return null
    }

    // Se não for erro de conexão, relançar o erro
    throw error
  }
}