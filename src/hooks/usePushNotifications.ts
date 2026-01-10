import { useState, useEffect } from 'react'
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

  // Verificar suporte e permissão
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      setPermission(Notification.permission)

      // Adicionar listener para mensagens do service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PushNotifications] Mensagem do SW:', event.data)
      })
    }
  }, [])

  // Solicitar permissão de notificações
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('[PushNotifications] Push não suportado neste navegador')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
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

    if (permission !== 'granted') {
      console.warn('[PushNotifications] Permissão não concedida')
      return false
    }

    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      console.log('[PushNotifications] Fazendo subscribe...')

      const { publicKey } = await apiService.get<{ publicKey: string }>('/notifications/vapid-key')
      const applicationServerKey = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0))

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      })

      if (subscription) {
        console.log('[PushNotifications] Subscription criada')

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
    } catch (error) {
      console.error('[PushNotifications] Erro:', error)
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

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await apiService.post('/notifications/unsubscribe', {
          endpoint: subscription.endpoint
        })
        setIsSubscribed(false)
        return true
      }
    } catch (error) {
      console.error('[PushNotifications] Erro ao cancelar:', error)
    }
    return false
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