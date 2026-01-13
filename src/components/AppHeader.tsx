import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Logo from './ui/Logo'
import NotificationBell from './NotificationBell'

export default function AppHeader() {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 overflow-visible md:fixed md:left-64 md:w-[calc(100%-16rem)]">
      <div className="mx-auto flex max-w-md md:max-w-full items-center justify-between px-4 md:px-6 py-3 md:py-4 relative">
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

