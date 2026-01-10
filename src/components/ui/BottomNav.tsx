import { Home, Ticket, Trophy, Settings, HelpCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

type NavigationItem = 'rounds' | 'tickets' | 'ranking' | 'admin' | 'about'

interface BottomNavProps {
  isAdmin?: boolean
}

const navItems: { key: NavigationItem; label: string; icon: typeof Home; path: string }[] = [
  { key: 'rounds', label: 'Jogos', icon: Home, path: '/rounds' },
  { key: 'tickets', label: 'Palpites', icon: Ticket, path: '/tickets' },
  { key: 'ranking', label: 'Ranking', icon: Trophy, path: '/ranking' },
  { key: 'admin', label: 'Admin', icon: Settings, path: '/admin' },
  { key: 'about', label: 'Sobre', icon: HelpCircle, path: '/about' },
]

export default function BottomNav({ isAdmin = false }: BottomNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const items = isAdmin ? navItems : navItems.filter(item => item.key !== 'admin')

  const getCurrentPage = (): NavigationItem => {
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
    return navItems.find(i => location.pathname.startsWith(i.path))?.key || 'rounds'
  }

  const current = getCurrentPage()

  return (
    <>
      {/* Mobile: Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-inset-bottom overflow-x-hidden md:hidden">
        <div className="mx-auto flex max-w-md w-full items-center justify-around px-2 py-2">
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
                  'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-2 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    className="absolute -top-0.5 left-1/2 h-1 w-8 rounded-full bg-primary pointer-events-none"
                    initial={{ x: '-50%' }}
                    animate={{ x: '-50%' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                <span className="text-xs font-medium">{item.label}</span>
              </motion.button>
            )
          })}
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
                  'relative flex items-center gap-3 rounded-lg px-4 py-3 transition-all text-left',
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
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-primary pointer-events-none"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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

