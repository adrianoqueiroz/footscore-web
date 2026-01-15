import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Info, Trophy, Radio, Lock, CheckCircle2, Clock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import TeamLogo from '@/components/ui/TeamLogo'
import RoundSelector from '@/components/ui/RoundSelector'
import ContentWrapper from '@/components/ui/ContentWrapper'
import { matchService } from '@/services/match.service'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { Match } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseMatchDateTime, cn } from '@/lib/utils'
import { getTeamDisplayName } from '@/lib/teamNames'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import PulsingBall from '@/components/ui/PulsingBall'

export default function Matches() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState<Match[]>([])
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [allowsNewBets, setAllowsNewBets] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [storedAllowsNewBets, setStoredAllowsNewBets] = useState<boolean | undefined>(undefined)
  const { rounds, selectedRound, setSelectedRound, loading: roundsLoading, refreshRounds, validateSelection } = useRoundSelector()
  const [showPulsingBall, setShowPulsingBall] = useState(false)
  const [lastScoreUpdate, setLastScoreUpdate] = useState<{ homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; goalScorer?: 'home' | 'away' | null; isGoalCancelled?: boolean; homeTeamLogo?: string | null; awayTeamLogo?: string | null } | null>(null)
  const [showBlockedMessage, setShowBlockedMessage] = useState(false)

  // AbortController para cancelar operações quando a página muda
  const abortControllerRef = useRef<AbortController | null>(null)

  // Conectar ao SSE para receber atualizações de placar e status
  useMatchEvents((event) => {
    // Só processar eventos se houver uma rodada selecionada
    if (!selectedRound) {
      return
    }

    // Processar evento de forma assíncrona para não bloquear navegação
    setTimeout(() => {
      if (event.type === 'score_update') {
        const eventRound = parseInt(String(event.data.round))

        if (selectedRound === eventRound) {
          setMatches(prevMatches =>
            prevMatches.map(match => {
              if (match.id === event.data.matchId) {
                return {
                  ...match,
                  homeScore: event.data.homeScore !== undefined ? event.data.homeScore : match.homeScore,
                  awayScore: event.data.awayScore !== undefined ? event.data.awayScore : match.awayScore,
                  status: event.data.status !== undefined ? event.data.status as 'scheduled' | 'live' | 'finished' : match.status
                }
              }
              return match
            })
          )

          if (event.data.scoreChanged) {
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

            setLastScoreUpdate(matchInfo)
            setShowPulsingBall(false)
            setTimeout(() => setShowPulsingBall(true), 20)
          }
        }
      } else if (event.type === 'match_status_update') {
        const eventRound = parseInt(String(event.data.round))

        if (selectedRound === eventRound) {
          setMatches(prevMatches => {
            const matchIndex = prevMatches.findIndex(m => m.id === event.data.matchId)
            if (matchIndex === -1) {
              return prevMatches
            }

            const updatedMatches = [...prevMatches]
            const oldMatch = updatedMatches[matchIndex]

            const updatedMatch: Match = {
              ...oldMatch,
              status: event.data.status as 'scheduled' | 'live' | 'finished'
            }

            if (event.data.homeScore !== undefined && event.data.awayScore !== undefined) {
              updatedMatch.homeScore = event.data.homeScore
              updatedMatch.awayScore = event.data.awayScore
            }

            updatedMatches[matchIndex] = updatedMatch
            return updatedMatches
          })
        }
      }
    }, 0)
  })

  useEffect(() => {
    if (selectedRound) {
      loadMatches()
    } else {
      // Se não há rodada selecionada, garantir que não está em loading
      setMatchesLoading(false)
      setMatches([])
      setExcludedMatches([])
      setAllowsNewBets(true)
      setIsBlocked(false)
    }
  }, [selectedRound])

  // Validar seleção quando rodadas mudam
  useEffect(() => {
    if (rounds.length > 0) {
      validateSelection()
    }
  }, [rounds, validateSelection])

  const [excludedMatches, setExcludedMatches] = useState<Match[]>([])

  const loadRoundStatus = useCallback(async () => {
    if (!selectedRound) return
    try {
      const { storedAllowsNewBets: storedAllows } = await matchService.getMatchesByRoundWithStatus(selectedRound)
      // Usar apenas o valor armazenado no banco
      const allows = storedAllows ?? true
      setStoredAllowsNewBets(storedAllows)
      setAllowsNewBets(allows)
      setIsBlocked(false)
    } catch (error) {
      console.error('Error loading round status:', error)
    }
  }, [selectedRound])

  // Recarregar status quando a rodada muda
  useEffect(() => {
    if (selectedRound) {
      loadRoundStatus()
    }
  }, [selectedRound, loadRoundStatus])

  // Atualizar status da rodada periodicamente para detectar bloqueios em tempo real
  useEffect(() => {
    if (!selectedRound) return

    // Verificar status imediatamente
    loadRoundStatus()

    // Verificar status a cada 30 segundos
    const interval = setInterval(() => {
      loadRoundStatus()
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedRound, loadRoundStatus])

  const loadMatches = useCallback(async () => {
    if (!selectedRound) return

    // Cancelar operação anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Criar novo AbortController para esta operação
    abortControllerRef.current = new AbortController()

    setMatchesLoading(true)
    try {
      // Buscar matches e status em uma única chamada
      const { matches: data, allowsNewBets: allows, isBlocked: blocked } = await matchService.getMatchesByRoundWithStatus(selectedRound)
      
      // Separar jogos incluídos dos excluídos
      // Tratar undefined/null como true (padrão: incluído)
      // Apenas explicitamente false deve ser excluído
      const included = data.filter((match: Match) => {
        // Se includeInRound é undefined, null, ou true, o jogo está incluído
        return match.includeInRound !== false
      })
      const excluded = data.filter((match: Match) => {
        // Apenas jogos explicitamente marcados como false
        return match.includeInRound === false
      })
      
      // Debug temporário - remover após confirmar que backend está retornando o campo
      if (data.length > 0 && data.some(m => m.includeInRound === undefined)) {
        console.warn('⚠️ Alguns jogos não têm includeInRound definido. Backend deve retornar este campo.')
      }
      
      // Ordenar por campo 'order' (ordem de criação/reordenação manual)
      const sorted = included.sort((a: Match, b: Match) => {
        const orderA = a.order ?? 9999; // Jogos sem order vão para o final
        const orderB = b.order ?? 9999;
        return orderA - orderB;
      })
      
      // Verificar se a operação foi cancelada
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      setMatches(sorted)
      setExcludedMatches(excluded)
      setAllowsNewBets(allows)
      setIsBlocked(blocked)
    } catch (error) {
      // Não logar erro se foi cancelado
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('Error loading matches:', error)
      }
    } finally {
      // Só atualizar loading se a operação não foi cancelada
      if (!abortControllerRef.current?.signal.aborted) {
        setMatchesLoading(false)
      }
    }
  }, [selectedRound])

  // Cleanup effect para cancelar operações quando o componente desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleNewPrediction = async () => {
    if (!selectedRound) {
      if (rounds.length > 0) {
        // Se não há rodada selecionada, usar a primeira disponível
        navigate(`/games?round=${rounds[0]}`)
      }
      return
    }

    // Verificar status da rodada antes de navegar
    try {
      const status = await matchService.getRoundStatus(selectedRound)
      const allows = status.storedAllowsNewBets ?? true
      if (status && !allows) {
        // Atualizar estado local
        setAllowsNewBets(false)
        setIsBlocked(true)
        // Mostrar mensagem de bloqueio na própria página
        setShowBlockedMessage(true)
        // Esconder mensagem após 5 segundos
        setTimeout(() => {
          setShowBlockedMessage(false)
        }, 5000)
        return
      }
      
      // Se permite novos palpites, navegar normalmente
      navigate(`/games?round=${selectedRound}`)
    } catch (error) {
      console.error('Error checking round status:', error)
      // Em caso de erro, tentar navegar mesmo assim (o backend vai validar)
      navigate(`/games?round=${selectedRound}`)
    }
  }

  // Função helper para determinar informações de exibição do jogo
  const getMatchDisplayInfo = (match: Match) => {
    const statusType = match.status || 'scheduled'
    const isLive = statusType === 'live'
    const isFinished = statusType === 'finished'
    const isScheduled = statusType === 'scheduled' || !statusType
    
    const hasScore = match.homeScore !== undefined && match.awayScore !== undefined
    const scoreDisplay = hasScore ? `${match.homeScore} × ${match.awayScore}` : null
    
    const matchDate = parseMatchDateTime(match)
    const dateDisplay = matchDate ? {
      dayOfWeek: format(matchDate, "EEE", { locale: ptBR }),
      date: format(matchDate, "dd/MM"),
      time: match.time || '??:??'
    } : null
    
    return {
      statusType: statusType as 'scheduled' | 'live' | 'finished',
      showLiveBadge: isLive,
      showScore: hasScore && (isLive || isFinished),
      scoreDisplay,
      dateDisplay,
      isLive,
      isFinished,
      isScheduled
    }
  }

  return (
    <ContentWrapper>
      <PulsingBall
        show={showPulsingBall}
        matchInfo={lastScoreUpdate || undefined}
        onClick={() => setShowPulsingBall(false)}
      />
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold">Início</h1>
          <RoundSelector
            rounds={rounds}
            selectedRound={selectedRound}
            onRoundChange={setSelectedRound}
            onOpen={refreshRounds}
          />
        </div>

        {!selectedRound && rounds.length === 0 && !roundsLoading && (
          <Card className="p-6 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">
              Nenhuma rodada ativa no momento
            </p>
            <p className="text-xs text-muted-foreground">
              Não há rodadas disponíveis para visualização. Entre em contato com o administrador.
            </p>
          </Card>
        )}

        {selectedRound && matches.length === 0 && !matchesLoading && excludedMatches.length === 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Nenhuma partida encontrada para a rodada selecionada.</p>
          </div>
        )}

        {matches.length === 0 && !matchesLoading && excludedMatches.length > 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Nenhuma partida incluída nesta rodada de palpites.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Todos os confrontos foram excluídos desta rodada.
            </p>
          </div>
        )}

        {/* Aviso sobre confrontos excluídos */}
        {excludedMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-yellow-500/20 border border-yellow-500/50 p-3"
          >
            <div className="flex items-start gap-2 mb-2">
              <Info className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-yellow-500 font-medium">
                  {excludedMatches.length} {excludedMatches.length === 1 ? 'confronto excluído' : 'confrontos excluídos'} desta rodada
                </p>
              </div>
            </div>
            <div className="ml-6 space-y-1.5">
              {excludedMatches.map((match) => (
                <div key={match.id} className="flex items-center gap-2 text-[10px] text-yellow-500/90">
                  <span className="font-semibold">{getTeamDisplayName(match.homeTeam)}</span>
                  <span className="text-yellow-500/60">×</span>
                  <span className="font-semibold">{getTeamDisplayName(match.awayTeam)}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-yellow-500/80 mt-2 ml-6">
              Não aparecerão na seleção de palpites
            </p>
          </motion.div>
        )}

        {matches.length > 0 && (
          <>
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {matches.map((match, index) => {
              const displayInfo = getMatchDisplayInfo(match)

              // Determinar classes CSS baseadas no status do jogo
              const cardClasses = displayInfo.isLive
                ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg'
                : displayInfo.isFinished
                ? 'border-2 border-green-400 bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-lg'
                : ''

              return (
                <Card key={match.id} className={cn("p-3", cardClasses)}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: Math.min(index * 0.01, 0.1), // Delay máximo de 0.1s no mobile
                      duration: 0.2, // Animação mais rápida
                      ease: "easeOut"
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Dia da semana em cima, data e hora embaixo */}
                      <div className="flex flex-col items-start justify-center flex-shrink-0 min-w-[4rem]">
                        <span className={cn(
                          "text-[10px] font-medium uppercase tracking-wide leading-tight block",
                          displayInfo.isLive && "text-yellow-300",
                          displayInfo.isFinished && "text-green-300",
                          !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                        )}>
                          {displayInfo.dateDisplay ? format(new Date(`${match.date}T${match.time}`), "EEE", { locale: ptBR }) : "---"}
                        </span>
                        <span className={cn(
                          "text-[9px] font-medium leading-tight block",
                          displayInfo.isLive && "text-yellow-300",
                          displayInfo.isFinished && "text-green-300",
                          !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                        )}>
                          {displayInfo.dateDisplay ? format(new Date(`${match.date}T${match.time}`), "dd/MM HH:mm", { locale: ptBR }) : "--/-- --:--"}
                        </span>
                      </div>

                      {/* Separador vertical */}
                      <div className={cn(
                        "h-6 w-px flex-shrink-0",
                        displayInfo.isLive && "bg-yellow-400",
                        displayInfo.isFinished && "bg-green-400",
                        !displayInfo.isLive && !displayInfo.isFinished && "bg-border"
                      )} />

                      {/* Time casa 0 x 0 time visitante */}
                      <div className="flex-1 flex items-center min-w-0">
                        {/* Time casa */}
                        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                          <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-6 w-6 mb-0.5" noCircle />
                          <span className={cn(
                            "text-xs font-semibold truncate text-center leading-tight max-w-[5.5rem]",
                            displayInfo.isLive && "text-yellow-300",
                            displayInfo.isFinished && "text-green-300",
                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                          )}>{getTeamDisplayName(match.homeTeam)}</span>
                        </div>

                        {/* Placar centralizado */}
                        <div className="w-[60px] flex items-center justify-center flex-shrink-0">
                          <span className={cn(
                            "text-base font-bold flex-shrink-0 min-w-[3rem] text-center",
                            displayInfo.showScore && displayInfo.scoreDisplay
                              ? displayInfo.isLive
                                ? "text-yellow-300"
                                : displayInfo.isFinished
                                ? "text-green-300"
                                : "text-foreground"
                              : "text-muted-foreground/40"
                          )}>
                            {displayInfo.showScore && displayInfo.scoreDisplay ? displayInfo.scoreDisplay : "0 × 0"}
                          </span>
                        </div>

                        {/* Time visitante */}
                        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                          <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-6 w-6 mb-0.5" noCircle />
                          <span className={cn(
                            "text-xs font-semibold truncate text-center leading-tight max-w-[5.5rem]",
                            displayInfo.isLive && "text-yellow-300",
                            displayInfo.isFinished && "text-green-300",
                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                          )}>{getTeamDisplayName(match.awayTeam)}</span>
                        </div>
                      </div>

                      {/* Status do lado direito - apenas ícones */}
                      <div className="flex items-center flex-shrink-0">
                        {displayInfo.isLive ? (
                          <Radio className="h-4 w-4 text-yellow-400 animate-pulse" />
                        ) : displayInfo.isFinished ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground/60" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                </Card>
              )
            })}
            </div>
          </>
        )}

        {/* Mensagem de rodada bloqueada */}
        <AnimatePresence>
          {showBlockedMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4"
            >
              <Card className="bg-red-500/20 border-red-500/50 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-red-500" />
                  <p className="text-sm text-red-500 font-medium">
                    Esta rodada está bloqueada e não aceita mais palpites.
                  </p>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão Novo Palpite ou Ver Ranking */}
        {matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }} // Delay reduzido para resposta mais rápida
            className="mt-6"
          >
            {allowsNewBets ? (
              <Button
                onClick={handleNewPrediction}
                size="lg"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Palpite
              </Button>
            ) : (
              <Button
                onClick={() => navigate(`/ranking?round=${selectedRound}`)}
                size="lg"
                className="w-full"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Ver Ranking
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </ContentWrapper>
  )
}

