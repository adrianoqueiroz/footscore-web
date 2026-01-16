import { useEffect, useState, useRef, useCallback } from 'react'
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
    bellRoundBets: boolean
    bellMatchStatusAllTeams: boolean
    bellMatchStatusFavoriteTeam: boolean
    bellRanking: boolean
  } | null>(null)
  const user = authService.getCurrentUser()
  const favoriteTeam = user?.favoriteTeam || null
  
  // Cache para evitar notificações duplicadas (matchId + status)
  const processedNotificationsRef = useRef<Set<string>>(new Set())
  
  // Ref para manter referência estável do addNotification
  const addNotificationRef = useRef(addNotification)
  useEffect(() => {
    addNotificationRef.current = addNotification
  }, [addNotification])

  // Carregar preferências
  useEffect(() => {
    authService.getNotificationPreferences().then(prefs => {
      setPreferences({
        bellRoundBets: prefs.bellRoundBets ?? true,
        bellMatchStatusAllTeams: prefs.bellMatchStatusAllTeams ?? true,
        bellMatchStatusFavoriteTeam: prefs.bellMatchStatusFavoriteTeam ?? true,
        bellRanking: prefs.bellRanking ?? true
      })
    }).catch(() => {
      setPreferences({
        bellRoundBets: true,
        bellMatchStatusAllTeams: true,
        bellMatchStatusFavoriteTeam: true,
        bellRanking: true
      })
    })
  }, [])

  // Callback memoizado para processar eventos
  const handleEvent = useCallback((event: any) => {
    // Notificações de gol NÃO vão para o sininho, apenas bolinha na tela
    // (removido código que adicionava gols ao sininho)
    
    if (event.type === 'round_bets_status') {
      // Notificação quando rodada começa ou para de aceitar palpites
      if (!preferences) return // Aguardar preferências carregarem
      
      // Só mostrar se bellRoundBets estiver habilitado
      if (!preferences.bellRoundBets) return
      
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

      addNotificationRef.current({
        title,
        body,
        type: 'round_bets_status',
        data: {
          round,
          allowsNewBets,
          isBlocked
        }
      })
    } else if (event.type === 'match_status_update') {
      // Notificação de status de confrontos (ao vivo/finalizado)
      if (!preferences) return // Aguardar preferências carregarem
      
      const { homeTeam, awayTeam, status, round, matchId } = event.data
      
      // Criar chave única para evitar duplicatas (matchId + status)
      const notificationKey = `${matchId}-${status}`
      
      // Verificar se já processamos esta notificação
      if (processedNotificationsRef.current.has(notificationKey)) {
        console.log('[useNotificationListener] Notificação duplicada ignorada:', notificationKey)
        return
      }
      
      // Marcar como processada
      processedNotificationsRef.current.add(notificationKey)
      
      // Limpar cache antigo após 5 minutos para permitir notificações futuras do mesmo jogo
      setTimeout(() => {
        processedNotificationsRef.current.delete(notificationKey)
      }, 5 * 60 * 1000)
      
      const isFavoriteTeamPlaying = favoriteTeam && (homeTeam === favoriteTeam || awayTeam === favoriteTeam)
      
      // Verificar se deve notificar baseado nas preferências
      // IMPORTANTE: Enviar apenas UMA notificação por confronto, não uma por time
      const shouldNotifyAll = preferences.bellMatchStatusAllTeams
      const shouldNotifyFavorite = preferences.bellMatchStatusFavoriteTeam && isFavoriteTeamPlaying
      
      if (!shouldNotifyAll && !shouldNotifyFavorite) return
      
      // Só notificar mudanças para 'live' ou 'finished'
      if (status === 'live') {
        addNotificationRef.current({
          title: '🔴 Jogo ao Vivo!',
          body: `${homeTeam} x ${awayTeam} começou!`,
          type: 'match_status',
          data: {
            matchId,
            round,
            homeTeam,
            awayTeam,
            status
          }
        })
      } else if (status === 'finished' || status === 'FINISHED') {
        addNotificationRef.current({
          title: '🏁 Jogo Finalizado!',
          body: `${homeTeam} x ${awayTeam} terminou!`,
          type: 'match_status',
          data: {
            matchId,
            round,
            homeTeam,
            awayTeam,
            status
          }
        })
      }
    } else if (event.type === 'ranking_winner') {
      // Notificação quando ticket é vencedor
      if (!preferences) return // Aguardar preferências carregarem
      
      // Só mostrar se bellRanking estiver habilitado
      if (!preferences.bellRanking) return
      
      const { round, ticketId, position, points } = event.data
      
      addNotificationRef.current({
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
      if (!preferences) return // Aguardar preferências carregarem
      
      // Só mostrar se bellRanking estiver habilitado
      if (!preferences.bellRanking) return
      
      const { round, ticketId, position, points, topN } = event.data
      
      addNotificationRef.current({
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
  }, [preferences, favoriteTeam])

  // Escutar eventos de atualizações
  useMatchEvents(handleEvent)

  // Este hook não retorna nada, apenas escuta eventos
  return null
}
