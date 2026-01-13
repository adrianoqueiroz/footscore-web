import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'

export interface NotificationItem {
  id: string
  title: string
  body: string
  timestamp: number
  read: boolean
  type: 'goal' | 'match_status' | 'round_finished' | 'other'
  data?: {
    matchId?: string
    round?: number
    homeTeam?: string
    awayTeam?: string
    homeScore?: number
    awayScore?: number
    goalScorer?: 'home' | 'away' | null
    isGoalCancelled?: boolean
  }
}

const STORAGE_KEY = 'footscore_notifications'
const MAX_NOTIFICATIONS = 50 // Manter apenas as últimas 50 notificações

// Função para carregar notificações do localStorage
function loadNotifications(): NotificationItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[NotificationContext] Erro ao carregar notificações:', error)
  }
  return []
}

// Função para salvar notificações no localStorage
function saveNotifications(notifications: NotificationItem[]) {
  try {
    // Manter apenas as últimas MAX_NOTIFICATIONS
    const toSave = notifications.slice(-MAX_NOTIFICATIONS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('[NotificationContext] Erro ao salvar notificações:', error)
  }
}

// Função para atualizar badge no ícone do app
async function updateBadge(count: number) {
  if ('setAppBadge' in navigator && typeof (navigator as any).setAppBadge === 'function') {
    try {
      if (count > 0) {
        await (navigator as any).setAppBadge(count)
      } else {
        await (navigator as any).clearAppBadge()
      }
    } catch (error) {
      console.error('[NotificationContext] Erro ao atualizar badge:', error)
    }
  }
}

interface NotificationContextType {
  notifications: NotificationItem[]
  unreadCount: number
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const initializedRef = useRef(false)

  // Carregar notificações do localStorage na inicialização
  useEffect(() => {
    if (!initializedRef.current) {
      const loaded = loadNotifications()
      setNotifications(loaded)
      const unread = loaded.filter(n => !n.read).length
      setUnreadCount(unread)
      updateBadge(unread)
      initializedRef.current = true
    }
  }, [])

  // Escutar mensagens do service worker sobre push recebidos
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'push_received') {
          // Adicionar notificação mesmo quando o app está aberto
          // (para manter histórico e badge atualizado)
          const newNotification: NotificationItem = {
            title: event.data.title || '⚽ Gol!',
            body: event.data.body || 'Um gol foi marcado!',
            type: event.data.data?.type === 'goal' ? 'goal' : 'other',
            data: event.data.data,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            read: false
          }

          setNotifications(prev => {
            const updated = [...prev, newNotification]
            saveNotifications(updated)
            return updated
          })

          setUnreadCount(prev => {
            const newCount = prev + 1
            updateBadge(newCount)
            return newCount
          })
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [])

  // Adicionar nova notificação
  const addNotification = useCallback((notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false
    }

    setNotifications(prev => {
      const updated = [...prev, newNotification]
      saveNotifications(updated)
      return updated
    })

    setUnreadCount(prev => {
      const newCount = prev + 1
      updateBadge(newCount)
      return newCount
    })
  }, [])

  // Marcar notificação como lida
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n)
      saveNotifications(updated)
      return updated
    })

    setUnreadCount(prev => {
      const newCount = Math.max(0, prev - 1)
      updateBadge(newCount)
      return newCount
    })
  }, [])

  // Marcar todas como lidas
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }))
      saveNotifications(updated)
      return updated
    })

    setUnreadCount(0)
    updateBadge(0)
  }, [])

  // Remover notificação
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id)
      const updated = prev.filter(n => n.id !== id)
      saveNotifications(updated)
      
      // Se a notificação removida não estava lida, decrementar contador
      if (notification && !notification.read) {
        setUnreadCount(count => {
          const newCount = Math.max(0, count - 1)
          updateBadge(newCount)
          return newCount
        })
      }
      
      return updated
    })
  }, [])

  // Limpar todas as notificações
  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
    saveNotifications([])
    updateBadge(0)
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications deve ser usado dentro de NotificationProvider')
  }
  return context
}
