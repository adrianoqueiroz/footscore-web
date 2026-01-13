import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Switch from '@/components/ui/Switch'
import { authService } from '@/services/auth.service'
import { useToastContext } from '@/contexts/ToastContext'
import ContentWrapper from '@/components/ui/ContentWrapper'
import { getTeamDisplayName } from '@/lib/teamNames'

export default function NotificationSettings() {
  const navigate = useNavigate()
  const toast = useToastContext()

  // Preferências de notificação
  const [notifyGoalsAllTeams, setNotifyGoalsAllTeams] = useState(true)
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null)
  const [notifyRoundBets, setNotifyRoundBets] = useState(true)
  const [notifyRanking, setNotifyRanking] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [loading, setLoading] = useState(true)

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
    setLoading(true)
    authService.getNotificationPreferences()
      .then(prefs => {
        setNotifyGoalsAllTeams(prefs.notifyGoalsAllTeams)
        setFavoriteTeam(prefs.favoriteTeam)
        setNotifyRoundBets(prefs.notifyRoundBets)
        setNotifyRanking(prefs.notifyRanking)
      })
      .catch(error => {
        console.error('Erro ao carregar preferências:', error)
        toast.error('Erro ao carregar preferências de notificação')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [toast])

  const handleSaveNotificationPreferences = async () => {
    setSavingPreferences(true)
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
      setSavingPreferences(false)
    }
  }

  if (loading) {
    return (
      <ContentWrapper>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Carregando preferências...</p>
          </div>
        </div>
      </ContentWrapper>
    )
  }

  return (
    <ContentWrapper>
      <div className="space-y-4">
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
            <p className="text-sm text-muted-foreground">Configure suas preferências de notificação</p>
          </div>
        </div>

        {/* Preferências de Notificação */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Preferências de Notificação</h2>
          </div>

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

          <Button
            variant="primary"
            size="lg"
            onClick={handleSaveNotificationPreferences}
            disabled={savingPreferences}
            className="w-full mt-4"
          >
            <Save className="h-4 w-4 mr-2" />
            {savingPreferences ? 'Salvando...' : 'Salvar Preferências'}
          </Button>
        </Card>
      </div>
    </ContentWrapper>
  )
}
