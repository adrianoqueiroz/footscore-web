import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User, Bell, BellOff } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface UserMenuProps {
  userName: string
  userAvatar?: string | null
  onLogout: () => void
  onEditProfile: () => void
}

export default function UserMenu({ userName, userAvatar, onLogout, onEditProfile }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [currentAvatar, setCurrentAvatar] = useState<string | null | undefined>(userAvatar)
  const menuRef = useRef<HTMLDivElement>(null)

  // Push notifications
  const { subscribe: subscribePush, unsubscribe: unsubscribePush, isSubscribed: isPushSubscribed, isSupported: pushSupported, permission: pushPermission } = usePushNotifications()


  // Pega as iniciais do nome
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')

  // Resetar erro quando avatar mudar
  useEffect(() => {
    setAvatarError(false)
    setCurrentAvatar(userAvatar)
  }, [userAvatar])

  // Tentar atualizar avatar do servidor quando der erro
  const handleAvatarError = async () => {
    console.warn('[UserMenu] Erro ao carregar avatar, tentando atualizar do servidor')
    setAvatarError(true)
    
    // Tentar buscar dados atualizados do servidor
    try {
      const updatedUser = await authService.refreshUser()
      if (updatedUser?.avatar && updatedUser.avatar !== currentAvatar) {
        console.log('[UserMenu] Avatar atualizado do servidor')
        setCurrentAvatar(updatedUser.avatar)
        setAvatarError(false)
      }
    } catch (error) {
      console.error('[UserMenu] Erro ao atualizar avatar do servidor:', error)
    }
  }

  // Fecha menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = () => {
    setIsOpen(false)
    onLogout()
  }

  const handleEditProfile = () => {
    setIsOpen(false)
    onEditProfile()
  }

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all overflow-hidden ${
          currentAvatar && !avatarError
            ? 'border-2 border-primary shadow-sm hover:border-primary/90' 
            : 'bg-gradient-to-br from-primary/30 to-primary/20 text-primary hover:from-primary/40 hover:to-primary/30'
        }`}
        whileTap={{ scale: 0.95 }}
      >
        {currentAvatar && !avatarError ? (
          <>
            <img 
              src={currentAvatar} 
              alt={userName}
              className="h-full w-full object-cover rounded-full"
              onError={handleAvatarError}
              loading="lazy"
            />
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
          </>
        ) : (
          initials || 'U'
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg z-50"
          >
            {/* Header do Menu */}
            <div className="border-b border-border p-3">
              <p className="text-xs text-muted-foreground">Conectado como</p>
              <p className="font-semibold truncate">{userName}</p>
            </div>

            {/* Opções do Menu */}
            <div className="space-y-1 p-2">
              <motion.button
                onClick={handleEditProfile}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors"
                whileHover={{ x: 4 }}
              >
                <User className="h-4 w-4" />
                <span>Detalhes da Conta</span>
              </motion.button>

              {/* Push Notifications */}
              {console.log('[UserMenu] Renderizando botão push:', { pushSupported, isPushSubscribed }) || pushSupported && (
                <motion.button
                  onClick={async () => {
                    console.log('[UserMenu] Botão clicado!')
                    setIsOpen(false)

                    try {
                      if (isPushSubscribed) {
                        console.log('[UserMenu] Desativando...')
                        const success = await unsubscribePush()
                        console.log('[UserMenu] Desativação result:', success)
                        if (success) {
                          alert('✅ Notificações desativadas!')
                        } else {
                          alert('❌ Erro ao desativar notificações')
                        }
                      } else {
                        console.log('[UserMenu] Ativando...')
                        console.log('[UserMenu] Permissão atual:', Notification.permission)

                        // Verificar permissão primeiro
                        if (Notification.permission === 'denied') {
                          alert('Permissão negada. Vá nas configurações do navegador para permitir notificações.')
                          return
                        }

                        console.log('[UserMenu] Chamando subscribePush...')
                        const success = await subscribePush()
                        console.log('[UserMenu] subscribePush result:', success)

                        if (success) {
                          alert('✅ Notificações ativadas com sucesso!')
                        } else {
                          alert('❌ Falha ao ativar notificações. Verifique o console (F12) para mais detalhes.')
                        }
                      }
                    } catch (error) {
                      console.error('[UserMenu] Erro no botão:', error)
                      alert('❌ Erro interno: ' + error.message)
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors"
                  whileHover={{ x: 4 }}
                >
                  {isPushSubscribed ? (
                    <>
                      <BellOff className="h-4 w-4 text-orange-500" />
                      <span className="text-orange-500">Desativar Notificações</span>
                    </>
                  ) : (
                    <>
                      <Bell className="h-4 w-4 text-green-500" />
                      <span className="text-green-500">Ativar Notificações</span>
                    </>
                  )}
                </motion.button>
              )}

              {/* Debug Info */}
              <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border">
                Push: {pushSupported ? '✅' : '❌'} | Perm: {pushPermission} | Sub: {isPushSubscribed ? '✅' : '❌'}
                <div className="flex gap-1 mt-1">
                  <button
                    onClick={() => {
                      console.log('=== DEBUG INFO ===')
                      console.log('Supported:', pushSupported)
                      console.log('Permission:', pushPermission)
                      console.log('Subscribed:', isPushSubscribed)
                      console.log('SW:', !!navigator.serviceWorker)
                      console.log('PushManager:', !!window.PushManager)
                      console.log('Notification:', !!window.Notification)
                      console.log('Notification.permission:', Notification.permission)
                      alert('Verifique o console do navegador (F12)')
                    }}
                    className="text-blue-500 hover:text-blue-700 text-xs"
                  >
                    Debug
                  </button>
                  <button
                    onClick={async () => {
                      console.log('=== DIAGNÓSTICO COMPLETO ===')

                      // Verificar permissões básicas
                      console.log('🔔 Permissões:', {
                        notification: Notification.permission,
                        supported: 'Notification' in window,
                        serviceWorker: 'serviceWorker' in navigator
                      })

                      // Verificar service worker detalhado
                      if ('serviceWorker' in navigator) {
                        try {
                          const registration = await navigator.serviceWorker.ready
                          console.log('👷 Service Worker detalhado:', {
                            active: !!registration.active,
                            installing: !!registration.installing,
                            waiting: !!registration.waiting,
                            scope: registration.scope,
                            updateViaCache: registration.updateViaCache
                          })

                          // Testar notificação via Notification API
                          console.log('🔔 Testando Notification API direto...')
                          if (Notification.permission === 'granted') {
                            try {
                              const notification = new Notification('Teste Direto', {
                                body: 'Notificação direta da Notification API',
                                icon: '/vite.svg',
                                tag: 'direct-test'
                              })
                              console.log('✅ Notificação direta criada')
                            } catch (directError) {
                              console.error('❌ Erro na notificação direta:', directError)
                            }
                          } else {
                            console.log('❌ Permissão de notificação não concedida')
                          }

                          // Testar notificação via Service Worker
                          console.log('🔔 Testando notificação via SW...')
                          try {
                            await registration.showNotification('Teste SW', {
                              body: 'Notificação via Service Worker',
                              icon: '/vite.svg',
                              tag: 'sw-test'
                            })
                            console.log('✅ Notificação SW enviada')
                          } catch (swError) {
                            console.error('❌ Erro na notificação SW:', swError)
                          }

                        } catch (swError) {
                          console.error('❌ Erro no service worker:', swError)
                        }
                      } else {
                        console.log('❌ Service Worker não suportado')
                      }

                      // Verificar autenticação
                      const authToken = localStorage.getItem('auth_token')
                      const userData = localStorage.getItem('bolao_user')

                      console.log('🔐 Token JWT existe:', !!authToken)
                      console.log('👤 Usuário logado:', !!userData)

                      if (userData) {
                        try {
                          const user = JSON.parse(userData)
                          console.log('👤 User ID:', user.id)
                          console.log('📧 User email:', user.email)
                        } catch (e) {
                          console.log('❌ Erro ao parsear dados do usuário')
                        }
                      }

                      if (Notification.permission === 'denied') {
                        alert('Permissão negada. Vá nas configurações do navegador para reverter.')
                        return
                      }

                      try {
                        // Testar API VAPID
                        console.log('🔑 Testando API VAPID...')
                        const vapidResponse = await fetch('http://localhost:3000/api/notifications/vapid-key')
                        const vapidData = await vapidResponse.json()
                        console.log('🔑 VAPID API:', vapidResponse.ok ? '✅ OK' : '❌ Falhou')

                        if (vapidResponse.ok) {
                          // Testar subscribe
                          console.log('📡 Testando PushManager.subscribe...')
                          try {
                            const reg = await navigator.serviceWorker.ready
                            console.log('📡 SW ready, obtendo registration...')

                            // Verificar se já existe uma subscription
                            const existingSub = await reg.pushManager.getSubscription()
                            if (existingSub) {
                              console.log('📡 Já existe subscription, cancelando...')
                              await existingSub.unsubscribe()
                              console.log('📡 Subscription antiga cancelada')
                            }

                            console.log('📡 Fazendo nova subscription...')
                            console.log('📡 VAPID key length:', vapidData.publicKey.length)
                            console.log('📡 VAPID key starts with:', vapidData.publicKey.substring(0, 20))

                            // Criar timeout para o subscribe
                            const subscribePromise = reg.pushManager.subscribe({
                              userVisibleOnly: true,
                              applicationServerKey: Uint8Array.from(atob(vapidData.publicKey), c => c.charCodeAt(0))
                            })

                            const timeoutPromise = new Promise((_, reject) => {
                              setTimeout(() => reject(new Error('Subscribe timeout')), 10000)
                            })

                            let sub;
                            try {
                              sub = await Promise.race([subscribePromise, timeoutPromise])
                              console.log('📡 Subscribe result:', !!sub ? '✅ Sucesso' : '❌ Falhou')
                              console.log('📡 Subscription type:', typeof sub)
                              console.log('📡 Subscription keys:', sub ? 'disponíveis' : 'null')

                              if (sub) {
                                console.log('📡 Endpoint:', sub.endpoint.substring(0, 50) + '...')
                                console.log('📡 Keys disponíveis:', !!sub.getKey('p256dh'), !!sub.getKey('auth'))

                                // Testar registro no backend
                                console.log('🔄 Testando registro no backend...')
                                const p256dhKey = sub.getKey('p256dh')
                                const authKey = sub.getKey('auth')

                                if (!p256dhKey || !authKey) {
                                  console.log('🔄 ERRO: Keys não disponíveis na subscription')
                                  return
                                }

                                const registerResponse = await fetch('http://localhost:3000/api/notifications/subscribe', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                                  },
                                  body: JSON.stringify({
                                    endpoint: sub.endpoint,
                                    keys: {
                                      p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dhKey))),
                                      auth: btoa(String.fromCharCode(...new Uint8Array(authKey)))
                                    }
                                  })
                                })

                                console.log('🔄 Backend status:', registerResponse.status)
                                if (registerResponse.ok) {
                                  const result = await registerResponse.json()
                                  console.log('🔄 Backend result:', result)
                                  console.log('🎉 SUCESSO COMPLETO! Push notifications configuradas.')
                                } else {
                                  const error = await registerResponse.json()
                                  console.log('🔄 Backend error:', error)
                                }
                              }
                            } catch (innerError) {
                              console.error('📡 ERRO no subscribe interno:', innerError)
                              console.error('📡 Detalhes:', innerError.message)
                            }
                          } catch (subscribeError) {
                            console.error('📡 ERRO no PushManager.subscribe:', subscribeError)
                            console.error('📡 Detalhes:', subscribeError.message)
                          }
                        }
                      } catch (error) {
                        console.error('💥 Erro completo:', error)
                      }
                      alert('Diagnóstico concluído - verifique console (F12)')
                    }}
                    className="text-green-500 hover:text-green-700 text-xs"
                  >
                    Teste
                  </button>
                </div>
              </div>

              <div className="border-t border-border my-1"></div>

              <motion.button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                whileHover={{ x: 4 }}
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
