import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import TeamLogo from './TeamLogo'

interface MatchInfo {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  goalScorer?: 'home' | 'away' | null
  isGoalCancelled?: boolean
  homeTeamLogo?: string | null
  awayTeamLogo?: string | null
}

interface Notification {
  id: string
  matchInfo: MatchInfo
  createdAt: number
}

interface PulsingBallProps {
  /**
   * Se true, mostra a bola pulsando
   */
  show: boolean
  /**
   * Duração em milissegundos antes de ocultar automaticamente
   * @default 5000
   */
  duration?: number
  /**
   * Callback quando a bola é clicada
   */
  onClick?: () => void
  /**
   * Informações do gol (opcional)
   */
  matchInfo?: MatchInfo
}

export default function PulsingBall({ show, duration = 5000, onClick, matchInfo }: PulsingBallProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [visibleNotifications, setVisibleNotifications] = useState<Set<string>>(new Set())
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const lastProcessedRef = useRef<{ hash: string; timestamp: number } | null>(null)
  const previousShowRef = useRef(false)
  const ballTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showBall, setShowBall] = useState(false)
  const notificationsRef = useRef<Notification[]>([])
  const [position, setPosition] = useState({ top: 16, right: 16 })
  const positionUpdateRef = useRef<NodeJS.Timeout | null>(null)

  // Função para gerar um hash único baseado nos dados do matchInfo
  const getMatchInfoHash = (info: MatchInfo): string => {
    return `${info.homeTeam}-${info.awayTeam}-${info.homeScore}-${info.awayScore}-${info.goalScorer || ''}`
  }

  // Atualizar timer da bola sempre que uma nova notificação for adicionada
  const updateBallTimer = () => {
    // Limpar timer anterior da bola
    if (ballTimerRef.current) {
      clearTimeout(ballTimerRef.current)
    }
    
    // Mostrar a bola se houver notificações
    if (notificationsRef.current.length > 0) {
      setShowBall(true)
      
      // Configurar novo timer para esconder a bola quando a última notificação desaparecer
      // O timer será resetado a cada nova notificação
      ballTimerRef.current = setTimeout(() => {
        // Verificar novamente se ainda há notificações antes de esconder
        if (notificationsRef.current.length === 0) {
          setShowBall(false)
        }
      }, duration)
    }
  }

  // Adicionar nova notificação quando show mudar para true e matchInfo mudar
  useEffect(() => {
    if (show && matchInfo) {
      const currentHash = getMatchInfoHash(matchInfo)
      const timestamp = Date.now()
      
      // Verificar se é uma notificação nova:
      // 1. show mudou de false para true (primeira vez ou nova notificação) OU
      // 2. Não há última processada OU
      // 3. O hash mudou OU
      // 4. O hash é o mesmo mas passou mais de 1 segundo (gol diferente no mesmo placar)
      const showChanged = !previousShowRef.current && show
      const isNew = showChanged ||
        !lastProcessedRef.current || 
        lastProcessedRef.current.hash !== currentHash ||
        (lastProcessedRef.current.hash === currentHash && timestamp - lastProcessedRef.current.timestamp > 1000)
      
      if (isNew) {
        // Aguardar um pouco para garantir que matchInfo esteja atualizado
        const addTimer = setTimeout(() => {
          const notificationId = `${timestamp}-${Math.random()}`
          const newNotification: Notification = {
            id: notificationId,
            matchInfo: { ...matchInfo },
            createdAt: timestamp,
          }

          setNotifications(prev => {
            const updated = [...prev, newNotification]
            notificationsRef.current = updated
            // Adicionar um pequeno delay para garantir que a animação inicial seja aplicada
            setTimeout(() => {
              setVisibleNotifications(prev => new Set([...prev, notificationId]))
            }, 10)
            // Atualizar timer da bola após adicionar notificação
            setTimeout(() => {
              updateBallTimer()
            }, 0)
            return updated
          })
          lastProcessedRef.current = { hash: currentHash, timestamp }

          // Configurar timer para remover esta notificação após a duração
          const timer = setTimeout(() => {
            setNotifications(prev => {
              const updated = prev.filter(n => n.id !== notificationId)
              notificationsRef.current = updated
              setVisibleNotifications(prev => {
                const newSet = new Set(prev)
                newSet.delete(notificationId)
                return newSet
              })
              // Se não há mais notificações, esconder a bola após um pequeno delay
              // para que a animação de saída do último card termine primeiro
              if (updated.length === 0) {
                if (ballTimerRef.current) {
                  clearTimeout(ballTimerRef.current)
                }
                // Aguardar um pouco para a animação de saída do card terminar antes de esconder a bola
                setTimeout(() => {
                  setShowBall(false)
                }, 300) // 300ms = duração da animação de saída do card
              }
              return updated
            })
            timersRef.current.delete(notificationId)
          }, duration)

          timersRef.current.set(notificationId, timer)
        }, 50)

        previousShowRef.current = show
        return () => clearTimeout(addTimer)
      }
    } else if (!show) {
      previousShowRef.current = false
    }
  }, [show, matchInfo, duration])

  // Atualizar timer da bola quando notificações mudarem
  useEffect(() => {
    notificationsRef.current = notifications
    if (notifications.length > 0) {
      updateBallTimer()
    } else {
      setShowBall(false)
      if (ballTimerRef.current) {
        clearTimeout(ballTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length])

  // Calcular posição relativa ao container de conteúdo
  useEffect(() => {
    const updatePosition = () => {
      // Procurar pelo container de conteúdo principal
      // Primeiro, tentar encontrar containers dentro do main
      const main = document.querySelector('main')
      const mainContainers = main 
        ? Array.from(main.querySelectorAll('[class*="max-w-md"], [class*="max-w-2xl"], [class*="max-w-4xl"]'))
        : []
      
      // Se não encontrar no main, procurar em toda a página
      const allContainers = mainContainers.length > 0 
        ? mainContainers 
        : Array.from(document.querySelectorAll('[class*="max-w-md"], [class*="max-w-2xl"], [class*="max-w-4xl"]'))
      
      if (allContainers.length > 0) {
        // Pegar o container visível mais próximo do topo
        const container = Array.from(allContainers)
          .map(el => {
            const rect = el.getBoundingClientRect()
            return { el, rect }
          })
          .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.top >= 0)
          .sort((a, b) => a.rect.top - b.rect.top)[0]?.el as HTMLElement | undefined
        
        if (container) {
          const rect = container.getBoundingClientRect()
          // Posicionar no canto superior direito do container
          // Em mobile, usar posição fixa; em desktop, relativa ao container
          const isMobile = window.innerWidth < 768
          
          if (isMobile) {
            // Mobile: posição fixa no canto da tela
            setPosition({ top: 16, right: 16 })
          } else {
            // Desktop: posição relativa ao container de conteúdo
            setPosition({
              top: rect.top + 16,
              right: window.innerWidth - rect.right + 16
            })
          }
          return
        }
      }
      
      // Fallback: usar posição fixa no canto da tela
      setPosition({ top: 16, right: 16 })
    }
    
    // Atualizar posição inicial
    updatePosition()
    
    // Atualizar posição em scroll e resize (com debounce)
    const handleUpdate = () => {
      if (positionUpdateRef.current) {
        clearTimeout(positionUpdateRef.current)
      }
      positionUpdateRef.current = setTimeout(updatePosition, 100)
    }
    
    window.addEventListener('scroll', handleUpdate, true)
    window.addEventListener('resize', handleUpdate)
    
    return () => {
      window.removeEventListener('scroll', handleUpdate, true)
      window.removeEventListener('resize', handleUpdate)
      if (positionUpdateRef.current) {
        clearTimeout(positionUpdateRef.current)
      }
    }
  }, [])

  // Limpar timers ao desmontar
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current.clear()
      if (ballTimerRef.current) {
        clearTimeout(ballTimerRef.current)
      }
    }
  }, [])

  // Função para remover uma notificação manualmente
  const handleRemoveNotification = (id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id)
      notificationsRef.current = updated
      setVisibleNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
      // Se não há mais notificações, esconder a bola
      if (updated.length === 0) {
        setShowBall(false)
        if (ballTimerRef.current) {
          clearTimeout(ballTimerRef.current)
        }
      }
      return updated
    })
    if (onClick) {
      onClick()
    }
  }

  // Renderizar usando Portal para garantir que fique acima de tudo
  const portalContent = (
    <>
      {/* Bola girando - renderizada separadamente, completamente independente dos cards */}
      <AnimatePresence>
        {showBall && (
          <motion.div
            key="pulsing-ball"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.3 }}
            style={{ 
              position: 'fixed',
              top: `${position.top}px`,
              right: `${position.right}px`,
              zIndex: 99999,
              pointerEvents: 'none'
            }}
          >
            <motion.div
              animate={{
                rotate: 360,
                scale: [1, 1.2, 1],
              }}
              transition={{
                rotate: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                },
                scale: {
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
            >
              {/* Bola de futebol - apenas emoji, sem background */}
              <div className="w-16 h-16 flex items-center justify-center">
                <span className="text-5xl drop-shadow-lg">⚽</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banners de notificação - container separado */}
      <div 
        className="fixed flex flex-col items-end gap-3"
        style={{ 
          top: `${position.top + (showBall ? 80 : 0)}px`,
          right: `${position.right}px`,
          transition: 'top 0.3s ease-in-out',
          zIndex: 99999,
          pointerEvents: 'auto'
        }}
      >
        <AnimatePresence mode="sync">
          {notifications.map((notification, index) => {
            const isVisible = visibleNotifications.has(notification.id)
            return (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={isVisible ? { 
                  opacity: 1, 
                  y: 0, 
                  scale: 1
                } : { 
                  opacity: 0, 
                  y: -20, 
                  scale: 0.9
                }}
                exit={{ 
                  opacity: 0,
                  scale: 0.8
                }}
                transition={{ 
                  opacity: { duration: 0.3, ease: 'easeOut' },
                  y: { duration: 0.3, ease: 'easeOut' },
                  scale: { duration: 0.3, ease: 'easeOut' },
                  layout: { duration: 0.3, ease: 'easeOut' }
                }}
                className="cursor-pointer flex flex-col items-end"
                onClick={() => handleRemoveNotification(notification.id)}
              >
            {/* Tooltip com informações do gol - estilo card do líder */}
            <motion.div
              className="border-2 border-primary bg-gradient-to-br from-primary/90 to-primary/85 shadow-lg rounded-xl p-2 min-w-[200px] z-[100] backdrop-blur-sm"
            >
              <div className="text-xs font-semibold text-primary-foreground mb-2">
                {notification.matchInfo.goalScorer === 'home' 
                  ? notification.matchInfo.isGoalCancelled
                    ? `Gol do ${notification.matchInfo.homeTeam} anulado!`
                    : `Gol do ${notification.matchInfo.homeTeam}!`
                  : notification.matchInfo.goalScorer === 'away'
                  ? notification.matchInfo.isGoalCancelled
                    ? `Gol do ${notification.matchInfo.awayTeam} anulado!`
                    : `Gol do ${notification.matchInfo.awayTeam}!`
                  : 'Gol!'}
              </div>
              <div className="text-xs text-foreground space-y-1">
                <div className={`flex items-center justify-between gap-2 px-1 py-0.5 rounded ${
                  notification.matchInfo.goalScorer === 'home' ? 'bg-primary/40' : ''
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <TeamLogo 
                      teamName={notification.matchInfo.homeTeam} 
                      logo={notification.matchInfo.homeTeamLogo || undefined}
                      size="sm" 
                      className="h-4 w-4 flex-shrink-0" 
                      noCircle 
                    />
                    <span className={`truncate ${notification.matchInfo.goalScorer === 'home' ? 'text-primary-foreground font-semibold' : ''}`}>
                      {notification.matchInfo.homeTeam}
                    </span>
                  </div>
                  <span className={`font-bold flex-shrink-0 ${notification.matchInfo.goalScorer === 'home' ? 'text-primary-foreground' : ''}`}>
                    {notification.matchInfo.homeScore}
                  </span>
                </div>
                <div className={`flex items-center justify-between gap-2 px-1 py-0.5 rounded ${
                  notification.matchInfo.goalScorer === 'away' ? 'bg-primary/40' : ''
                }`}>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <TeamLogo 
                      teamName={notification.matchInfo.awayTeam} 
                      logo={notification.matchInfo.awayTeamLogo || undefined}
                      size="sm" 
                      className="h-4 w-4 flex-shrink-0" 
                      noCircle 
                    />
                    <span className={`truncate ${notification.matchInfo.goalScorer === 'away' ? 'text-primary-foreground font-semibold' : ''}`}>
                      {notification.matchInfo.awayTeam}
                    </span>
                  </div>
                  <span className={`font-bold flex-shrink-0 ${notification.matchInfo.goalScorer === 'away' ? 'text-primary-foreground' : ''}`}>
                    {notification.matchInfo.awayScore}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </>
  )

  // Renderizar usando Portal no body para garantir que fique acima de tudo
  if (typeof document !== 'undefined') {
    return createPortal(portalContent, document.body)
  }
  
  return null
}

