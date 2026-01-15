import { useEffect, useState } from 'react'
import { useMatchEvents } from './useMatchEvents'
import { useNotifications } from '@/contexts/NotificationContext'
import { notificationService } from '@/services/notification.service'
import { authService } from '@/services/auth.service'

/**
 * Hook que escuta eventos SSE e adiciona notificações ao sininho
 *
 * SISTEMA CENTRALIZADO DE NOTIFICAÇÕES:
 * - SSE (sininho): Processado aqui no frontend
 * - Push Notifications: Enviadas pelo backend via eventService.sendNotification()
 * - Toast: Via notificationService.showToast()
 *
 * Deve ser usado no nível mais alto da aplicação (no router)
 */
export function useNotificationListener() {
  const { addNotification } = useNotifications()
  const [preferences, setPreferences] = useState<{
    bellGoalsAllTeams: boolean
    bellGoalsFavoriteTeam: boolean
  } | null>(null)
  const user = authService.getCurrentUser()
  const favoriteTeam = user?.favoriteTeam || null

  // Carregar preferências
  useEffect(() => {
    authService.getNotificationPreferences().then(prefs => {
      setPreferences({
        bellGoalsAllTeams: prefs.bellGoalsAllTeams ?? true,
        bellGoalsFavoriteTeam: prefs.bellGoalsFavoriteTeam ?? true
      })
    }).catch(() => {
      setPreferences({
        bellGoalsAllTeams: true,
        bellGoalsFavoriteTeam: true
      })
    })
  }, [])

  // Escutar eventos de atualizações
  useMatchEvents((event) => {
    if (event.type === 'score_update' && event.data.scoreChanged && !event.data.isGoalCancelled) {
      // Verificar se deve mostrar no sininho
      if (!preferences) return // Aguardar preferências carregarem
      
      const { homeTeam, awayTeam, goalScorer } = event.data
      const isFavoriteTeamPlaying = favoriteTeam && (homeTeam === favoriteTeam || awayTeam === favoriteTeam)
      
      // Verificar se deve notificar
      const shouldNotifyAll = preferences.bellGoalsAllTeams
      const shouldNotifyFavorite = preferences.bellGoalsFavoriteTeam && isFavoriteTeamPlaying
      
      if (shouldNotifyAll || shouldNotifyFavorite) {
        const teamName = goalScorer === 'home' ? homeTeam : awayTeam
        addNotification({
          title: '⚽ Gol!',
          body: `${teamName} marcou! ${homeTeam} ${event.data.homeScore} x ${event.data.awayScore} ${awayTeam}`,
          type: 'goal',
          data: {
            matchId: event.data.matchId,
            round: event.data.round,
            homeTeam,
            awayTeam,
            homeScore: event.data.homeScore,
            awayScore: event.data.awayScore,
            goalScorer
          }
        })
      }
    } else if (event.type === 'round_bets_status') {
      // Notificação quando rodada começa ou para de aceitar palpites
      const { round, allowsNewBets, isBlocked } = event.data
      
      let title = ''
      let body = ''
      
      if (allowsNewBets) {
        title = '✅ Rodada Aceitando Palpites!'
        body = `A rodada ${round} está aceitando palpites agora!`
      } else {
        title = '🔒 Rodada Bloqueada!'
        body = isBlocked 
          ? `A rodada ${round} foi bloqueada automaticamente (30 min antes do primeiro jogo)`
          : `A rodada ${round} não está mais aceitando palpites`
      }

      addNotification({
        title,
        body,
        type: 'round_bets_status',
        data: {
          round,
          allowsNewBets,
          isBlocked
        }
      })
    } else if (event.type === 'ranking_winner') {
      // Notificação quando ticket é vencedor
      const { round, ticketId, position, points } = event.data
      
      addNotification({
        title: '🏆 Você é o Vencedor!',
        body: `Parabéns! Seu ticket está em 1º lugar na rodada ${round} com ${points} pontos!`,
        type: 'ranking_winner',
        data: {
          round,
          ticketId,
          position,
          points
        }
      })
    } else if (event.type === 'ranking_top_n') {
      // Notificação quando ticket entra no top N
      const { round, ticketId, position, points, topN } = event.data
      
      addNotification({
        title: `🎯 Você está no Top ${topN}!`,
        body: `Seu ticket está em ${position}º lugar na rodada ${round} com ${points} pontos!`,
        type: 'ranking_top_n',
        data: {
          round,
          ticketId,
          position,
          points,
          topN
        }
      })
    } else if (event.type === 'round_finished') {
      // Notificação de rodada finalizada será tratada no backend com push notification
      // Não adicionar aqui no sininho, apenas escutar para atualizar UI se necessário
    }
  })

  // Este hook não retorna nada, apenas escuta eventos
  return null
}
