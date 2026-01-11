import { useEffect, useRef, useState, useCallback } from 'react'

interface ScoreUpdateEvent {
  type: 'score_update'
  data: {
    matchId: string
    homeScore: number
    awayScore: number
    homeTeam: string
    awayTeam: string
    homeTeamLogo?: string | null
    awayTeamLogo?: string | null
    round: number
    status: string
    scoreChanged: boolean
    goalScorer: 'home' | 'away' | null
    isGoalCancelled?: boolean
    previousHomeScore: number | null
    previousAwayScore: number | null
  }
  timestamp: string
}

interface RoundFinishedEvent {
  type: 'round_finished'
  data: {
    round: number
  }
  timestamp: string
}

interface RoundUnfinishedEvent {
  type: 'round_unfinished'
  data: {
    round: number
  }
  timestamp: string
}

interface RoundStatusUpdateEvent {
  type: 'round_status_update'
  data: {
    round: number
    isFinished: boolean
    hasLiveMatches: boolean
    hasScheduledMatches: boolean
    allMatchesScheduled: boolean
  }
  timestamp: string
}

interface MatchStatusUpdateEvent {
  type: 'match_status_update'
  data: {
    matchId: string
    status: string
    homeTeam: string
    awayTeam: string
    round: number
    homeScore?: number
    awayScore?: number
  }
  timestamp: string
}

export type MatchEvent = ScoreUpdateEvent | RoundFinishedEvent | RoundUnfinishedEvent | RoundStatusUpdateEvent | MatchStatusUpdateEvent
type EventHandler = (event: MatchEvent) => void

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

