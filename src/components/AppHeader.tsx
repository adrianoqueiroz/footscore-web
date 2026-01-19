import { motion } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import Logo from './ui/Logo'
import NotificationBell from './NotificationBell'
import { authService } from '@/services/auth.service'
import { useAvatarCache } from '@/hooks/useAvatarCache'

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authService.getCurrentUser()
  const { avatarUrl: cachedAvatar } = useAvatarCache(user?.avatar)

  const handleLogoClick = async () => {
    // Verificar se há guard de navegação ativo (para página de Predictions)
    const navigationAllowed = await new Promise<boolean>((resolve) => {
      const navigationEvent = new CustomEvent('navigation-attempt', {
        detail: { 
          path: '/rounds',
          resolve
        }
      })
      window.dispatchEvent(navigationEvent)
      
      // Timeout de segurança: se não houver resposta em 200ms, permitir navegação
      setTimeout(() => resolve(true), 200)
    })

    if (navigationAllowed) {
      navigate('/rounds')
    }
  }

  // Pega as iniciais do nome
  const initials = user?.name
    .split(' ')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')

  if (!user) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-visible md:fixed md:left-64 md:w-[calc(100%-16rem)]">
        <div className="mx-auto flex max-w-md md:max-w-2xl lg:max-w-4xl items-center justify-between px-4 md:px-6 lg:px-8 py-3 md:py-4 relative">
          <div style={{ overflow: 'visible', position: 'relative', zIndex: 50 }}>
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity active:opacity-70 py-1 px-1 -mx-1 select-none"
            >
              <Logo size="sm" showStars={true} />
            </button>
          </div>
          <div className="flex items-center">
            <NotificationBell />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-visible md:fixed md:left-64 md:w-[calc(100%-16rem)]">
      <div className="mx-auto flex max-w-md md:max-w-2xl lg:max-w-4xl items-center justify-between px-4 md:px-6 lg:px-8 py-3 md:py-4 relative">
        <div style={{ overflow: 'visible', position: 'relative', zIndex: 50 }}>
          <button
            onClick={() => navigate('/rounds')}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity active:opacity-70 py-1 px-1 -mx-1 select-none"
          >
            <Logo size="sm" showStars={true} />
          </button>
        </div>
        <div className="flex items-center">
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}

