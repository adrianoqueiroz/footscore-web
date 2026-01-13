import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, Save, BellOff, BellRing } from 'lucide-react'
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
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null)
  const [notifyRoundBets, setNotifyRoundBets] = useState(true)
  const [notifyRanking, setNotifyRanking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSupport, setTestingSupport] = useState(false)

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
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

      console.log('[TestSupport] Condições básicas:', {
        hasServiceWorker,
        hasPushManager,
        isIOS,
        userAgent: navigator.userAgent.substring(0, 50) + '...'
      })

      if (hasServiceWorker) {
        try {
          const registration = await navigator.serviceWorker.ready
          const hasPushManagerInRegistration = !!registration.pushManager

          console.log('[TestSupport] Service Worker pronto:', {
            hasPushManagerInRegistration,
            registrationScope: registration.scope
          })

          if (hasPushManagerInRegistration) {
            toast.success('✅ Suporte detectado! Push Notifications disponível.')
            // Forçar refresh da página para recarregar o hook
            setTimeout(() => window.location.reload(), 1000)
          } else if (isIOS) {
            toast.success('📱 iOS detectado. Testando compatibilidade...')
            // Para iOS, tentar mesmo sem PushManager confirmado
            setTimeout(() => window.location.reload(), 1000)
          } else {
            toast.error('❌ PushManager não disponível no service worker.')
          }
        } catch (error) {
          console.error('[TestSupport] Erro ao verificar service worker:', error)
          toast.error('Erro ao verificar service worker: ' + error.message)
        }
      } else {
        toast.error('❌ Service Worker não suportado neste navegador.')
      }
    } catch (error: any) {
      console.error('[TestSupport] Erro geral:', error)
      toast.error('Erro no teste: ' + (error?.message || 'Erro desconhecido'))
    } finally {
      setTestingSupport(false)
    }
  }

  const handleTogglePushNotifications = async () => {
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
        // Verificar permissão atual
        if (pushPermission === 'denied') {
          toast.error('Permissão negada. Vá nas configurações do navegador para permitir notificações.')
          return
        }

        // Se permissão não foi concedida, solicitar
        if (pushPermission !== 'granted') {
          const granted = await requestPushPermission()
          if (!granted) {
            toast.error('Permissão necessária para receber notificações.')
            return
          }
        }

        // Fazer subscribe
        const success = await subscribePush()
        if (success) {
          toast.success('Notificações push ativadas!')
        } else {
          toast.error('Erro ao ativar notificações push.')
        }
      }
    } catch (error: any) {
      console.error('[NotificationSettings] Erro ao gerenciar notificações:', error)
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
                  : pushSupported
                    ? 'Ative as notificações push para receber alertas no seu dispositivo.'
                    : 'Notificações push não são totalmente suportadas neste navegador. Funcionalidade limitada.'
                }
              </p>
            </div>
            {pushSupported ? (
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
          {!isPushSubscribed && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {pushSupported
                  ? '⚠️ As notificações push estão desativadas. Ative-as acima para receber notificações no seu dispositivo.'
                  : '⚠️ Notificações push não são totalmente suportadas neste navegador. Você ainda pode configurar preferências, mas pode não receber notificações push.'
                }
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
      </div>
    </ContentWrapper>
  )
}