import { useState, useEffect, useCallback } from 'react'
import { apiService } from '@/services/api.service'

interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Helpers para detecção de dispositivo
const getDeviceInfo = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  
  return { isIOS, isPWA, isSafari }
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Função para verificar o estado atual da subscription
  const checkSubscriptionStatus = useCallback(async () => {
    const { isIOS, isPWA } = getDeviceInfo()

    if (!('serviceWorker' in navigator)) {
      console.log('[PushNotifications] ServiceWorker not available')
      return false
    }

    // Verificar se tem PushManager
    if (!('PushManager' in window)) {
      console.log('[PushNotifications] PushManager not available')
      // No iOS PWA, pode ter suporte mesmo sem PushManager detectável inicialmente
      if (isIOS && isPWA) {
        console.log('[PushNotifications] iOS PWA - will try registration later')
        return false
      }
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
    } catch (error: any) {
      console.error('[PushNotifications] Status check error:', error.message)
      setIsSubscribed(false)
      return false
    }
  }, [])

  // Verificar suporte, permissão e estado inicial da subscription
  useEffect(() => {
    const { isIOS, isPWA, isSafari } = getDeviceInfo()

    // Verificar suporte básico
    const hasServiceWorker = 'serviceWorker' in navigator
    const hasPushManager = 'PushManager' in window
    const hasNotificationAPI = 'Notification' in window
    
    // iOS 16.4+ PWA suporta Web Push mesmo que PushManager não seja detectado imediatamente
    // Safari Mac também suporta
    const shouldSupport = hasServiceWorker && hasNotificationAPI && (hasPushManager || (isIOS && isPWA))

    console.log('[PushNotifications] Device detection:', {
      userAgent: navigator.userAgent.substring(0, 60) + '...',
      isIOS,
      isPWA,
      isSafari,
      hasServiceWorker,
      hasPushManager,
      hasNotificationAPI,
      shouldSupport,
      currentPermission: hasNotificationAPI ? Notification.permission : 'N/A'
    })

    if (shouldSupport) {
      const initializePushSupport = async () => {
        try {
          const registration = await navigator.serviceWorker.ready
          const hasPushManagerInReg = !!registration.pushManager

          console.log('[PushNotifications] Service worker ready, PushManager in registration:', hasPushManagerInReg)

          // Aceitar suporte se tiver PushManager ou se for iOS PWA (que pode ter suporte tardio)
          if (hasPushManagerInReg || (isIOS && isPWA)) {
            setIsSupported(true)
            // Ler permissão atual
            if ('Notification' in window) {
              setPermission(Notification.permission)
            }
            // Verificar estado atual da subscription
            await checkSubscriptionStatus()
          } else {
            console.log('[PushNotifications] PushManager not available')
            setIsSupported(false)
          }
        } catch (error) {
          console.error('[PushNotifications] Error initializing push support:', error)
          // Para iOS PWA, ainda tentar habilitar suporte
          if (isIOS && isPWA) {
            console.log('[PushNotifications] iOS PWA - enabling support despite error')
            setIsSupported(true)
            if ('Notification' in window) {
              setPermission(Notification.permission)
            }
          } else {
            setIsSupported(false)
          }
        }
      }

      initializePushSupport()

      // Listener para mudanças na permissão
      const permissionCheckInterval = setInterval(() => {
        if ('Notification' in window && Notification.permission !== permission) {
          console.log('[PushNotifications] Permission changed:', Notification.permission)
          setPermission(Notification.permission)
          if (Notification.permission === 'granted') {
            checkSubscriptionStatus()
          } else if (Notification.permission === 'denied') {
            setIsSubscribed(false)
          }
        }
      }, 2000)

      return () => {
        clearInterval(permissionCheckInterval)
      }
    } else {
      console.log('[PushNotifications] Push notifications not supported on this device')
      setIsSupported(false)
    }
  }, [checkSubscriptionStatus, permission])

  // Solicitar permissão de notificações
  // IMPORTANTE: Esta função DEVE ser chamada em resposta direta a uma ação do usuário (click)
  const requestPermission = async (): Promise<boolean> => {
    console.log('[PushNotifications] 🔔 Requesting permission...')
    
    if (!('Notification' in window)) {
      console.warn('[PushNotifications] Notification API not available')
      return false
    }

    // Ler permissão atual diretamente (não confiar em estado cacheado)
    const currentPermission = Notification.permission
    console.log('[PushNotifications] Current permission state:', currentPermission)

    // Se já está granted, não precisa solicitar novamente
    if (currentPermission === 'granted') {
      console.log('[PushNotifications] Permission already granted')
      setPermission('granted')
      return true
    }

    // Se está denied, o usuário precisa ir nas configurações
    // MAS no iOS, vamos tentar solicitar mesmo assim pois o estado pode estar incorreto
    const { isIOS, isPWA } = getDeviceInfo()
    
    if (currentPermission === 'denied' && !(isIOS && isPWA)) {
      console.log('[PushNotifications] Permission was denied by user')
      setPermission('denied')
      return false
    }

    try {
      console.log('[PushNotifications] 📱 Calling Notification.requestPermission()...')
      
      // Usar a versão com callback para máxima compatibilidade
      const result = await new Promise<NotificationPermission>((resolve) => {
        const permissionPromise = Notification.requestPermission((result) => {
          resolve(result)
        })
        // Se retornar uma Promise (navegadores modernos), usar ela
        if (permissionPromise && typeof permissionPromise.then === 'function') {
          permissionPromise.then(resolve)
        }
      })
      
      console.log('[PushNotifications] Permission result:', result)
      setPermission(result)
      
      // Se permissão foi concedida, verificar se já existe subscription
      if (result === 'granted') {
        await checkSubscriptionStatus()
      }
      
      return result === 'granted'
    } catch (error: any) {
      console.error('[PushNotifications] Error requesting permission:', error)
      // Tentar ler o estado atual após o erro
      if ('Notification' in window) {
        const newPermission = Notification.permission
        setPermission(newPermission)
        return newPermission === 'granted'
      }
      return false
    }
  }

  // Inscrever para push notifications
  // IMPORTANTE: Esta função DEVE ser chamada em resposta direta a uma ação do usuário (click)
  const subscribe = async (): Promise<boolean> => {
    console.log('[PushNotifications] 🚀 Starting subscribe process...')
    
    const { isIOS, isPWA } = getDeviceInfo()
    console.log('[PushNotifications] Device info:', { isIOS, isPWA })

    // Verificar se Notification API está disponível
    if (!('Notification' in window)) {
      console.error('[PushNotifications] Notification API not available')
      return false
    }

    // Verificar permissão atual DIRETAMENTE
    let currentPermission = Notification.permission
    console.log('[PushNotifications] Current permission before subscribe:', currentPermission)

    // Se não está granted, precisamos solicitar permissão PRIMEIRO
    // IMPORTANTE para iOS: A solicitação DEVE acontecer DIRETAMENTE em resposta ao click
    if (currentPermission !== 'granted') {
      console.log('[PushNotifications] Permission not granted, requesting...')
      
      try {
        // Para iOS, usar a forma mais simples possível
        // NÃO usar Promise wrapper, chamar diretamente
        console.log('[PushNotifications] 📱 Calling Notification.requestPermission() directly...')
        
        // Tentar a forma moderna primeiro (Promise)
        if (typeof Notification.requestPermission === 'function') {
          const result = Notification.requestPermission()
          
          // Se retornou uma Promise (navegadores modernos)
          if (result && typeof result.then === 'function') {
            currentPermission = await result
          } else if (typeof result === 'string') {
            // Alguns navegadores retornam diretamente
            currentPermission = result as NotificationPermission
          }
        }
        
        console.log('[PushNotifications] Permission after request:', currentPermission)
        setPermission(currentPermission)
        
        // Re-verificar permissão do navegador (pode ter mudado)
        const finalPermission = Notification.permission
        console.log('[PushNotifications] Final browser permission:', finalPermission)
        
        if (finalPermission !== 'granted') {
          console.log('[PushNotifications] Permission still not granted')
          // No iOS, mesmo que apareça denied, vamos tentar continuar se for PWA
          if (!(isIOS && isPWA)) {
            return false
          }
          console.log('[PushNotifications] iOS PWA - continuing despite permission state...')
        }
        
        currentPermission = finalPermission
      } catch (error: any) {
        console.error('[PushNotifications] Error requesting permission:', error.message || error)
        // No iOS PWA, tentar continuar mesmo com erro
        if (isIOS && isPWA) {
          console.log('[PushNotifications] iOS PWA - attempting to continue despite error...')
          currentPermission = Notification.permission
        } else {
          return false
        }
      }
    }

    setIsLoading(true)
    try {
      // Verificar se service worker está disponível
      if (!('serviceWorker' in navigator)) {
        console.error('[PushNotifications] ServiceWorker not available')
        return false
      }

      console.log('[PushNotifications] Waiting for service worker ready...')
      const registration = await navigator.serviceWorker.ready
      console.log('[PushNotifications] Service worker ready, scope:', registration.scope)

      // Verificar se o PushManager está disponível
      if (!registration.pushManager) {
        console.error('[PushNotifications] PushManager not available in registration')
        // No iOS PWA, tentar registrar novamente o SW
        if (isIOS && isPWA) {
          console.log('[PushNotifications] iOS PWA - trying to re-register SW...')
          try {
            await navigator.serviceWorker.register('/sw.js', { scope: '/' })
            await new Promise(resolve => setTimeout(resolve, 1000))
            const newReg = await navigator.serviceWorker.ready
            if (!newReg.pushManager) {
              console.error('[PushNotifications] Still no PushManager after re-register')
              return false
            }
          } catch (regError) {
            console.error('[PushNotifications] Re-register failed:', regError)
            return false
          }
        } else {
          return false
        }
      }

      // Verificar se já existe uma subscription
      console.log('[PushNotifications] Checking for existing subscription...')
      const existingSubscription = await registration.pushManager.getSubscription()
      
      if (existingSubscription) {
        console.log('[PushNotifications] ✅ Subscription already exists, syncing with backend...')
        return await syncSubscriptionWithBackend(existingSubscription)
      }

      // Obter VAPID key do backend
      console.log('[PushNotifications] 🔑 Getting VAPID key from backend...')
      const { publicKey } = await apiService.get<{ publicKey: string }>('/notifications/vapid-key')
      console.log('[PushNotifications] VAPID key received, length:', publicKey.length)
      
      // Converter VAPID key para Uint8Array
      const applicationServerKey = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0))

      // Criar nova subscription
      console.log('[PushNotifications] Creating new push subscription...')
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      })

      if (subscription) {
        console.log('[PushNotifications] ✅ Subscription created successfully!')
        console.log('[PushNotifications] Endpoint:', subscription.endpoint.substring(0, 50) + '...')
        return await syncSubscriptionWithBackend(subscription)
      }

      console.error('[PushNotifications] Subscription creation returned null')
      return false
    } catch (error: any) {
      console.error('[PushNotifications] ❌ Subscribe error:', error.message || error)
      
      // Erros comuns e suas causas
      if (error.message?.includes('denied')) {
        console.log('[PushNotifications] Permission was denied')
        setPermission('denied')
      } else if (error.message?.includes('registration')) {
        console.log('[PushNotifications] Service worker registration issue')
      }

      // Verificar se há subscription existente apesar do erro
      try {
        const hasSubscription = await checkSubscriptionStatus()
        if (hasSubscription) {
          console.log('[PushNotifications] Found existing subscription despite error')
          return true
        }
      } catch (e) {
        // Ignorar
      }

      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Função auxiliar para sincronizar subscription com o backend
  const syncSubscriptionWithBackend = async (subscription: PushSubscription): Promise<boolean> => {
    try {
      const p256dhKey = subscription.getKey('p256dh')
      const authKey = subscription.getKey('auth')

      if (!p256dhKey || !authKey) {
        console.error('[PushNotifications] Missing subscription keys')
        return false
      }

      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
          auth: btoa(String.fromCharCode(...new Uint8Array(authKey))),
        },
      }

      console.log('[PushNotifications] 📤 Sending subscription to backend...')
      await apiService.post('/notifications/subscribe', subscriptionData)
      console.log('[PushNotifications] ✅ Backend subscription saved')
      
      setIsSubscribed(true)
      return true
    } catch (error: any) {
      console.error('[PushNotifications] ❌ Backend sync error:', error.message || error)
      // Mesmo com erro no backend, a subscription local existe
      // Vamos marcar como subscribed para o usuário poder usar
      setIsSubscribed(true)
      return true
    }
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