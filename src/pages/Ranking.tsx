import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Radio, Info } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import RoundSelector from '@/components/ui/RoundSelector'
import Button from '@/components/ui/Button'
import PulsingBall from '@/components/ui/PulsingBall'
import ContentWrapper from '@/components/ui/ContentWrapper'
import { ticketService } from '@/services/ticket.service'
import { matchService } from '@/services/match.service'
import { authService } from '@/services/auth.service'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePageVisibility } from '@/hooks/usePageVisibility'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Interface para ranking - deve corresponder ao que o backend retorna
interface RankingEntry {
  userId: string
  userName: string
  ticketId: string
  points: number
  position: number
  round: number
  createdAt: string
  confirmedAt?: string
}



type RankingView = 'all' | 'my'

export default function Ranking() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [hasLiveMatches, setHasLiveMatches] = useState(false)
  const [isRoundFinished, setIsRoundFinished] = useState(false)
  const [allMatchesScheduled, setAllMatchesScheduled] = useState(false)
  const [view, setView] = useState<RankingView>('all')
  const [showPulsingBall, setShowPulsingBall] = useState(false)
  const [lastScoreUpdate, setLastScoreUpdate] = useState<{ homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; goalScorer?: 'home' | 'away' | null; isGoalCancelled?: boolean; homeTeamLogo?: string | null; awayTeamLogo?: string | null } | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<{
    bellGoalsAllTeams: boolean
    bellGoalsFavoriteTeam: boolean
  } | null>(null)
  const { rounds, selectedRound, setSelectedRound, loading: roundsLoading, refreshRounds, validateSelection } = useRoundSelector()
  const user = authService.getCurrentUser()
  const showRankingLoading = useDelayedLoading(rankingLoading)

  // Configurar push notifications
  const { subscribe: subscribePush, isSubscribed: isPushSubscribed } = usePushNotifications()

  // Carregar preferências de notificação
  useEffect(() => {
    authService.getNotificationPreferences().then(prefs => {
      setNotificationPreferences({
        bellGoalsAllTeams: prefs.bellGoalsAllTeams ?? true,
        bellGoalsFavoriteTeam: prefs.bellGoalsFavoriteTeam ?? true
      })
    }).catch(() => {
      setNotificationPreferences({
        bellGoalsAllTeams: true,
        bellGoalsFavoriteTeam: true
      })
    })
  }, [])

  // Recarregar dados quando a página volta a ficar visível
  usePageVisibility({
    onVisible: () => {
      if (selectedRound) {
        loadRanking()
        loadMatches()
      }
    },
    reloadOnFocus: true,
    delay: 500,
  })

  // Validar seleção quando rodadas mudam
  useEffect(() => {
    if (rounds.length > 0) {
      validateSelection()
    }
  }, [rounds, validateSelection])

  // Debug: Monitorar mudanças no isRoundFinished
  useEffect(() => {
    // Forçar re-render do componente quando isRoundFinished muda
    setRanking(prev => [...prev])
  }, [isRoundFinished])


  // Verificar status da rodada baseado nos jogos quando o componente monta
  useEffect(() => {
    const checkRoundStatus = async () => {
      if (!selectedRound) return

      try {
        const matchesData = await matchService.getMatchesByRound(selectedRound)
        const includedMatches = matchesData.filter(m => m.includeInRound !== false)
        const allFinished = includedMatches.length > 0 && includedMatches.every(m => m.status === 'finished')


        if (allFinished !== isRoundFinished) {
          setIsRoundFinished(allFinished)
          setTimeout(() => setIsRoundFinished(allFinished), 0)
        }
      } catch (error) {
        console.error('[Ranking] Erro ao verificar status da rodada:', error)
      }
    }

    checkRoundStatus()
  }, [selectedRound, isRoundFinished])


  const updateRankingSilently = useCallback(async (roundFinishedOverride?: boolean) => {
    if (!selectedRound) return

    const useRoundFinished = roundFinishedOverride !== undefined ? roundFinishedOverride : isRoundFinished

    try {

      // Sempre buscar com hideNames=true primeiro (nomes mascarados)
      const rankingData = await ticketService.getRanking(selectedRound, true)

      let processedData = rankingData

      // Se a rodada está finalizada, mostrar nome completo apenas do primeiro lugar (vencedor)
      if (useRoundFinished) {
        // Buscar dados sem hideNames para ter nomes completos de todos
        const fullData = await ticketService.getRanking(selectedRound, false)

        // Combinar: primeiro lugar com nome completo, resto mascarado
        const currentUser = authService.getCurrentUser()
        processedData = rankingData.map(entry => {
          if (entry.position === 1) {
            // Encontrar nome completo no fullData apenas para o primeiro lugar
            const fullEntry = fullData.find(e => e.userId === entry.userId && e.ticketId === entry.ticketId)
            if (fullEntry) {
              return {
                ...entry,
                userName: fullEntry.userName
              }
            }
          }

          // Para posições > 1 ou quando não encontrou no fullData
          // Se não é o próprio usuário, verificar se nome está mascarado
          const isOwnEntry = currentUser && entry.userId === currentUser.id
          if (!isOwnEntry) {
            const isNameMasked = entry.userName.includes('*')

            // Se o nome está mascarado, manter como está
            if (isNameMasked) {
              return entry
            }
          }

          return entry
        })
      }

      // Atualizar o ranking silenciosamente (sem mostrar loading)
      setRanking(processedData)

    } catch (error) {
      console.error('[Ranking] Erro ao atualizar ranking silenciosamente:', error)
      // Em caso de erro, não fazer nada - manter dados atuais
    }
  }, [selectedRound, isRoundFinished]) // Note: isRoundFinished é usado como fallback


  // Conectar ao SSE para receber atualizações de placar
  useMatchEvents((event) => {
    // Só processar eventos se houver uma rodada selecionada
    if (!selectedRound) {
      return
    }


    if (event.type === 'score_update') {
      // Para eventos de placar, só atualizar ranking se o placar realmente mudou
      const eventRound = Number(event.data.round)
      if (selectedRound === eventRound && event.data.scoreChanged) {
        updateRankingSilently()
      }

      // Atualizar matchInfo e mostrar bola pulsando apenas se o placar mudou
      if (event.data.scoreChanged && !event.data.isGoalCancelled) {
        // Verificar se deve mostrar a bolinha pulsando baseado nas preferências
        if (!notificationPreferences) return // Aguardar preferências carregarem
        
        const favoriteTeam = user?.favoriteTeam || null
        const { homeTeam, awayTeam } = event.data
        // Normalizar nomes para comparação (remover espaços extras)
        const normalizedFavoriteTeam = favoriteTeam?.trim() || null
        const normalizedHomeTeam = homeTeam?.trim() || ''
        const normalizedAwayTeam = awayTeam?.trim() || ''
        const isFavoriteTeamPlaying = normalizedFavoriteTeam && (normalizedHomeTeam === normalizedFavoriteTeam || normalizedAwayTeam === normalizedFavoriteTeam)
        
        // Verificar se deve notificar
        const shouldNotifyAll = notificationPreferences.bellGoalsAllTeams
        const shouldNotifyFavorite = notificationPreferences.bellGoalsFavoriteTeam && isFavoriteTeamPlaying
        
        if (!shouldNotifyAll && !shouldNotifyFavorite) {
          // Não deve mostrar a bolinha
          return
        }

        const matchInfo = {
          homeTeam: event.data.homeTeam,
          awayTeam: event.data.awayTeam,
          homeScore: event.data.homeScore,
          awayScore: event.data.awayScore,
          goalScorer: event.data.goalScorer,
          isGoalCancelled: event.data.isGoalCancelled || false,
          homeTeamLogo: event.data.homeTeamLogo || null,
          awayTeamLogo: event.data.awayTeamLogo || null,
        }

        // Atualizar matchInfo primeiro
        setLastScoreUpdate(matchInfo)

        // Aguardar um pouco para garantir que o estado foi atualizado, depois mostrar
        // Usar requestAnimationFrame para garantir que o estado foi atualizado
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setShowPulsingBall(false)
            setTimeout(() => {
              setShowPulsingBall(true)
            }, 20)
          })
        })
      }
    } else if (event.type === 'round_status_update') {
      // Evento único com estado completo da rodada
      const eventRound = Number(event.data.round)
      
      if (selectedRound === eventRound) {
        // Garantir que o aviso de gol não apareça novamente
        setShowPulsingBall(false)

        // Atualizar todos os estados de uma vez (sem race conditions)
        setIsRoundFinished(event.data.isFinished)
        setHasLiveMatches(event.data.hasLiveMatches)
        setAllMatchesScheduled(event.data.allMatchesScheduled)

        // Atualizar ranking silenciosamente com dados corretos
        // Isso garante que cores dos cards e nomes estejam sempre sincronizados
        updateRankingSilently(event.data.isFinished)
      }
    } else if (event.type === 'round_finished') {
      // Manter handlers antigos para compatibilidade (mas não devem ser usados)
      const eventRound = Number(event.data.round)
      if (selectedRound === eventRound) {
        setShowPulsingBall(false)
        setIsRoundFinished(true)
        updateRankingSilently(true)
      }
    } else if (event.type === 'round_unfinished') {
      // Manter handlers antigos para compatibilidade (mas não devem ser usados)
      const eventRound = Number(event.data.round)
      if (selectedRound === eventRound) {
        setShowPulsingBall(false)
        setIsRoundFinished(false)
        updateRankingSilently(false)
      }
    }
  })

  // Ler parâmetro de rodada da URL
  useEffect(() => {
    const roundParam = searchParams.get('round')
    if (roundParam && rounds.length > 0) {
      const roundNumber = parseInt(roundParam, 10)
      if (!isNaN(roundNumber) && rounds.includes(roundNumber)) {
        setSelectedRound(roundNumber)
      }
    }
  }, [searchParams, rounds, setSelectedRound])

  useEffect(() => {
    if (selectedRound) {
      loadMatches()
      } else {
        // Se não há rodada selecionada, limpar estados
        setHasLiveMatches(false)
        setIsRoundFinished(false)
        setAllMatchesScheduled(false)
      }
  }, [selectedRound])

  useEffect(() => {
    if (selectedRound && !allMatchesScheduled) {
      loadRanking()
    } else if (selectedRound && allMatchesScheduled) {
      // Se todos os jogos estão agendados, não carregar ranking (todos terão 0 pontos)
      setRanking([])
      setRankingLoading(false)
    } else if (!selectedRound) {
      // Se não há rodada selecionada, garantir que não está em loading
      setRanking([])
      setRankingLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound, allMatchesScheduled])

  const loadRanking = async () => {
    if (!selectedRound) return
    setRankingLoading(true)
    try {
      // Sempre buscar com hideNames=true primeiro (nomes mascarados)
      const maskedData = await ticketService.getRanking(selectedRound, true)
      
      let processedData = maskedData
      
      // Se a rodada está finalizada, mostrar nome completo apenas do primeiro lugar (vencedor)
      if (isRoundFinished) {
        // Buscar dados sem hideNames para ter nomes completos de todos
        const fullData = await ticketService.getRanking(selectedRound, false)

        // Combinar: primeiro lugar com nome completo, resto mascarado
        processedData = maskedData.map(entry => {
          if (entry.position === 1) {
            // Encontrar nome completo no fullData apenas para o primeiro lugar
            const fullEntry = fullData.find(e => e.userId === entry.userId && e.ticketId === entry.ticketId)
            if (fullEntry) {
              return {
                ...entry,
                userName: fullEntry.userName
              }
            }
          }

          // Para posições > 1 ou quando não encontrou no fullData
          // Manter dados mascarados do backend
          return entry
        })
      } else {
        // Se não está finalizada, manter dados mascarados do backend
        processedData = maskedData
      }
      
      // Backend já retorna com position calculado e nomes mascarados quando necessário
      // Frontend apenas exibe os dados recebidos
      setRanking(processedData)
    } catch (error) {
      console.error('Error loading ranking:', error)
    } finally {
      setRankingLoading(false)
    }
  }


  const loadMatches = async () => {
    if (!selectedRound) return Promise.resolve()
    try {
      const data = await matchService.getMatchesByRound(selectedRound)
      // Apenas jogos incluídos na rodada (includeInRound !== false) devem ser considerados
      const includedMatches = data.filter(m => m.includeInRound !== false)

      // Verificar se há jogos em andamento
      const hasLive = includedMatches.some(m => m.status === 'live')
      setHasLiveMatches(hasLive)

      // Verificar se todos os jogos estão finalizados
      const allFinished = includedMatches.length > 0 && includedMatches.every(m => m.status === 'finished')
      setIsRoundFinished(allFinished)

      // Verificar se todos os jogos estão agendados (nenhum em andamento ou finalizado)
      const allScheduled = includedMatches.length > 0 && includedMatches.every(m =>
        m.status === 'scheduled' || !m.status || m.status === undefined
      )

      // Se mudou de "todos agendados" para "não todos agendados", recarregar ranking
      const wasAllScheduled = allMatchesScheduled
      setAllMatchesScheduled(allScheduled)

      // Se mudou de true para false (primeiro jogo começou), recarregar ranking
      if (wasAllScheduled && !allScheduled) {
        loadRanking()
      }
    } catch (error) {
      console.error('Error loading matches:', error)
    }
  }

  const getMedalIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-6 w-6 text-white" />
    return null
  }

  // Filtrar ranking baseado na view selecionada
  const filteredRanking = view === 'my' && user
    ? ranking.filter(entry => entry.userId === user.id)
    : ranking

  // Calcular totais para cada aba
  const totalAllRanking = ranking.length
  const totalMyRanking = user ? ranking.filter(entry => entry.userId === user.id).length : 0

  // Agrupar por posição para adicionar separadores visuais
  const groupedRanking: { [key: number]: RankingEntry[] } = filteredRanking.reduce((acc, entry) => {
    const position = entry.position
    if (!acc[position]) {
      acc[position] = []
    }
    acc[position].push(entry)
    return acc
  }, {} as { [key: number]: RankingEntry[] })

  return (
    <ContentWrapper>
      <PulsingBall
        show={showPulsingBall}
        matchInfo={lastScoreUpdate || undefined}
        onClick={() => setShowPulsingBall(false)}
      />
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold">Ranking</h1>
          <RoundSelector
            rounds={rounds}
            selectedRound={selectedRound}
            onRoundChange={setSelectedRound}
            onOpen={refreshRounds}
          />
        </div>

        {/* Mensagem quando não há rodadas ativas */}
        {!selectedRound && rounds.length === 0 && !roundsLoading && (
          <Card className="p-6 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">
              Nenhuma rodada ativa no momento
            </p>
            <p className="text-xs text-muted-foreground">
              Não há rodadas disponíveis para visualização do ranking. Entre em contato com o administrador.
            </p>
          </Card>
        )}

        {/* Conteúdo do ranking - só mostrar se houver rodada selecionada */}
        {selectedRound && (
          <>
            {/* Abas de visualização - sempre mostrar quando há rodada selecionada */}
            {user && (
          <div className="flex gap-2">
            <Button
              variant={view === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setView('all')}
              className="flex-1"
              disabled={allMatchesScheduled}
            >
              Ranking Geral
              <span className="ml-2 text-xs bg-background/50 px-1.5 py-0.5 rounded">
                {allMatchesScheduled || showRankingLoading ? 0 : totalAllRanking}
              </span>
            </Button>
            <Button
              variant={view === 'my' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setView('my')}
              className="flex-1"
              disabled={allMatchesScheduled}
            >
              Meu Ranking
              <span className="ml-2 text-xs bg-background/50 px-1.5 py-0.5 rounded">
                {allMatchesScheduled || showRankingLoading ? 0 : totalMyRanking}
              </span>
            </Button>
          </div>
        )}


            {/* Status da rodada - só mostrar quando há ranking disponível */}
            {!allMatchesScheduled && ranking.length > 0 && (
              <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border ${
                isRoundFinished
                  ? 'bg-green-500/20 border-green-500/50'
                  : hasLiveMatches
                    ? 'bg-yellow-500/20 border-yellow-500/50'
                    : 'bg-blue-500/20 border-blue-500/50'
              }`}>
                {isRoundFinished ? (
                  <>
                    <Info className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-500 font-medium">
                      Rodada finalizada - Resultado final
                    </p>
                  </>
                ) : hasLiveMatches ? (
                  <>
                    <Radio className="h-4 w-4 text-yellow-500 animate-pulse" />
                    <p className="text-sm text-yellow-500 font-medium">
                      Jogos em andamento - Resultado parcial
                    </p>
                  </>
                ) : (
                  <>
                    <Info className="h-4 w-4 text-blue-500" />
                    <p className="text-sm text-blue-500 font-medium">
                      Jogos agendados - Resultado parcial
                    </p>
                  </>
                )}
              </div>
            )}

            {allMatchesScheduled ? (
              <Card>
                <div className="text-center py-8">
                  <Info className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium mb-1">
                    Ranking ainda não disponível
                  </p>
                  <p className="text-sm text-muted-foreground/80">
                    Os pontos só começam a ser contabilizados quando pelo menos um jogo estiver em andamento.
                  </p>
                </div>
              </Card>
            ) : showRankingLoading || filteredRanking.length === 0 ? (
              <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
          <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
            {Object.entries(groupedRanking).map(([position, entries], groupIndex) => {
              const pos = parseInt(position)
              const isWinner = pos === 1 && isRoundFinished
              const isLeader = pos === 1 && !isRoundFinished


              // Determinar classes CSS baseadas no status
              const cardClasses = isWinner
                ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg'
                : isLeader
                ? 'border-2 border-blue-400 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg'
                : ''

              return (
                <motion.div
                  key={`${position}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.03 }}
                >
                  <Card className={`p-3 ${cardClasses}`}>
                    {entries.map((entry, entryIndex) => {
                      const isCurrentUser = user && entry.userId === user.id

                      return (
                        <div key={`${entry.userId}-${entry.ticketId}`}>
                          {entryIndex > 0 && (
                            <div className="h-px bg-border/30 my-2" />
                          )}
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/tickets/${entry.ticketId}?from=ranking`)
                            }}
                            className="flex items-center justify-between gap-3 cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity relative z-10"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              {/* Posição com medalha ou número - apenas na primeira entrada do grupo */}
                              {entryIndex === 0 && (
                                <div className={`flex h-12 w-12 items-center justify-center rounded-full shrink-0 ${
                                  isWinner
                                    ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg'
                                    : isLeader
                                    ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg'
                                    : 'bg-secondary border-2 border-border'
                                }`}>
                                  {getMedalIcon(pos) || (
                                    <span className={`text-base font-bold ${(isWinner || isLeader) ? 'text-white' : 'text-foreground'}`}>
                                      {pos}
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* Espaço vazio para alinhar quando não é a primeira entrada */}
                              {entryIndex > 0 && <div className="w-12 shrink-0" />}

                              {/* Informações do usuário */}
                              <div className="flex-1 min-w-0">
                                {/* Primeira linha: Número do bilhete */}
                                <div className="mb-1">
                                  <span className={`text-sm font-semibold ${
                                    isWinner
                                      ? 'text-yellow-300'
                                      : isLeader
                                      ? 'text-blue-300'
                                      : 'text-muted-foreground'
                                  }`}>
                                    Bilhete #{entry.ticketId.slice(-6)}
                                  </span>
                                </div>

                                {/* Segunda linha: Nome e apelido lado a lado */}
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className={`font-semibold text-base ${
                                    isWinner
                                      ? 'text-yellow-300'
                                      : isLeader
                                      ? 'text-blue-300'
                                      : isCurrentUser
                                      ? 'text-primary'
                                      : 'text-foreground'
                                  }`}>
                                    {entry.userName}
                                  </p>
                                  {isCurrentUser && (
                                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                                      Você
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                  <div className="whitespace-nowrap">
                                    Criação: {format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </div>
                                  {entry.confirmedAt && (
                                    <div className="whitespace-nowrap">
                                      Confirmação: {format(new Date(entry.confirmedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tag e Pontos - alinhados à direita */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {/* Tags de LÍDER e VENCEDOR - acima dos pontos */}
                              {isWinner && (
                                <span className="px-2 py-0.5 rounded-full bg-yellow-400/30 text-yellow-300 text-xs font-bold animate-pulse whitespace-nowrap">
                                  🏆 VENCEDOR
                                </span>
                              )}
                              {isLeader && !isWinner && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-400/30 text-blue-300 text-xs font-bold animate-pulse whitespace-nowrap">
                                  👑 LÍDER
                                </span>
                              )}

                              {/* Pontos */}
                              <div className="flex flex-col items-end gap-0.5">
                                <div className={`text-2xl font-bold ${
                                  isWinner
                                    ? 'text-yellow-300'
                                    : isLeader
                                    ? 'text-blue-300'
                                    : 'text-foreground'
                                }`}>
                                  {entry.points}
                                </div>
                                <span className={`text-xs font-medium ${
                                  isWinner
                                    ? 'text-yellow-200'
                                    : isLeader
                                    ? 'text-blue-200'
                                    : 'text-muted-foreground'
                                }`}>
                                  pts
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
          </>
        )}
      </div>
    </ContentWrapper>
  )
}
