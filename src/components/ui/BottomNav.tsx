import React from 'react'
import { Home, Ticket, Trophy, Settings, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

type NavigationItem = 'rounds' | 'tickets' | 'ranking' | 'admin'

interface BottomNavProps {
  isAdmin?: boolean
}

const navItems: { key: NavigationItem; label: string; icon: typeof Home; path: string }[] = [
  { key: 'rounds', label: 'Início', icon: Home, path: '/rounds' },
  { key: 'tickets', label: 'Palpites', icon: Ticket, path: '/tickets' },
  { key: 'ranking', label: 'Ranking', icon: Trophy, path: '/ranking' },
  { key: 'admin', label: 'Admin', icon: Settings, path: '/admin' },
]

export default function BottomNav({ isAdmin = false }: BottomNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const triggerHaptic = useHapticFeedback()
  const items = isAdmin ? navItems : navItems.filter(item => item.key !== 'admin')

  // Detectar se está no iOS
  const isIOS = React.useMemo(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }, [])

  // Prevenir múltiplas navegações simultâneas
  const isNavigatingRef = React.useRef(false)

  // Memoizar cálculo da página atual para evitar recálculos desnecessários
  const current = React.useMemo(() => {
    // Se está na página de detalhes do ticket, verificar de onde veio
    if (location.pathname.startsWith('/tickets/')) {
      // Verificar se veio do ranking através do query parameter
      const searchParams = new URLSearchParams(location.search)
      const fromParam = searchParams.get('from')
      if (fromParam === 'ranking') {
        return 'ranking'
      }
      // Caso contrário, assume que veio de tickets
      return 'tickets'
    }
    return navItems.find(i => location.pathname.startsWith(i.path))?.key || null
  }, [location.pathname, location.search])

  // Verificar se estamos na página de conta
  const isAccountPage = location.pathname === '/account'

  return (
    <>
      {/* Mobile: Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-inset-bottom overflow-x-hidden md:hidden">
        <div className="mx-auto flex max-w-md w-full items-center px-2 py-2">
          {/* Navigation Items - Left */}
          <div className="flex flex-1 items-center justify-around">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = current === item.key

              return (
                <motion.button
                  key={item.key}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()

                    // Prevenir múltiplas navegações simultâneas
                    if (isNavigatingRef.current) return

                    // Prioridade máxima: navegar imediatamente sem verificações desnecessárias
                    if (location.pathname !== item.path) {
                      isNavigatingRef.current = true
                      // Feedback háptico em background (não bloqueante)
                      setTimeout(() => triggerHaptic('light'), 0)
                      // Navegação síncrona com prioridade máxima
                      navigate(item.path, { replace: false })
                      // Reset flag após um pequeno delay
                      setTimeout(() => {
                        isNavigatingRef.current = false
                      }, 100)
                    }
                  }}
                  onTouchStart={isIOS ? (e) => {
                    e.preventDefault()
                    e.stopPropagation()

                    // Prevenir múltiplas navegações simultâneas
                    if (isNavigatingRef.current) return

                    // Para iOS: usar touchstart para resposta mais imediata
                    if (location.pathname !== item.path) {
                      isNavigatingRef.current = true
                      // Forçar navegação imediata no iOS usando requestAnimationFrame
                      requestAnimationFrame(() => {
                        navigate(item.path, { replace: false })
                      })
                      // Feedback háptico em background
                      setTimeout(() => triggerHaptic('light'), 10)
                      // Reset flag após um pequeno delay
                      setTimeout(() => {
                        isNavigatingRef.current = false
                      }, 100)
                    }
                  } : undefined}
                  className={cn(
                    'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-3 transition-colors',
                    'touch-manipulation select-none', // Otimizações específicas para toque
                    isIOS && 'cursor-pointer', // Cursor específico para iOS
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  style={isIOS ? {
                    WebkitTapHighlightColor: 'transparent', // Remove highlight azul do iOS
                    WebkitTouchCallout: 'none', // Previne menu de contexto
                    WebkitUserSelect: 'none', // Previne seleção de texto
                  } : undefined}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      className="absolute -top-0.5 left-1/2 h-1 w-8 rounded-full bg-primary pointer-events-none"
                      initial={{ scaleX: 0, opacity: 0, x: '-50%' }}
                      animate={{ scaleX: 1, opacity: 1, x: '-50%' }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                        duration: 0.4,
                        opacity: { duration: 0.15 }
                      }}
                    />
                  )}
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                  <span className="text-xs font-medium">{item.label}</span>
                </motion.button>
              )
            })}
          </div>

          {/* Profile Icon - Right */}
          <div className="flex items-center justify-center">
            <motion.button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigate('/account')
              }}
              onTouchStart={isIOS ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                navigate('/account')
              } : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 rounded-lg py-3 px-3 transition-colors',
                'touch-manipulation select-none', // Otimizações específicas para toque
                isIOS && 'cursor-pointer', // Cursor específico para iOS
                isAccountPage ? 'text-primary' : 'text-muted-foreground'
              )}
              style={isIOS ? {
                WebkitTapHighlightColor: 'transparent', // Remove highlight azul do iOS
                WebkitTouchCallout: 'none', // Previne menu de contexto
                WebkitUserSelect: 'none', // Previne seleção de texto
              } : undefined}
              whileTap={{ scale: 0.95 }}
            >
              {isAccountPage && (
                <motion.div
                  className="absolute -top-0.5 left-1/2 h-1 w-8 rounded-full bg-primary pointer-events-none"
                  initial={{ scaleX: 0, opacity: 0, x: '-50%' }}
                  animate={{ scaleX: 1, opacity: 1, x: '-50%' }}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                    duration: 0.4,
                    opacity: { duration: 0.15 }
                  }}
                />
              )}
              <User className={cn('h-5 w-5', isAccountPage && 'text-primary')} />
              <span className="text-xs font-medium">Conta</span>
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Desktop: Sidebar Navigation */}
      <nav className="hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:h-full md:w-64 md:border-r md:border-border md:bg-background/95 md:backdrop-blur md:supports-[backdrop-filter]:md:bg-background/80 md:z-40 md:pt-20">
        <div className="flex flex-col gap-1 px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = current === item.key

            return (
              <motion.button
                key={item.key}
                onClick={() => {
                  if (location.pathname !== item.path) {
                    navigate(item.path, { replace: false })
                  }
                }}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-6 py-4 transition-all text-left',
                  'hover:bg-secondary/50 hover:text-foreground',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.div
                    className="absolute left-0 top-4 h-6 w-1 rounded-r-full bg-primary pointer-events-none"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 30,
                      duration: 0.4,
                      opacity: { duration: 0.15 }
                    }}
                  />
                )}
                <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                <span className="text-sm font-medium">{item.label}</span>
              </motion.button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

