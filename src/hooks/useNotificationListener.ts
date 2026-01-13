import { useEffect } from 'react'
import { useMatchEvents } from './useMatchEvents'
import { useNotifications } from '@/contexts/NotificationContext'

/**
 * Hook que escuta eventos SSE e adiciona notificações automaticamente
 * Deve ser usado no nível mais alto da aplicação (no router)
 */
export function useNotificationListener() {
  const { addNotification } = useNotifications()

  // Escutar eventos de gols e atualizações
  useMatchEvents((event) => {
    if (event.type === 'score_update' && event.data.scoreChanged) {
      // Adicionar notificação de gol
      const goalScorer = event.data.goalScorer
      const homeTeam = event.data.homeTeam
      const awayTeam = event.data.awayTeam
      const homeScore = event.data.homeScore
      const awayScore = event.data.awayScore
      const isGoalCancelled = event.data.isGoalCancelled || false

      let title = '⚽ Gol!'
      let body = `${homeTeam} ${homeScore} x ${awayScore} ${awayTeam}`

      if (goalScorer === 'home') {
        title = isGoalCancelled 
          ? `❌ Gol do ${homeTeam} anulado!`
          : `⚽ Gol do ${homeTeam}!`
      } else if (goalScorer === 'away') {
        title = isGoalCancelled
          ? `❌ Gol do ${awayTeam} anulado!`
          : `⚽ Gol do ${awayTeam}!`
      }

      addNotification({
        title,
        body,
        type: 'goal',
        data: {
          matchId: event.data.matchId,
          round: event.data.round,
          homeTeam,
          awayTeam,
          homeScore,
          awayScore,
          goalScorer,
          isGoalCancelled
        }
      })
    } else if (event.type === 'round_finished') {
      // Adicionar notificação de rodada finalizada
      addNotification({
        title: '🏆 Rodada Finalizada!',
        body: `A rodada ${event.data.round} foi finalizada`,
        type: 'round_finished',
        data: {
          round: event.data.round
        }
      })
    } else if (event.type === 'match_status_update') {
      // Adicionar notificação de mudança de status do jogo
      const status = event.data.status
      let title = '📊 Atualização de Jogo'
      let body = `${event.data.homeTeam} x ${event.data.awayTeam}`

      if (status === 'live') {
        title = '🔴 Jogo ao Vivo!'
        body = `${event.data.homeTeam} ${event.data.homeScore ?? 0} x ${event.data.awayScore ?? 0} ${event.data.awayTeam}`
      } else if (status === 'finished') {
        title = '✅ Jogo Finalizado'
        body = `${event.data.homeTeam} ${event.data.homeScore ?? 0} x ${event.data.awayScore ?? 0} ${event.data.awayTeam}`
      }

      addNotification({
        title,
        body,
        type: 'match_status',
        data: {
          matchId: event.data.matchId,
          round: event.data.round,
          homeTeam: event.data.homeTeam,
          awayTeam: event.data.awayTeam,
          homeScore: event.data.homeScore,
          awayScore: event.data.awayScore
        }
      })
    }
  })

  // Este hook não retorna nada, apenas escuta eventos
  return null
}
