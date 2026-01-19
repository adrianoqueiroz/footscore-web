import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth.service'
import { User } from '@/types'
import Login from '@/pages/Login'
import Register from '@/pages/Register' // Import the new Register component
import Onboarding from '@/pages/Onboarding'
import Matches from '@/pages/Matches'
import Predictions from '@/pages/Predictions'
import Tickets from '@/pages/Tickets'
import TicketDetails from '@/pages/TicketDetails'
import Ranking from '@/pages/Ranking'
import Admin from '@/pages/Admin'
import AdminCreateRound from '@/pages/AdminCreateRound'
import AdminUpdateGames from '@/pages/AdminUpdateGames'
import AdminManagePalpites from '@/pages/AdminManagePalpites'
import AdminManageUsers from '@/pages/AdminManageUsers'
import AdminSettings from '@/pages/AdminSettings'
import DebugPush from '@/pages/DebugPush'
import EditGame from '@/pages/EditGame'
import EditPhone from '@/pages/EditPhone'
import Account from '@/pages/Account'
import Profile from '@/pages/Profile'
import NotificationSettings from '@/pages/NotificationSettings'
import About from '@/pages/About'
import AppHeader from '@/components/AppHeader'
import BottomNav from '@/components/ui/BottomNav'
import { usePWANavigation } from '@/hooks/usePWANavigation'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useNotificationListener } from '@/hooks/useNotificationListener'
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator'
import { ToastProvider } from '@/contexts/ToastContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { RoundSelectorProvider } from '@/contexts/RoundSelectorContext'
import { ConnectionProvider } from '@/contexts/ConnectionContext'
import { NotificationProvider } from '@/contexts/NotificationContext'

// Componente de redirect para a rota raiz - sempre vai para login
const RootRedirect = () => {
  return <Navigate to="/login" replace />
}

const AdminRoute = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Usar um pequeno delay para evitar flash de loading muito rápido
    const timer = setTimeout(() => {
      const currentUser = authService.getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
      }
      setLoading(false)
    }, 50)

    return () => clearTimeout(timer)
  }, [])


  if (loading) {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-screen">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Painel Administrativo</h1>
            <div className="w-40 h-10"></div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {/* Placeholder para os cards do menu */}
            <div className="h-20 bg-secondary/20 rounded-lg animate-pulse"></div>
            <div className="h-20 bg-secondary/20 rounded-lg animate-pulse"></div>
            <div className="h-20 bg-secondary/20 rounded-lg animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/rounds" />
  }

  return <Outlet />
}

const AppRoutes = () => {
  return (
    <ConnectionProvider>
      <ToastProvider>
        <ConfirmProvider>
          <NotificationProvider>
            <RoundSelectorProvider>
              <Router>
                <Routes>
                  {/* Rota raiz - redirect inteligente baseado em autenticação */}
                  <Route path="/" element={<RootRedirect />} />
                  <Route element={<PublicRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                  </Route>
                  <Route element={<PrivateRoute />}>
                    <Route path="/rounds" element={<Matches />} />
                    <Route path="/games" element={<Predictions />} />
                    <Route path="/tickets" element={<Tickets />} />
                    <Route path="/tickets/:ticketId" element={<TicketDetails />} />
                    <Route path="/ranking" element={<Ranking />} />
                    <Route path="/debug-push" element={<DebugPush />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/edit-phone" element={<EditPhone />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/notifications" element={<NotificationSettings />} />
                    <Route path="/account" element={<Account />} />
                    <Route element={<AdminRoute />}>
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/admin/create-round" element={<AdminCreateRound />} />
                      <Route path="/admin/update-games" element={<AdminUpdateGames />} />
                      <Route path="/admin/manage-palpites" element={<AdminManagePalpites />} />
                      <Route path="/admin/manage-users" element={<AdminManageUsers />} />
                      <Route path="/admin/settings" element={<AdminSettings />} />
                      <Route path="/admin/edit-game" element={<EditGame />} />
                    </Route>
                  </Route>
                </Routes>
              </Router>
            </RoundSelectorProvider>
          </NotificationProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ConnectionProvider>
  )
}

const PublicRoute = () => {
  const isAuthenticated = authService.isAuthenticated()
  return isAuthenticated ? <Navigate to="/rounds" /> : <Outlet />
}

const PrivateRoute = () => {
  const [user, setUser] = useState<User | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [loading, setLoading] = useState(true)

  // Função para atualizar o estado do usuário
  const updateUserState = useCallback(() => {
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      // Verificar se precisa fazer onboarding (needsOnboarding === true)
      setNeedsOnboarding(currentUser.needsOnboarding === true)
    } else {
      setUser(null)
      setNeedsOnboarding(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // Usar um pequeno delay para evitar flash de loading muito rápido
    const timer = setTimeout(() => {
      updateUserState()
    }, 50)

    // Listener para atualizar quando o storage mudar (login/logout)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bolao_user' || e.key === 'auth_token') {
        console.log('[Router] Storage mudou, atualizando estado do usuário')
        updateUserState()
      }
    }

    // Listener para eventos customizados de login
    const handleLogin = () => {
      console.log('[Router] Evento de login detectado, atualizando estado')
      updateUserState()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('user-login', handleLogin)
    window.addEventListener('user-logout', handleLogin)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('user-login', handleLogin)
      window.removeEventListener('user-logout', handleLogin)
    }
  }, [updateUserState])

  const handleOnboardingComplete = () => {
    const currentUser = authService.getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      setNeedsOnboarding(false)
    }
  }

  if (loading) {
    return null // Retornar null em vez de "Loading..." para evitar flash
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return <MainLayout user={user} />
}

const MainLayout = ({ user }: { user: User }) => {
  const navigate = useNavigate()
  const mainContentRef = useRef<HTMLElement>(null)
  
  usePWANavigation()
  const pullToRefreshState = usePullToRefresh({ contentRef: mainContentRef })
  
  // Escutar eventos SSE e adicionar notificações automaticamente
  useNotificationListener()

  // Listener para mensagens do service worker (navegação via push notification)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'navigate') {
          console.log('[Router] Navegando via SW message:', event.data.url)
          navigate(event.data.url)
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [navigate])

  // Estilos para o efeito rubber band no conteúdo
  const mainStyle: React.CSSProperties = {
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    // Aplica o transform para o efeito rubber band
    transform: pullToRefreshState.isPulling 
      ? `translateY(${pullToRefreshState.visualOffset}px)` 
      : 'none',
    // Transição suave apenas quando está voltando (não durante o pull)
    transition: !pullToRefreshState.isPulling && !pullToRefreshState.isRefreshing
      ? 'transform 0.3s ease-out'
      : 'none',
  }

  return (
    <div className="flex flex-col h-full bg-background md:flex-row">
      <AppHeader />
      <BottomNav isAdmin={!!user?.isAdmin} />
      <main 
        ref={mainContentRef}
        className="flex-1 pb-20 md:pb-0 md:ml-64 md:pt-16 md:pl-0" 
        style={mainStyle}
      >
        <Outlet />
      </main>

      {/* Indicador visual de pull-to-refresh */}
      <PullToRefreshIndicator
        isPulling={pullToRefreshState.isPulling}
        pullDistance={pullToRefreshState.pullDistance}
        canRefresh={pullToRefreshState.canRefresh}
        isRefreshing={pullToRefreshState.isRefreshing}
        visualOffset={pullToRefreshState.visualOffset}
      />
    </div>
  )
}

export default AppRoutes