export function useMatchEvents(onScoreUpdate?: EventHandler) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<MatchEvent | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const callbackRef = useRef<EventHandler | undefined>(onScoreUpdate)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000 // 3 segundos

  // Atualizar ref do callback sem causar reconexão
  useEffect(() => {
    callbackRef.current = onScoreUpdate
  }, [onScoreUpdate])

  const connect = useCallback(() => {
    // Evitar múltiplas conexões simultâneas
    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      return
    }

    // Fechar conexão existente se houver
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Limpar timeout de reconexão
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    try {
      const url = `${API_BASE_URL}/matches/events`
      const eventSource = new EventSource(url)

      eventSource.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
      }

      // Usar onmessage para capturar todos os eventos e despachar manualmente
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'match_status_update') {
            const matchStatusUpdateEvent: MatchStatusUpdateEvent = {
              type: 'match_status_update',
              data: data.data,
              timestamp: data.timestamp,
            }
            setLastEvent(matchStatusUpdateEvent)
            if (callbackRef.current) {
              callbackRef.current(matchStatusUpdateEvent)
            }
          } else if (data.type === 'round_status_update') {
            const roundStatusUpdateEvent: RoundStatusUpdateEvent = {
              type: 'round_status_update',
              data: data.data,
              timestamp: data.timestamp,
            }
            setLastEvent(roundStatusUpdateEvent)
            if (callbackRef.current) {
              callbackRef.current(roundStatusUpdateEvent)
            }
          } else {
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro ao processar evento SSE:', error, 'Dados:', event.data)
        }
      }

      // Manter event listeners específicos também para garantir
      eventSource.addEventListener('match_status_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const matchStatusUpdateEvent: MatchStatusUpdateEvent = {
            type: 'match_status_update',
            data: data.data,
            timestamp: data.timestamp,
          }
          setLastEvent(matchStatusUpdateEvent)
          if (callbackRef.current) {
            callbackRef.current(matchStatusUpdateEvent)
          } else {
            console.warn('[useMatchEvents] Callback não disponível para match_status_update')
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro no event listener match_status_update:', error, 'Dados:', event.data)
        }
      })

      eventSource.addEventListener('round_status_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const roundStatusUpdateEvent: RoundStatusUpdateEvent = {
            type: 'round_status_update',
            data: data.data,
            timestamp: data.timestamp,
          }
          setLastEvent(roundStatusUpdateEvent)
          if (callbackRef.current) {
            callbackRef.current(roundStatusUpdateEvent)
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro no event listener round_status_update:', error)
        }
      })

      eventSource.onerror = (error) => {
        const readyState = eventSource.readyState

        // Se a conexão foi fechada ou não conseguiu conectar, tentar reconectar
        if (readyState === EventSource.CLOSED || readyState === EventSource.CONNECTING) {
          setIsConnected(false)

          // Tentar reconectar se não excedeu o limite
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++
            setTimeout(() => {
              connect()
            }, reconnectDelay)
          }
        }
      }

      // Escutar eventos de atualização de placar
      eventSource.addEventListener('score_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const scoreUpdateEvent: ScoreUpdateEvent = {
            type: 'score_update',
            data: data.data,
            timestamp: data.timestamp,
          }

          setLastEvent(scoreUpdateEvent)

          // Chamar callback usando ref (sempre tem a versão mais recente)
          if (callbackRef.current) {
            callbackRef.current(scoreUpdateEvent)
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro ao processar evento:', error)
        }
      })

      // Escutar eventos de rodada finalizada
      eventSource.addEventListener('round_finished', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const roundFinishedEvent: RoundFinishedEvent = {
            type: 'round_finished',
            data: data.data,
            timestamp: data.timestamp,
          }

          setLastEvent(roundFinishedEvent)

          // Chamar callback usando ref (sempre tem a versão mais recente)
          if (callbackRef.current) {
            callbackRef.current(roundFinishedEvent)
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro ao processar evento round_finished:', error)
        }
      })

      // Escutar eventos de rodada que deixou de estar finalizada
      eventSource.addEventListener('round_unfinished', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const roundUnfinishedEvent: RoundUnfinishedEvent = {
            type: 'round_unfinished',
            data: data.data,
            timestamp: data.timestamp,
          }

          setLastEvent(roundUnfinishedEvent)

          // Chamar callback usando ref (sempre tem a versão mais recente)
          if (callbackRef.current) {
            callbackRef.current(roundUnfinishedEvent)
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro ao processar evento round_unfinished:', error)
        }
      })

      // Escutar eventos de atualização completa de status da rodada
      eventSource.addEventListener('round_status_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const roundStatusUpdateEvent: RoundStatusUpdateEvent = {
            type: 'round_status_update',
            data: data.data,
            timestamp: data.timestamp,
          }

          setLastEvent(roundStatusUpdateEvent)

          // Chamar callback usando ref (sempre tem a versão mais recente)
          if (callbackRef.current) {
            callbackRef.current(roundStatusUpdateEvent)
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro ao processar evento round_status_update:', error)
        }
      })

      // Escutar eventos de atualização de status de jogo individual
      eventSource.addEventListener('match_status_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          const matchStatusUpdateEvent: MatchStatusUpdateEvent = {
            type: 'match_status_update',
            data: data.data,
            timestamp: data.timestamp,
          }

          setLastEvent(matchStatusUpdateEvent)

          // Chamar callback usando ref (sempre tem a versão mais recente)
          if (callbackRef.current) {
            callbackRef.current(matchStatusUpdateEvent)
          }
        } catch (error) {
          console.error('[useMatchEvents] Erro ao processar evento match_status_update:', error)
        }
      })

      eventSourceRef.current = eventSource
    } catch (error) {
      console.error('[useMatchEvents] Erro ao criar EventSource:', error)
      setIsConnected(false)
    }
  }, []) // Removido onScoreUpdate das dependências

  useEffect(() => {
    // Conectar com delay maior para não bloquear navegação
    // E apenas se o navegador suporta EventSource
    if (typeof EventSource === 'undefined') {
      console.warn('[useMatchEvents] EventSource não suportado pelo navegador')
      return
    }

    const connectTimeout = setTimeout(() => {
      try {
        connect()
      } catch (error) {
        console.error('[useMatchEvents] Erro ao conectar SSE (não crítico):', error)
        // Não bloquear a aplicação se SSE falhar
      }
    }, 3000) // Aguardar 3 segundos antes de conectar para priorizar navegação


    return () => {
      clearTimeout(connectTimeout)
      // Limpar ao desmontar
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connect])

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
  }
}

