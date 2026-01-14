import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck } from 'lucide-react'
import { useNotifications, NotificationItem } from '@/contexts/NotificationContext'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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


  // Marcar todas como lidas ao abrir o dropdown
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllAsRead()
    }
  }, [isOpen, unreadCount, markAllAsRead])

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
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-full hover:bg-secondary/50 transition-colors focus:outline-none focus:ring-0 touch-manipulation flex items-center justify-center"
        whileTap={{ scale: 0.9 }}
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
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

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
                {notifications.length > 0 && (
                  <button
                    onClick={() => {
                      markAllAsRead()
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
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-sm min-h-[200px]">
                    <Bell className="h-8 w-8 mb-2 opacity-50" />
                    <p>Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sortedNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`${isMobile ? 'p-3' : 'p-4'} hover:bg-secondary/50 transition-colors ${
                          !notification.read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Ícone */}
                          <div className={`${isMobile ? 'text-2xl' : 'text-xl'} flex-shrink-0 mt-0.5`}>
                            {getNotificationIcon(notification)}
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
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
                              </div>
                              <button
                                onClick={() => removeNotification(notification.id)}
                                className="flex-shrink-0 p-1 hover:bg-secondary rounded transition-colors"
                                aria-label="Remover notificação"
                              >
                                <X className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
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
