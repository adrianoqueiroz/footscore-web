import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, Save, BellOff, BellRing, Bug, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Switch from '@/components/ui/Switch'
import { authService } from '@/services/auth.service'
import { useToastContext } from '@/contexts/ToastContext'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import ContentWrapper from '@/components/ui/ContentWrapper'
import { getTeamDisplayName } from '@/lib/teamNames'

// Hook para capturar console.log para debug mobile
function useDebugLogs() {
  const [logs, setLogs] = useState<string[]>([])
  const originalConsoleLog = useRef<typeof console.log>()

  useEffect(() => {
    // Salvar o console.log original
    originalConsoleLog.current = console.log

    // Override console.log para capturar logs do PushNotifications
    const newConsoleLog = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ')
      
      // Filtrar apenas logs de PushNotifications
      if (message.includes('[PushNotifications]') || message.includes('[TestSupport]')) {
        setLogs(prev => [...prev.slice(-50), `${new Date().toLocaleTimeString()}: ${message}`])
      }
      
      // Chamar o original
      originalConsoleLog.current?.apply(console, args)
    }

    console.log = newConsoleLog

    return () => {
      // Restaurar console.log original
      if (originalConsoleLog.current) {
        console.log = originalConsoleLog.current
      }
    }
  }, [])

  const clearLogs = () => setLogs([])

  return { logs, clearLogs }
}

