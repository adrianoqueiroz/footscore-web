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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      const hasSubscription = !!subscription
      setIsSubscribed(hasSubscription)
      return hasSubscription
    } catch (error) {
      console.error('[PushNotifications] Erro ao verificar subscription:', error)
      setIsSubscribed(false)
      return false
    }
  }, [])

  // Verificar suporte, permissão e estado inicial da subscription
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)

      // Verificar estado atual da subscription
      checkSubscriptionStatus()

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