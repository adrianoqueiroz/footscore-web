import { useState, useEffect, useCallback } from 'react'

interface AvatarCacheHook {
  avatarUrl: string | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Cache simples para armazenar URLs de avatar em base64
const avatarCache = new Map<string, string>()
const CACHE_KEY = 'avatar_cache'

// Função para inicializar o cache do localStorage (chamada uma vez)
let cacheInitialized = false
function initializeCache() {
  if (cacheInitialized) return
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsedCache = JSON.parse(cached)
      Object.entries(parsedCache).forEach(([key, value]) => {
        avatarCache.set(key, value as string)
      })
    }
    cacheInitialized = true
  } catch (error) {
    console.warn('Failed to load avatar cache from localStorage:', error)
  }
}

// Inicializar cache imediatamente
initializeCache()

export function useAvatarCache(originalUrl: string | null | undefined): AvatarCacheHook {
  // Inicializar avatarUrl diretamente do cache se disponível
  const getInitialAvatarUrl = (): string | null => {
    if (!originalUrl) return null
    // Verificar se já está no cache (após inicialização)
    if (avatarCache.has(originalUrl)) {
      return avatarCache.get(originalUrl)!
    }
    return null
  }

  const [avatarUrl, setAvatarUrl] = useState<string | null>(getInitialAvatarUrl())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Salvar cache no localStorage
  const saveCache = useCallback(() => {
    try {
      const cacheObject = Object.fromEntries(avatarCache.entries())
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject))
    } catch (error) {
      console.warn('Failed to save avatar cache to localStorage:', error)
    }
  }, [])

  // Função para converter imagem para base64
  const convertToBase64 = useCallback(async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors', // Tentar CORS primeiro
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      // Se falhar por CORS ou outros motivos, não tentar novamente
      throw new Error(`Failed to convert image to base64: ${error}`)
    }
  }, [])

  // Função para fazer cache da imagem
  const cacheAvatar = useCallback(async (url: string): Promise<string> => {
    // Verificar se já está no cache
    if (avatarCache.has(url)) {
      return avatarCache.get(url)!
    }

    setIsLoading(true)
    setError(null)

    try {
      const base64Data = await convertToBase64(url)

      // Armazenar no cache
      avatarCache.set(url, base64Data)
      saveCache()

      return base64Data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [convertToBase64, saveCache])

  // Carregar avatar quando a URL original muda
  useEffect(() => {
    if (!originalUrl) {
      setAvatarUrl(null)
      setError(null)
      setIsLoading(false)
      return
    }

    // Verificar cache primeiro (síncrono, sem delay)
    if (avatarCache.has(originalUrl)) {
      const cached = avatarCache.get(originalUrl)!
      // Só atualizar se for diferente do estado atual
      if (avatarUrl !== cached) {
        setAvatarUrl(cached)
        setError(null)
        setIsLoading(false)
      }
      return
    }

    // Se não está no cache, tentar fazer cache (assíncrono)
    // Mas primeiro, se já temos a URL original no estado, usar ela temporariamente
    if (avatarUrl !== originalUrl) {
      setAvatarUrl(originalUrl)
    }

    // Fazer cache em background
    let cancelled = false
    cacheAvatar(originalUrl)
      .then((cachedUrl) => {
        // Só atualizar se não foi cancelado (URL não mudou)
        if (!cancelled) {
          setAvatarUrl(cachedUrl)
          setError(null)
        }
      })
      .catch((error) => {
        // Para erros de CORS ou rede, manter a URL original
        // Não definir como erro para não mostrar mensagens de erro desnecessárias
        if (!cancelled) {
          console.warn('Failed to cache avatar (using original URL):', error)
          setAvatarUrl(originalUrl)
          setError(null)
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [originalUrl, cacheAvatar])

  // Função para forçar refresh do cache
  const refresh = useCallback(async () => {
    if (!originalUrl) return

    setIsLoading(true)
    setError(null)

    try {
      // Remover do cache para forçar recarregamento
      avatarCache.delete(originalUrl)
      saveCache()

      const cachedUrl = await cacheAvatar(originalUrl)
      setAvatarUrl(cachedUrl)
      setError(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh avatar'
      setError(errorMessage)
      // Fallback para URL original
      setAvatarUrl(originalUrl)
    } finally {
      setIsLoading(false)
    }
  }, [originalUrl, cacheAvatar, saveCache])

  return {
    avatarUrl,
    isLoading,
    error,
    refresh,
  }
}