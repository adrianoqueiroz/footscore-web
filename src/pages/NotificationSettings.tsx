import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, BellOff, BellRing } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Switch from '@/components/ui/Switch'
import { authService } from '@/services/auth.service'
import { useToastContext } from '@/contexts/ToastContext'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import ContentWrapper from '@/components/ui/ContentWrapper'
import { getTeamDisplayName } from '@/lib/teamNames'

export default function NotificationSettings() {
  const navigate = useNavigate()
  const toast = useToastContext()

  // Push notifications hook
  const {
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    isSubscribed: isPushSubscribed,
    isSupported: pushSupported,
    permission: pushPermission,
    isLoading: pushLoading,
    requestPermission: requestPushPermission
  } = usePushNotifications()

  const [notifyGoalsAllTeams, setNotifyGoalsAllTeams] = useState(true)
  const [notifyGoalsFavoriteTeam, setNotifyGoalsFavoriteTeam] = useState(true)
  const [notifyRoundBets, setNotifyRoundBets] = useState(true)
  const [notifyRanking, setNotifyRanking] = useState(true)
  const [notifyBell, setNotifyBell] = useState(true)
  const [notifyToast, setNotifyToast] = useState(true)
  const [bellRanking, setBellRanking] = useState(true)
  const [bellFavoriteTeamMatch, setBellFavoriteTeamMatch] = useState(true)
  const [bellGoalsAllTeams, setBellGoalsAllTeams] = useState(true)
  const [bellGoalsFavoriteTeam, setBellGoalsFavoriteTeam] = useState(true)
  const [bellRoundBets, setBellRoundBets] = useState(true)
  const [bellMatchStatusAllTeams, setBellMatchStatusAllTeams] = useState(true)
  const [bellMatchStatusFavoriteTeam, setBellMatchStatusFavoriteTeam] = useState(true)
  const [notifyMatchStatusAllTeams, setNotifyMatchStatusAllTeams] = useState(true)
  const [notifyMatchStatusFavoriteTeam, setNotifyMatchStatusFavoriteTeam] = useState(true)
  const [testingSupport, setTestingSupport] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [favoriteTeam, setFavoriteTeam] = useState<string>('')

  // Detectar ambiente iOS PWA
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true
  const isIOSPWA = isIOS && isPWA

  // Suporte efetivo - iOS PWA pode ter suporte mesmo se não detectado inicialmente
  const effectivePushSupported = pushSupported || isIOSPWA


  useEffect(() => {
    // Carregar preferências de notificação e perfil do usuário
    setIsLoading(true)
    
    // Carregar perfil do usuário para obter favoriteTeam atualizado (da tabela users, não de notificações)
    const loadFavoriteTeam = async () => {
      try {
        const user = await authService.refreshUser()
        setFavoriteTeam(user?.favoriteTeam || '')
      } catch (error) {
        console.error('Erro ao carregar perfil do usuário:', error)
        // Fallback para localStorage
        const currentUser = authService.getCurrentUser()
        setFavoriteTeam(currentUser?.favoriteTeam || '')
      }
    }
    loadFavoriteTeam()
    
    // Carregar preferências de notificação
    authService.getNotificationPreferences()
      .then(prefs => {
        setNotifyGoalsAllTeams(prefs.notifyGoalsAllTeams)
        setNotifyGoalsFavoriteTeam(prefs.notifyGoalsFavoriteTeam ?? true)
        setNotifyRoundBets(prefs.notifyRoundBets)
        setNotifyRanking(prefs.notifyRanking)
        setNotifyBell(prefs.notifyBell ?? true)
        setNotifyToast(prefs.notifyToast ?? true)
        setBellRanking(prefs.bellRanking ?? true)
        setBellFavoriteTeamMatch(prefs.bellFavoriteTeamMatch ?? true)
        setBellGoalsAllTeams(prefs.bellGoalsAllTeams ?? true)
        setBellGoalsFavoriteTeam(prefs.bellGoalsFavoriteTeam ?? true)
        setBellRoundBets(prefs.bellRoundBets ?? true)
        setBellMatchStatusAllTeams(prefs.bellMatchStatusAllTeams ?? true)
        setBellMatchStatusFavoriteTeam(prefs.bellMatchStatusFavoriteTeam ?? true)
        setNotifyMatchStatusAllTeams(prefs.notifyMatchStatusAllTeams ?? true)
        setNotifyMatchStatusFavoriteTeam(prefs.notifyMatchStatusFavoriteTeam ?? true)
      })
      .catch(error => {
        console.error('Erro ao carregar preferências de notificação:', error)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Recarregar favoriteTeam quando a página ficar visível (caso tenha sido atualizado em outra aba)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        authService.refreshUser()
          .then(user => {
            setFavoriteTeam(user?.favoriteTeam || '')
          })
          .catch(() => {
            const currentUser = authService.getCurrentUser()
            setFavoriteTeam(currentUser?.favoriteTeam || '')
          })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Função para salvar preferências imediatamente sem mostrar loading
  const savePreference = async (updates: {
    notifyGoalsAllTeams?: boolean
    notifyGoalsFavoriteTeam?: boolean
    notifyRoundBets?: boolean
    notifyRanking?: boolean
    notifyBell?: boolean
    notifyToast?: boolean
    bellRanking?: boolean
    bellFavoriteTeamMatch?: boolean
    bellGoalsAllTeams?: boolean
    bellGoalsFavoriteTeam?: boolean
    bellRoundBets?: boolean
    bellMatchStatusAllTeams?: boolean
    bellMatchStatusFavoriteTeam?: boolean
    notifyMatchStatusAllTeams?: boolean
    notifyMatchStatusFavoriteTeam?: boolean
  }) => {
    try {
      // Preparar valores atualizados - enviar todos os campos
      const currentValues: any = {
        notifyGoals: true, // Sempre true já que não há mais toggle principal
        notifyGoalsAllTeams: updates.notifyGoalsAllTeams ?? notifyGoalsAllTeams,
        notifyGoalsFavoriteTeam: updates.notifyGoalsFavoriteTeam ?? notifyGoalsFavoriteTeam,
        notifyRoundBets: updates.notifyRoundBets ?? notifyRoundBets,
        notifyRanking: updates.notifyRanking ?? notifyRanking,
        notifyBell: updates.notifyBell ?? notifyBell,
        notifyToast: updates.notifyToast ?? notifyToast,
        bellRanking: updates.bellRanking ?? bellRanking,
        bellFavoriteTeamMatch: updates.bellFavoriteTeamMatch ?? bellFavoriteTeamMatch,
        bellGoalsAllTeams: updates.bellGoalsAllTeams ?? bellGoalsAllTeams,
        bellGoalsFavoriteTeam: updates.bellGoalsFavoriteTeam ?? bellGoalsFavoriteTeam,
        bellRoundBets: updates.bellRoundBets ?? bellRoundBets,
        bellMatchStatusAllTeams: updates.bellMatchStatusAllTeams ?? bellMatchStatusAllTeams,
        bellMatchStatusFavoriteTeam: updates.bellMatchStatusFavoriteTeam ?? bellMatchStatusFavoriteTeam,
        notifyMatchStatusAllTeams: updates.notifyMatchStatusAllTeams ?? notifyMatchStatusAllTeams,
        notifyMatchStatusFavoriteTeam: updates.notifyMatchStatusFavoriteTeam ?? notifyMatchStatusFavoriteTeam
      }
      
      await authService.updateNotificationPreferences(currentValues)
    } catch (error: any) {
      console.error('Erro ao salvar preferência:', error)
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao salvar preferência. Tente novamente.'
      toast.error(errorMessage)
      // Reverter mudança em caso de erro - recarregar preferências
      try {
        const prefs = await authService.getNotificationPreferences()
        setNotifyGoalsAllTeams(prefs.notifyGoalsAllTeams)
        setNotifyGoalsFavoriteTeam(prefs.notifyGoalsFavoriteTeam ?? true)
        setNotifyRoundBets(prefs.notifyRoundBets)
        setNotifyRanking(prefs.notifyRanking)
        setNotifyBell(prefs.notifyBell ?? true)
        setNotifyToast(prefs.notifyToast ?? true)
        setBellRanking(prefs.bellRanking ?? true)
        setBellFavoriteTeamMatch(prefs.bellFavoriteTeamMatch ?? true)
        setBellGoalsAllTeams(prefs.bellGoalsAllTeams ?? true)
        setBellGoalsFavoriteTeam(prefs.bellGoalsFavoriteTeam ?? true)
        setBellRoundBets(prefs.bellRoundBets ?? true)
        setBellMatchStatusAllTeams(prefs.bellMatchStatusAllTeams ?? true)
        setBellMatchStatusFavoriteTeam(prefs.bellMatchStatusFavoriteTeam ?? true)
        setNotifyMatchStatusAllTeams(prefs.notifyMatchStatusAllTeams ?? true)
        setNotifyMatchStatusFavoriteTeam(prefs.notifyMatchStatusFavoriteTeam ?? true)
      } catch (reloadError) {
        console.error('Erro ao recarregar preferências:', reloadError)
      }
    }
  }

  const handleTestSupport = async () => {
    setTestingSupport(true)
    try {
      console.log('[TestSupport] 🔍 Iniciando teste de suporte...')

      // Verificar condições básicas
      const hasServiceWorker = 'serviceWorker' in navigator
      const hasPushManager = 'PushManager' in window
      const hasNotificationAPI = 'Notification' in window
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as any).standalone === true
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'

      console.log('[TestSupport] Condições:', {
        hasServiceWorker,
        hasPushManager,
        hasNotificationAPI,
        isIOS,
        isPWA,
        isSecure,
        userAgent: navigator.userAgent.substring(0, 60),
        currentPermission: hasNotificationAPI ? Notification.permission : 'N/A'
      })

      // Verificações essenciais
      if (!isSecure) {
        toast.error('❌ HTTPS é necessário para notificações push.')
        return
      }

      if (!hasNotificationAPI) {
        toast.error('❌ API de Notificações não disponível neste navegador.')
        return
      }

      if (!hasServiceWorker) {
        toast.error('❌ Service Worker não suportado neste navegador.')
        return
      }

      // Verificar/registrar service worker
      let registration: ServiceWorkerRegistration | null = null
      
      const registrations = await navigator.serviceWorker.getRegistrations()
      console.log('[TestSupport] Service Workers registrados:', registrations.length)

      if (registrations.length > 0) {
        registration = registrations[0]
        console.log('[TestSupport] SW encontrado:', {
          scope: registration.scope,
          active: !!registration.active,
          hasPushManager: !!registration.pushManager
        })
      } else {
        console.log('[TestSupport] Registrando service worker...')
        try {
          registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
          console.log('[TestSupport] SW registrado:', registration.scope)
          await new Promise(resolve => setTimeout(resolve, 1500))
        } catch (regError: any) {
          console.error('[TestSupport] Erro ao registrar SW:', regError)
          toast.error('❌ Erro ao registrar Service Worker: ' + regError.message)
          return
        }
      }

      // Aguardar SW ficar pronto
      console.log('[TestSupport] Aguardando SW ficar pronto...')
      registration = await navigator.serviceWorker.ready
      console.log('[TestSupport] SW pronto, PushManager:', !!registration.pushManager)

      if (registration.pushManager) {
        toast.success('✅ Push Notifications totalmente suportado!')
        setTimeout(() => window.location.reload(), 1500)
      } else if (isIOS && isPWA) {
        // iOS PWA pode ter suporte parcial
        toast.info('📱 iOS PWA detectado. Suporte pode estar disponível. Tente ativar notificações.')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error('❌ PushManager não disponível. Notificações push não são suportadas.')
      }
    } catch (error: any) {
      console.error('[TestSupport] Erro:', error)
      toast.error('Erro no teste: ' + (error?.message || 'Erro desconhecido'))
    } finally {
      setTestingSupport(false)
    }
  }

  const handleTogglePushNotifications = async () => {
    console.log('[NotificationSettings] Toggle push notifications clicked')
    console.log('[NotificationSettings] Current state - subscribed:', isPushSubscribed, 'permission:', pushPermission)
    
    try {
      if (isPushSubscribed) {
        // Desativar notificações
        const success = await unsubscribePush()
        if (success) {
          toast.success('Notificações push desativadas!')
        } else {
          toast.error('Erro ao desativar notificações push.')
        }
      } else {
        // Ativar notificações
        // IMPORTANTE: No iOS, NÃO verificar pushPermission antes de tentar
        // O estado pode estar incorreto e a permissão será solicitada durante o subscribe
        
        // Verificar permissão atual DIRETAMENTE do navegador
        const currentPermission = 'Notification' in window ? Notification.permission : 'denied'
        console.log('[NotificationSettings] Current browser permission:', currentPermission)
        
        // Se está 'denied' E não é iOS PWA, mostrar mensagem
        // No iOS PWA, o estado pode estar errado, então tentamos mesmo assim
        const isIOSPWA = (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
                        (window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true)
        
        if (currentPermission === 'denied' && !isIOSPWA) {
          toast.error('Permissão negada. Vá nas configurações do navegador para permitir notificações.')
          return
        }

        // Fazer subscribe - a função vai solicitar permissão internamente se necessário
        // IMPORTANTE: Esta chamada DEVE ser direta, não pode ter delays ou outras async calls antes
        console.log('[NotificationSettings] Calling subscribePush...')
        const success = await subscribePush()
        
        if (success) {
          toast.success('🔔 Notificações push ativadas!')
        } else {
          // Verificar o motivo da falha
          const newPermission = 'Notification' in window ? Notification.permission : 'unknown'
          console.log('[NotificationSettings] Subscribe failed, permission now:', newPermission)
          
          if (newPermission === 'denied') {
            toast.error('Permissão negada. Vá nas configurações do navegador para permitir notificações.')
          } else if (newPermission === 'default') {
            toast.error('Permissão não foi solicitada. Tente novamente.')
          } else {
            toast.error('Erro ao ativar notificações push. Verifique o console.')
          }
        }
      }
    } catch (error: any) {
      console.error('[NotificationSettings] Error managing notifications:', error)
      toast.error('Erro: ' + (error?.message || 'Erro desconhecido'))
    }
  }


  return (
    <ContentWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full h-10 w-10 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Notificações</h1>
          </div>
        </div>

        {/* Ativar Notificações Push */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPushSubscribed ? (
                <BellRing className="h-5 w-5 text-green-500" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <h2 className="text-base font-semibold">Notificações Push</h2>
                <p className="text-xs text-muted-foreground">
                  {isPushSubscribed ? 'Ativado' : effectivePushSupported ? 'Desativado' : 'Não suportado'}
                </p>
              </div>
            </div>
            {effectivePushSupported ? (
              <Button
                variant={isPushSubscribed ? "outline" : "primary"}
                size="sm"
                onClick={handleTogglePushNotifications}
                disabled={pushLoading}
                className="min-w-[100px]"
              >
                {pushLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Aguarde...
                  </>
                ) : isPushSubscribed ? (
                  <>
                    <BellOff className="h-4 w-4 mr-2" />
                    Desativar
                  </>
                ) : (
                  <>
                    <BellRing className="h-4 w-4 mr-2" />
                    Ativar
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSupport}
                disabled={testingSupport}
                className="text-xs"
              >
                {testingSupport ? (
                  <>
                    <div className="h-3 w-3 border border-current border-t-transparent rounded-full animate-spin mr-1" />
                    Testando...
                  </>
                ) : (
                  'Testar Suporte'
                )}
              </Button>
            )}
          </div>
          {isMobile && !effectivePushSupported && (
            <div className="mt-3 text-xs text-muted-foreground">
              💡 Instale como app para receber notificações push
            </div>
          )}
        </Card>

        {/* Quando o App está Fechado (Push) */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Quando o App está Fechado</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Início/Encerramento de Palpites</p>
              <Switch
                checked={notifyRoundBets}
                onCheckedChange={async (checked) => {
                  setNotifyRoundBets(checked)
                  await savePreference({ notifyRoundBets: checked })
                }}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Ranking</p>
              <Switch
                checked={notifyRanking}
                onCheckedChange={async (checked) => {
                  setNotifyRanking(checked)
                  await savePreference({ notifyRanking: checked })
                }}
                disabled={isLoading}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Notificações de Gol</p>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Todos os Times</p>
                  <Switch
                    checked={notifyGoalsAllTeams}
                    onCheckedChange={async (checked) => {
                      setNotifyGoalsAllTeams(checked)
                      await savePreference({ notifyGoalsAllTeams: checked })
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Meu Time {favoriteTeam && favoriteTeam.trim() !== '' ? `(${getTeamDisplayName(favoriteTeam)})` : ''}
                  </p>
                  <Switch
                    checked={notifyGoalsFavoriteTeam}
                    onCheckedChange={async (checked) => {
                      setNotifyGoalsFavoriteTeam(checked)
                      await savePreference({ notifyGoalsFavoriteTeam: checked })
                    }}
                    disabled={isLoading || notifyGoalsAllTeams}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Status de Confrontos</p>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Todos os Times</p>
                  <Switch
                    checked={notifyMatchStatusAllTeams}
                    onCheckedChange={async (checked) => {
                      setNotifyMatchStatusAllTeams(checked)
                      await savePreference({ notifyMatchStatusAllTeams: checked })
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Meu Time {favoriteTeam && favoriteTeam.trim() !== '' ? `(${getTeamDisplayName(favoriteTeam)})` : ''}
                  </p>
                  <Switch
                    checked={notifyMatchStatusFavoriteTeam}
                    onCheckedChange={async (checked) => {
                      setNotifyMatchStatusFavoriteTeam(checked)
                      await savePreference({ notifyMatchStatusFavoriteTeam: checked })
                    }}
                    disabled={isLoading || notifyMatchStatusAllTeams}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Quando o App está Aberto */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Quando o App está Aberto</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Início/Encerramento de Palpites</p>
              <Switch
                checked={bellRoundBets}
                onCheckedChange={async (checked) => {
                  setBellRoundBets(checked)
                  await savePreference({ bellRoundBets: checked })
                }}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Ranking</p>
              <Switch
                checked={bellRanking}
                onCheckedChange={async (checked) => {
                  setBellRanking(checked)
                  await savePreference({ bellRanking: checked })
                }}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Jogo do {favoriteTeam && favoriteTeam.trim() !== '' ? getTeamDisplayName(favoriteTeam) : 'Meu Time'} Iniciar
              </p>
              <Switch
                checked={bellFavoriteTeamMatch}
                onCheckedChange={async (checked) => {
                  setBellFavoriteTeamMatch(checked)
                  await savePreference({ bellFavoriteTeamMatch: checked })
                }}
                disabled={isLoading}
              />
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Status de Confrontos</p>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Todos os Times</p>
                  <Switch
                    checked={bellMatchStatusAllTeams}
                    onCheckedChange={async (checked) => {
                      setBellMatchStatusAllTeams(checked)
                      await savePreference({ bellMatchStatusAllTeams: checked })
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Meu Time {favoriteTeam && favoriteTeam.trim() !== '' ? `(${getTeamDisplayName(favoriteTeam)})` : ''}
                  </p>
                  <Switch
                    checked={bellMatchStatusFavoriteTeam}
                    onCheckedChange={async (checked) => {
                      setBellMatchStatusFavoriteTeam(checked)
                      await savePreference({ bellMatchStatusFavoriteTeam: checked })
                    }}
                    disabled={isLoading || bellMatchStatusAllTeams}
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-3">Notificar Gol</p>
              <div className="space-y-3 pl-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Todos os Times</p>
                  <Switch
                    checked={bellGoalsAllTeams}
                    onCheckedChange={async (checked) => {
                      setBellGoalsAllTeams(checked)
                      await savePreference({ bellGoalsAllTeams: checked })
                    }}
                    disabled={isLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Meu Time {favoriteTeam && favoriteTeam.trim() !== '' ? `(${getTeamDisplayName(favoriteTeam)})` : ''}
                  </p>
                  <Switch
                    checked={bellGoalsFavoriteTeam}
                    onCheckedChange={async (checked) => {
                      setBellGoalsFavoriteTeam(checked)
                      await savePreference({ bellGoalsFavoriteTeam: checked })
                    }}
                    disabled={isLoading || bellGoalsAllTeams}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

      </div>
    </ContentWrapper>
  )
}