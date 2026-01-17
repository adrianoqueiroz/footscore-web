import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Trash2, CheckCheck } from 'lucide-react'
import { useNotifications, NotificationItem } from '@/contexts/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [bellKey, setBellKey] = useState(0) // Para reiniciar a animação
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkIsMobile = () => {
      const width = window.innerWidth
      const isMobileDevice = width < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      setIsMobile(isMobileDevice)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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


  // Marcar todas como lidas ao abrir o dropdown (apenas visualmente, não remove)
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllAsRead()
    }
  }, [isOpen, unreadCount, markAllAsRead])

  // Reiniciar animação do sino quando há novas notificações
  const prevUnreadCountRef = useRef(unreadCount)
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current) {
      // Houve um aumento no contador, reiniciar animação
      setBellKey(prev => prev + 1)
    }
    prevUnreadCountRef.current = unreadCount
  }, [unreadCount])

  // Ordenar notificações: não lidas primeiro, depois por timestamp (mais recentes primeiro)
  const sortedNotifications = [...notifications].sort((a, b) => {
    if (a.read !== b.read) {
      return a.read ? 1 : -1
    }
    return b.timestamp - a.timestamp
  })

  const formatTime = (timestamp: number) => {
    try {
      return formatDistanceToNow(new Date(timestamp), {
        addSuffix: true,
        locale: ptBR
      })
    } catch {
      return 'agora'
    }
  }

  const getNotificationIcon = (notification: NotificationItem) => {
    if (notification.type === 'goal') {
      return notification.data?.isGoalCancelled ? '❌' : '⚽'
    }
    if (notification.type === 'round_finished') {
      return '🏆'
    }
    if (notification.type === 'match_status') {
      return '📊'
    }
    if (notification.type === 'round_bets_status') {
      return notification.data?.allowsNewBets ? '✅' : '🔒'
    }
    if (notification.type === 'ranking_winner') {
      return '🏆'
    }
    if (notification.type === 'ranking_top_n') {
      return '🎯'
    }
    return '🔔'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sininho */}
      <div className="relative">
        <motion.button
          key={bellKey} // Reinicia a animação quando bellKey muda
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 rounded-full hover:bg-secondary/50 transition-colors focus:outline-none focus:ring-0 touch-manipulation flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
          animate={unreadCount > 0 ? {
            rotate: [0, -15, 15, -15, 15, 0],
          } : {}}
          transition={unreadCount > 0 ? {
            duration: 0.8, // Mais rápido
            ease: "easeInOut"
          } : {}}
          style={{
            WebkitTapHighlightColor: 'rgba(0,0,0,0)',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            outline: 'none',
            WebkitAppearance: 'none',
            backgroundColor: 'transparent',
            boxShadow: 'none'
          }}
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5 text-foreground" />
        </motion.button>

        {unreadCount > 0 && (
          <div className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 z-10">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-background border border-border rounded-xl shadow-lg max-h-[70vh] overflow-hidden flex flex-col z-[100]"
              style={{
                position: 'fixed',
                top: isMobile ? '68px' : '76px',
                right: isMobile ? '1rem' : '56px', // Ajustado para alinhar com o botão do sininho
                width: isMobile ? 'calc(100vw - 2rem)' : '400px',
                maxWidth: isMobile ? 'calc(100vw - 2rem)' : '400px'
              }}
            >
              {/* Header */}
              <div className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} border-b border-border`}>
                <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-sm'}`}>Notificações</h3>
                {sortedNotifications.length > 0 && (
                  <button
                    onClick={() => {
                      // Remover todas as notificações ao invés de apenas marcar como lidas
                      // Criar uma cópia do array para evitar problemas durante a iteração
                      const notificationsToRemove = [...sortedNotifications]
                      notificationsToRemove.forEach(notification => {
                        removeNotification(notification.id)
                      })
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Marcar todas como lidas
                  </button>
                )}
              </div>

              {/* Lista de notificações */}
              <div className="overflow-y-auto flex-1">
                {sortedNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-4 text-center text-muted-foreground text-sm">
                    <Bell className="h-6 w-6 mb-2 opacity-50" />
                    <p>Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sortedNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`relative ${isMobile ? 'p-3' : 'p-4'} hover:bg-secondary/50 transition-colors ${
                          !notification.read ? 'bg-primary/5' : ''
                        }`}
                      >
                        {/* Botão de lixeira no canto superior direito */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeNotification(notification.id)
                          }}
                          className="absolute top-2.5 right-2.5 p-1.5 hover:bg-destructive/20 rounded-md transition-colors opacity-60 hover:opacity-100 flex items-center justify-center group"
                          aria-label="Remover notificação"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                        </button>

                        <div className="flex items-start gap-3 pr-6">
                          {/* Ícone */}
                          <div className={`${isMobile ? 'text-2xl' : 'text-xl'} flex-shrink-0 mt-0.5`}>
                            {getNotificationIcon(notification)}
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${isMobile ? 'text-base' : 'text-sm'} text-foreground break-words`}>
                              {notification.title}
                            </p>
                            <p className={`${isMobile ? 'text-sm' : 'text-xs'} text-muted-foreground mt-1 break-words`}>
                              {notification.body}
                            </p>
                            {notification.data && notification.data.homeTeam && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {notification.data.homeTeam} {notification.data.homeScore ?? 0} x {notification.data.awayScore ?? 0} {notification.data.awayTeam}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatTime(notification.timestamp)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