export default function NotificationSettings() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const { logs, clearLogs } = useDebugLogs()
  const [showDebug, setShowDebug] = useState(false)

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
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null)
  const [notifyRoundBets, setNotifyRoundBets] = useState(true)
  const [notifyRanking, setNotifyRanking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSupport, setTestingSupport] = useState(false)

  // Detectar ambiente iOS PWA
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true
  const isIOSPWA = isIOS && isPWA

  // Suporte efetivo - iOS PWA pode ter suporte mesmo se não detectado inicialmente
  const effectivePushSupported = pushSupported || isIOSPWA

  // Lista de times (Série A)
  const TEAMS = [
    'Flamengo', 'Palmeiras', 'Corinthians', 'Sao Paulo', 'Fluminense',
    'Vasco', 'Atletico-MG', 'Cruzeiro', 'Internacional', 'Gremio',
    'Santos', 'Botafogo', 'Athletico-PR', 'Bahia', 'Fortaleza',
    'Ceara', 'Sport', 'Goias', 'Coritiba', 'America-MG',
    'Bragantino', 'Cuiaba', 'Juventude', 'Vitoria'
  ].sort()

  useEffect(() => {
    // Carregar preferências de notificação
    authService.getNotificationPreferences()
      .then(prefs => {
        setNotifyGoalsAllTeams(prefs.notifyGoalsAllTeams)
        setFavoriteTeam(prefs.favoriteTeam)
        setNotifyRoundBets(prefs.notifyRoundBets)
        setNotifyRanking(prefs.notifyRanking)
      })
      .catch(error => {
        console.error('Erro ao carregar preferências de notificação:', error)
      })
  }, [])

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

  const handleSave = async () => {
    setSaving(true)
    try {
      await authService.updateNotificationPreferences({
        notifyGoals: true, // Sempre true já que não há mais toggle principal
        notifyGoalsAllTeams,
        favoriteTeam, // Manter o favoriteTeam mesmo quando "Todos" está ligado (preferência do usuário)
        notifyRoundBets,
        notifyRanking
      })
      toast.success('Preferências de notificação atualizadas com sucesso!')
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao atualizar preferências. Tente novamente.'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
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
            <h1 className="text-2xl font-bold">Preferências de Notificação</h1>
            <p className="text-sm text-muted-foreground">Configure quando deseja receber notificações</p>
          </div>
        </div>

        {/* Controle Principal de Notificações Push */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isPushSubscribed ? (
                  <BellRing className="h-5 w-5 text-green-500" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                <p className="font-medium text-sm">Notificações Push</p>
              </div>
                <p className="text-xs text-muted-foreground">
                  {isPushSubscribed
                    ? 'Notificações push estão ativadas. Você receberá notificações no seu dispositivo.'
                    : effectivePushSupported
                      ? 'Ative as notificações push para receber alertas no seu dispositivo.'
                      : 'Notificações push não são totalmente suportadas neste navegador. Funcionalidade limitada.'
                  }
                </p>
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
              <div className="flex flex-col gap-2">
                <div className="text-xs text-muted-foreground px-3 py-2 bg-muted rounded-md">
                  Não suportado
                </div>
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
              </div>
            )}
          </div>
        </Card>

        {/* Configurações de Notificação */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Preferências de Notificação</h2>
          </div>

          {/* Aviso quando notificações push não estão ativas */}
          {!isPushSubscribed && !effectivePushSupported && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Notificações push não são totalmente suportadas neste navegador. Você ainda pode configurar preferências, mas pode não receber notificações push.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* 1. Início/Encerramento de Palpites */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">Início/Encerramento de Palpites</p>
                <p className="text-xs text-muted-foreground">Receber notificações quando rodadas começarem ou pararem de aceitar palpites</p>
              </div>
              <Switch
                checked={notifyRoundBets}
                onCheckedChange={setNotifyRoundBets}
              />
            </div>

            {/* 2. Notificações de Ranking */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">Notificações de Ranking</p>
                <p className="text-xs text-muted-foreground">Receber notificações quando seus tickets entrarem no ranking</p>
              </div>
              <Switch
                checked={notifyRanking}
                onCheckedChange={setNotifyRanking}
              />
            </div>

            {/* Divisor */}
            <div className="border-t border-border pt-4"></div>

            {/* 3. Notificações de Gol - Título sem toggle */}
            <div>
              <p className="font-medium text-sm mb-1">Notificações de Gol</p>
              <p className="text-xs text-muted-foreground mb-4">Receber notificações quando houver gols</p>

              <div className="space-y-3 pl-2">
                {/* Todos */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Todos</p>
                    <p className="text-xs text-muted-foreground">Receber notificações de gols de todos os times</p>
                  </div>
                  <Switch
                    checked={notifyGoalsAllTeams}
                    onCheckedChange={(checked) => {
                      setNotifyGoalsAllTeams(checked)
                    }}
                  />
                </div>

                {/* Time do Coração */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Time do Coração</p>
                    <p className="text-xs text-muted-foreground">
                      Receber notificações do seu time do coração
                    </p>
                  </div>
                  <Switch
                    checked={favoriteTeam !== null}
                    onCheckedChange={(checked) => {
                      if (!notifyGoalsAllTeams) {
                        if (checked) {
                          // Se ativou mas não tem time selecionado, selecionar o primeiro
                          if (!favoriteTeam) {
                            setFavoriteTeam(TEAMS[0] || null)
                          }
                        } else {
                          setFavoriteTeam(null)
                        }
                      }
                    }}
                    disabled={notifyGoalsAllTeams}
                  />
                </div>

                {/* Seletor de time - sempre visível */}
                <div>
                  <select
                    value={favoriteTeam || ''}
                    onChange={(e) => setFavoriteTeam(e.target.value || null)}
                    disabled={notifyGoalsAllTeams}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Selecione um time</option>
                    {TEAMS.map(team => (
                      <option key={team} value={team}>
                        {getTeamDisplayName(team)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Botão de Salvar */}
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Preferências'}
        </Button>

        {/* Painel de Debug (para dispositivos móveis) */}
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="w-full text-xs"
          >
            <Bug className="h-3 w-3 mr-1" />
            {showDebug ? 'Esconder Debug' : 'Mostrar Debug'}
          </Button>
        </div>

        {showDebug && (
          <Card className="p-3 mt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Debug Info</h3>
              <Button variant="outline" size="sm" onClick={clearLogs} className="text-xs h-6 px-2">
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            </div>

            {/* Status atual */}
            <div className="text-xs space-y-1 mb-3 p-2 bg-muted rounded">
              <div><strong>Suportado:</strong> {pushSupported ? '✅' : '❌'}</div>
              <div><strong>Permissão:</strong> {pushPermission}</div>
              <div><strong>Inscrito:</strong> {isPushSubscribed ? '✅' : '❌'}</div>
              <div><strong>iOS:</strong> {isIOS ? '✅' : '❌'}</div>
              <div><strong>PWA:</strong> {isPWA ? '✅' : '❌'}</div>
              <div><strong>Notification API:</strong> {'Notification' in window ? '✅' : '❌'}</div>
              <div><strong>ServiceWorker:</strong> {'serviceWorker' in navigator ? '✅' : '❌'}</div>
              <div><strong>PushManager:</strong> {'PushManager' in window ? '✅' : '❌'}</div>
            </div>

            {/* Logs */}
            <div className="text-xs">
              <div className="font-semibold mb-1">Logs ({logs.length}):</div>
              <div className="max-h-48 overflow-y-auto bg-black/80 text-green-400 p-2 rounded font-mono text-[10px] leading-tight">
                {logs.length === 0 ? (
                  <div className="text-gray-500">Nenhum log ainda. Clique em Ativar para ver logs.</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="mb-1 border-b border-gray-800 pb-1">{log}</div>
                  ))
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </ContentWrapper>
  )
}