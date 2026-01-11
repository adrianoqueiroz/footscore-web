import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User, Bell, BellOff } from 'lucide-react'
import { authService } from '@/services/auth.service'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useAvatarCache } from '@/hooks/useAvatarCache'

interface UserMenuProps {
  userName: string
  userAvatar?: string | null
  onLogout: () => void
  onEditProfile: () => void
}

export default function UserMenu({ userName, userAvatar, onLogout, onEditProfile }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Usar hook de cache para avatar
  const { avatarUrl: cachedAvatar, isLoading: avatarLoading, error: avatarError, refresh: refreshAvatar } = useAvatarCache(userAvatar)

  // Push notifications
  const { 
    subscribe: subscribePush, 
    unsubscribe: unsubscribePush, 
    isSubscribed: isPushSubscribed, 
    isSupported: pushSupported, 
    permission: pushPermission,
    isLoading: pushLoading,
    requestPermission: requestPushPermission
  } = usePushNotifications()


  // Pega as iniciais do nome
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')

  // Tentar atualizar avatar do servidor quando der erro
  const handleAvatarError = async () => {
    console.warn('[UserMenu] Erro ao carregar avatar, tentando atualizar do servidor')

    // Tentar buscar dados atualizados do servidor
    try {
      const updatedUser = await authService.refreshUser()
      if (updatedUser?.avatar && updatedUser.avatar !== userAvatar) {
        // O hook será atualizado automaticamente quando userAvatar mudar
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
          cachedAvatar && !avatarError
            ? 'border-2 border-primary shadow-sm hover:border-primary/90'
            : 'bg-gradient-to-br from-primary/30 to-primary/20 text-primary hover:from-primary/40 hover:to-primary/30'
        }`}
        whileTap={{ scale: 0.95 }}
      >
        {cachedAvatar && !avatarError ? (
          <>
            <img
              src={cachedAvatar}
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
              {pushSupported && (
                <motion.button
                  onClick={async () => {
                    setIsOpen(false)

                    try {
                      if (isPushSubscribed) {
                        // Desativar notificações
                        const success = await unsubscribePush()
                        if (!success) {
                          console.error('[UserMenu] Falha ao desativar notificações')
                        }
                      } else {
                        // Ativar notificações
                        // Verificar permissão primeiro
                        if (pushPermission === 'denied') {
                          alert('Permissão negada. Vá nas configurações do navegador para permitir notificações.')
                          return
                        }

                        // Se permissão não foi concedida, solicitar
                        if (pushPermission !== 'granted') {
                          const granted = await requestPushPermission()
                          if (!granted) {
                            return
                          }
                        }

                        // Fazer subscribe
                        const success = await subscribePush()
                        if (!success) {
                          console.error('[UserMenu] Falha ao ativar notificações')
                        }
                      }
                    } catch (error: any) {
                      console.error('[UserMenu] Erro ao gerenciar notificações:', error)
                      alert('❌ Erro: ' + (error?.message || 'Erro desconhecido'))
                    }
                  }}
                  disabled={pushLoading}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ x: 4 }}
                >
                  {pushLoading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Processando...</span>
                    </>
                  ) : isPushSubscribed ? (
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
