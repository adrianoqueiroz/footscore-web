import { useEffect } from 'react'
import { useMatchEvents } from './useMatchEvents'
import { useNotifications } from '@/contexts/NotificationContext'

/**
 * Hook que escuta eventos SSE e adiciona notificações automaticamente
 * Deve ser usado no nível mais alto da aplicação (no router)
 */
export function useNotificationListener() {
  const { addNotification } = useNotifications()

  // Escutar eventos de atualizações
  useMatchEvents((event) => {
    if (event.type === 'score_update' && event.data.scoreChanged) {
      // Adicionar notificação de gol (backend já filtra por preferências)
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
