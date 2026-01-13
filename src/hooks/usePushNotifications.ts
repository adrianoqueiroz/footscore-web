import { useState, useEffect, useCallback } from 'react'
import { apiService } from '@/services/api.service'

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Função para verificar o estado atual da subscription
  const checkSubscriptionStatus = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      return false
    }

    // Verificar se é iOS (que pode ter PushManager disponível apenas após registro do SW)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    // Se não tem PushManager e não é iOS, não há suporte
    if (!('PushManager' in window) && !isIOS) {
      console.log('[PushNotifications] PushManager not available and not iOS')
      return false
    }

    try {
      console.log('[PushNotifications] 🔍 Checking subscription status...')
      const registration = await navigator.serviceWorker.ready

      // Verificar se PushManager está disponível no registration
      if (!registration.pushManager) {
        console.log('[PushNotifications] PushManager not available in registration')
        return false
      }

      const subscription = await registration.pushManager.getSubscription()
      const hasSubscription = !!subscription

      console.log('[PushNotifications] 📊 Subscription status:', hasSubscription ? 'YES' : 'NO')
      if (subscription) {
        console.log('[PushNotifications] 📡 Endpoint:', subscription.endpoint.substring(0, 40) + '...')
      }

      setIsSubscribed(hasSubscription)
      return hasSubscription
    } catch (error) {
      console.error('[PushNotifications] Status check error:', error.message)
      setIsSubscribed(false)
      return false
    }
  }, [])

  // Verificar suporte, permissão e estado inicial da subscription
  useEffect(() => {
    // Verificar se é iOS Safari (que tem suporte limitado mas ainda funciona)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    // Para iOS, ser mais permissivo - se tem service worker, assumir que pode ter suporte
    const hasBasicSupport = 'serviceWorker' in navigator
    const hasFullSupport = 'PushManager' in window
    const shouldSupport = hasBasicSupport && (hasFullSupport || isIOS)

    console.log('[PushNotifications] Device detection:', {
      userAgent: navigator.userAgent.substring(0, 50) + '...',
      isIOS,
      hasBasicSupport,
      hasFullSupport,
      shouldSupport
    })

    if (shouldSupport) {
      // Para iOS, pode ser que o PushManager não esteja disponível imediatamente
      // Vamos tentar verificar se fica disponível após o service worker estar pronto
      const initializePushSupport = async () => {
        try {
          const registration = await navigator.serviceWorker.ready
          const hasPushManager = !!registration.pushManager

          console.log('[PushNotifications] Service worker ready, PushManager available:', hasPushManager)

          if (hasPushManager || isIOS) {
            setIsSupported(true)
            setPermission(Notification.permission)

            // Verificar estado atual da subscription
            checkSubscriptionStatus()
          } else {
            console.log('[PushNotifications] PushManager not available even after SW ready')
            setIsSupported(false)
          }
        } catch (error) {
          console.error('[PushNotifications] Error initializing push support:', error)
          setIsSupported(false)
        }
      }

      initializePushSupport()

      // Adicionar listener para mensagens do service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PushNotifications] Mensagem do SW:', event.data)
      })

      // Listener para mudanças na permissão (quando usuário muda nas configurações do navegador)
      const handlePermissionChange = () => {
        setPermission(Notification.permission)
        if (Notification.permission !== 'granted') {
          setIsSubscribed(false)
        } else {
          checkSubscriptionStatus()
        }
      }

      // Verificar mudanças de permissão periodicamente (não há evento direto)
      const permissionCheckInterval = setInterval(() => {
        if (Notification.permission !== permission) {
          handlePermissionChange()
        }
      }, 1000)

      return () => {
        clearInterval(permissionCheckInterval)
      }
    } else {
      console.log('[PushNotifications] Push notifications not supported on this device')
      setIsSupported(false)
    }
  }, [checkSubscriptionStatus, permission])

  // Solicitar permissão de notificações
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[PushNotifications] Push não suportado neste navegador')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      
      // Se permissão foi concedida, verificar se já existe subscription
      if (result === 'granted') {
        await checkSubscriptionStatus()
      }
      
      return result === 'granted'
    } catch (error) {
      console.error('[PushNotifications] Erro ao solicitar permissão:', error)
      return false
    }
  }

  // Inscrever para push notifications
  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[PushNotifications] Push não suportado')
      return false
    }

    // Verificar permissão atual
    const currentPermission = Notification.permission
    if (currentPermission !== 'granted') {
      console.warn('[PushNotifications] Permissão não concedida:', currentPermission)
      setPermission(currentPermission)

      // Se for 'default', tentar solicitar permissão
      if (currentPermission === 'default') {
        const granted = await requestPermission()
        if (!granted) {
          return false
        }
      } else {
        return false
      }
    }

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      console.log('[PushNotifications] Fazendo subscribe...')

      // Verificar se o PushManager está disponível (pode não estar em alguns dispositivos iOS)
      if (!registration.pushManager) {
        console.warn('[PushNotifications] PushManager não disponível neste dispositivo')
        setIsLoading(false)
        return false
      }

      // Verificar se já existe uma subscription
      const existingSubscription = await registration.pushManager.getSubscription()
      if (existingSubscription) {
        console.log('[PushNotifications] Subscription já existe, atualizando no backend...')

        // Atualizar no backend mesmo que já exista (pode ter mudado o usuário ou keys)
        const subscriptionData = {
          endpoint: existingSubscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(existingSubscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(existingSubscription.getKey('auth')!))),
          },
        }

        try {
          await apiService.post('/notifications/subscribe', subscriptionData)
          setIsSubscribed(true)
          return true
        } catch (error) {
          console.error('[PushNotifications] Erro ao atualizar subscription no backend:', error)
          // Mesmo com erro no backend, a subscription local existe
          setIsSubscribed(true)
          return true
        }
      }

      // Obter VAPID key do backend
      console.log('[PushNotifications] 🔑 Obtendo VAPID key...')
      const { publicKey } = await apiService.get<{ publicKey: string }>('/notifications/vapid-key')
      const applicationServerKey = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0))

      // Criar nova subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      })

      if (subscription) {
        console.log('[PushNotifications] Subscription criada com sucesso')

        const subscriptionData = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
          },
        }

        await apiService.post('/notifications/subscribe', subscriptionData)
        setIsSubscribed(true)
        return true
      }
    } catch (error: any) {
      console.error('[PushNotifications] Erro no subscribe:', error)

      // Se o erro for porque já existe subscription, verificar e atualizar estado
      if (error?.message?.includes('already subscribed') || error?.code === 0) {
        console.log('[PushNotifications] Tentando verificar subscription existente...')
        const hasSubscription = await checkSubscriptionStatus()
        return hasSubscription
      }
    } finally {
      setIsLoading(false)
    }
    return false
  }

  // Cancelar inscrição
  const unsubscribe = async (): Promise<boolean> => {
    if (!isSupported) {
      return false
    }

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready

      if (!registration.pushManager) {
        console.warn('[PushNotifications] PushManager não disponível para cancelar')
        setIsLoading(false)
        return false
      }

      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint

        // Desinscrever localmente primeiro
        const unsubscribed = await subscription.unsubscribe()

        if (unsubscribed) {
          console.log('[PushNotifications] Subscription cancelada localmente')

          // Tentar remover do backend (não bloquear se falhar)
          try {
            await apiService.post('/notifications/unsubscribe', { endpoint })
            console.log('[PushNotifications] Subscription removida do backend')
          } catch (error) {
            console.warn('[PushNotifications] Erro ao remover do backend (continuando):', error)
          }

          setIsSubscribed(false)
          return true
        } else {
          console.warn('[PushNotifications] Falha ao cancelar subscription localmente')
          return false
        }
      } else {
        // Não há subscription, mas atualizar estado mesmo assim
        console.log('[PushNotifications] Nenhuma subscription encontrada para cancelar')
        setIsSubscribed(false)
        return true
      }
    } catch (error) {
      console.error('[PushNotifications] Erro ao cancelar:', error)
      // Mesmo com erro, verificar estado atual
      await checkSubscriptionStatus()
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    requestPermission,
    subscribe,
    unsubscribe,
  }
}