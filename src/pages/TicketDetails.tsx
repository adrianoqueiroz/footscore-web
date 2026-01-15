import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Clock, MessageSquare, XCircle, Trash2, Plus, Trophy, Radio, Info } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import TeamLogo from '@/components/ui/TeamLogo'
import PulsingBall from '@/components/ui/PulsingBall'
import { ticketService } from '@/services/ticket.service'
import { matchService } from '@/services/match.service'
import { authService } from '@/services/auth.service'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'
import { config } from '@/config'
import { Ticket, Match } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseMatchDateTime, cn } from '@/lib/utils'

// Função para mascarar nome do usuário (mesma lógica do backend)
const maskUserName = (name: string): string => {
  if (!name || name.length === 0) {
    return 'A********'
  }
  const firstLetter = name.trim().charAt(0).toUpperCase()
  const FIXED_LENGTH = 9
  const asterisks = '*'.repeat(FIXED_LENGTH - 1)
  return firstLetter + asterisks
}

export default function TicketDetails() {
  const navigate = useNavigate()
  const { ticketId } = useParams<{ ticketId: string }>()
  const editingTicketId = ticketId // Para compatibilidade com o código existente
  const [searchParams] = useSearchParams()
  const fromParam = searchParams.get('from') // 'ranking', 'tickets' ou 'admin'
  const roundParam = searchParams.get('round')
  const isFromRanking = fromParam === 'ranking'
  const isFromAdmin = fromParam === 'admin'
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [allowsNewBets, setAllowsNewBets] = useState<boolean | null>(null)
  const [loadingRoundStatus, setLoadingRoundStatus] = useState(false)
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [showPulsingBall, setShowPulsingBall] = useState(false)
  const [lastScoreUpdate, setLastScoreUpdate] = useState<{ homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; goalScorer?: 'home' | 'away' | null; isGoalCancelled?: boolean; homeTeamLogo?: string | null; awayTeamLogo?: string | null } | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<{
    bellGoalsAllTeams: boolean
    bellGoalsFavoriteTeam: boolean
  } | null>(null)
  const showLoading = useDelayedLoading(loading)
  const toast = useToastContext()
  const confirm = useConfirmContext()

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

  // Conectar ao SSE para receber atualizações de placar
  const { lastEvent } = useMatchEvents((event) => {
    if (event.type === 'score_update' && event.data.scoreChanged) {
      // Atualizar matches localmente
      setMatches(prevMatches => {
        return prevMatches.map(match => {
          if (match.id === event.data.matchId) {
            return {
              ...match,
              homeScore: event.data.homeScore,
              awayScore: event.data.awayScore,
              status: event.data.status,
            }
          }
          return match
        })
      })

      // Verificar se deve mostrar a bolinha pulsando baseado nas preferências
      if (!event.data.isGoalCancelled && notificationPreferences) {
        const user = authService.getCurrentUser()
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
        
        if (shouldNotifyAll || shouldNotifyFavorite) {
          // Atualizar matchInfo e mostrar bola pulsando
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
      }
    }
  })

  useEffect(() => {
    if (ticketId) {
      loadData()
    } else {
      setLoading(false)
      setTicket(null)
      setMatches([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  useEffect(() => {
    if (ticket) {
      loadRoundStatus()
    }
  }, [ticket])

  const loadData = async () => {
    if (!ticketId) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    setTicket(null) // Reset ticket ao iniciar novo carregamento
    setMatches([]) // Reset matches ao iniciar novo carregamento
    
    try {
      const foundTicket = await ticketService.getTicketById(ticketId)
      
      if (foundTicket) {
        setTicket(foundTicket)
        // Buscar jogos da rodada específica do ticket
        try {
          const roundMatches = await matchService.getMatchesByRound(foundTicket.round)
          if (roundMatches && roundMatches.length > 0) {
            setMatches(roundMatches)
          } else {
            // Fallback: buscar todos os jogos e filtrar
            console.warn('No matches found for round, fetching all matches')
            const allMatches = await matchService.getAllMatches()
            const filtered = allMatches.filter((m: any) => m.round === foundTicket.round)
            setMatches(filtered)
          }
        } catch (matchError) {
          console.error('Error fetching matches:', matchError)
          // Fallback final: buscar todos os matches
          const allMatches = await matchService.getAllMatches()
          const filtered = allMatches.filter((m: any) => m.round === foundTicket.round)
          setMatches(filtered)
        }
      } else {
        console.warn('Ticket not found:', ticketId)
        setTicket(null)
      }
    } catch (error: any) {
      console.error('Error loading ticket details:', error)
      setTicket(null)
      setMatches([])
      // Mostrar toast apenas se não for erro de conexão genérico
      if (error?.status !== 0 || error?.message?.includes('conexão')) {
        toast.error(error?.message || 'Erro ao carregar dados do ticket')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadRoundStatus = async () => {
    if (!ticket) return
    setLoadingRoundStatus(true)
    try {
      const status = await matchService.getRoundStatus(ticket.round)
      if (status) {
        setAllowsNewBets(status.allowsNewBets)
      } else {
        // Se não conseguir o status, assumir que não permite (mais seguro)
        setAllowsNewBets(false)
      }
    } catch (error) {
      console.error('Error loading round status:', error)
      setAllowsNewBets(false)
    } finally {
      setLoadingRoundStatus(false)
    }
  }

  const handleWhatsAppConfirmation = async () => {
    const user = authService.getCurrentUser()
    if (!user || !ticket) return

    // Buscar número do backend
    let whatsappNumber: string
    try {
      whatsappNumber = await config.getAdminWhatsApp()
    } catch (error) {
      console.error('[TicketDetails] Erro ao buscar WhatsApp do backend, usando fallback:', error)
      whatsappNumber = config.getAdminWhatsAppSync() // Fallback para sync
    }

    // Mensagem simplificada: apenas código, rodada e nome
    const message = `✅ *CONFIRMAR PALPITE*\n\n` +
      `*Código:* #${ticket.id.slice(-6)}\n` +
      `*Rodada:* ${ticket.round}\n` +
      `*Nome:* ${user.name}`

    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleConfirmTicket = async () => {
    if (!ticket) return
    
    setSavingStatus(prev => ({ ...prev, confirm: true }))
    try {
      await ticketService.confirmTicket(ticket.id)
      toast.success('Palpite aprovado com sucesso!')
      // Voltar para a página de admin
      if (isFromAdmin && roundParam) {
        navigate(`/admin?view=manage-palpites&round=${roundParam}`)
      } else if (isFromAdmin) {
        navigate('/admin?view=manage-palpites')
      } else {
        navigate('/tickets')
      }
    } catch (error: any) {
      console.error('Error confirming ticket:', error)
      toast.error(error?.message || 'Erro ao aprovar palpite. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, confirm: false }))
    }
  }

  const handleCancelTicket = async () => {
    if (!ticket) return

    const confirmed = await confirm.confirm({
      title: 'Cancelar Palpite',
      message: 'Tem certeza que deseja cancelar este palpite? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Cancelar Palpite',
    })
    if (!confirmed) return

    setSavingStatus(prev => ({ ...prev, cancel: true }))
    try {
      await ticketService.cancelTicket(ticket.id)
      toast.success('Palpite cancelado com sucesso!')
      // Voltar para a página de admin
      if (isFromAdmin && roundParam) {
        navigate(`/admin?view=manage-palpites&round=${roundParam}`)
      } else if (isFromAdmin) {
        navigate('/admin?view=manage-palpites')
      } else {
        navigate('/tickets')
      }
    } catch (error: any) {
      console.error('Error canceling ticket:', error)
      toast.error(error?.message || 'Erro ao cancelar palpite. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, cancel: false }))
    }
  }

  const handleDeleteTicket = async () => {
    if (!ticket) return

    const confirmed = await confirm.confirm({
      title: 'Excluir Palpite',
      message: 'Tem certeza que deseja excluir este palpite? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Excluir Palpite',
    })
    if (!confirmed) return

    try {
      await ticketService.deleteTicket(ticket.id)
      toast.success('Palpite excluído com sucesso')
      navigate('/tickets')
    } catch (error: any) {
      console.error('Error deleting ticket:', error)
      // Extrair mensagem de erro mais descritiva
      let errorMessage = 'Erro ao excluir o palpite. Tente novamente.'
      
      if (error?.message) {
        errorMessage = error.message
      } else if (error?.error) {
        errorMessage = error.error
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      // Mensagens específicas para diferentes tipos de erro
      if (error?.status === 403) {
        errorMessage = 'Você não tem permissão para excluir este palpite.'
      } else if (error?.status === 404) {
        errorMessage = 'Palpite não encontrado.'
      } else if (error?.status === 400) {
        errorMessage = 'Apenas palpites pendentes podem ser excluídos.'
      } else if (error?.status === 500) {
        errorMessage = errorMessage || 'Erro interno do servidor. Tente novamente mais tarde.'
      }
      
      toast.error(errorMessage)
    }
  }


  // Mostrar loading quando está carregando ou quando ainda não tem ticket
  if (loading || showLoading || (!ticket && ticketId)) {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07]">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/tickets')}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold flex-1">
              {editingTicketId ? 'Revisar Palpite' : 'Detalhes do Palpite'}
            </h1>
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!ticket && !loading) {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07]">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
          <Button variant="outline" onClick={() => navigate('/tickets')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Meus Palpites
          </Button>
          <Card>
            <p className="text-center text-muted-foreground py-8">Palpite não encontrado</p>
          </Card>
        </div>
      </div>
    )
  }

  // Verificar se é o próprio usuário para mascarar nome se necessário
  const user = authService.getCurrentUser()
  const isOwnTicket = user && ticket.userId === user.id
  const displayUserName = isOwnTicket ? ticket.userName : maskUserName(ticket.userName)

  const getMatchStatus = (match: Match) => {
    if (match.status === 'finished') return { label: 'Finalizado', icon: '✓', color: 'bg-green-500/20 text-green-400', useIcon: false }
    if (match.status === 'live') return { label: 'Em Andamento', icon: 'live', color: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50', useIcon: true }
    return { label: 'Agendado', icon: '📅', color: 'bg-blue-500/20 text-blue-400', useIcon: false }
  }

  // Buscar pontos deste jogo específico do backend
  const getMatchPoints = (matchId: string) => {
    const pointsData = (ticket as any).pointsByMatch || []
    return pointsData.find((p: any) => p.matchId === matchId)?.points ?? 0
  }

  // Verificar se o jogo já iniciou (tem resultado)
  const hasMatchStarted = (match: Match) => {
    // Jogo iniciou se está em andamento ou finalizado
    if (match.status === 'live' || match.status === 'finished') {
      return true
    }
    // Ou se tem placar definido (não é 0x0 por padrão)
    if (match.homeScore !== undefined && match.awayScore !== undefined) {
      // Se está agendado mas tem placar, pode ser que o admin atualizou antes de mudar status
      return match.status !== 'scheduled'
    }
    return false
  }

  // Renderizar modo Ranking (com resultados e pontuação)
  const renderRankingMode = () => {
  return (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                Nenhum jogo encontrado para a rodada {ticket.round}
              </p>
            </div>
          ) : (
            (Array.isArray(ticket.predictions) ? ticket.predictions : []).map((pred: any, idx: number) => {
              const match = matches.find(m => m.id === pred.matchId)
              if (!match) {
                console.warn(`Match not found for prediction:`, pred.matchId)
                return null
              }

            const matchPoints = getMatchPoints(pred.matchId)
            const matchStarted = hasMatchStarted(match)

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="p-3">
                  <div className="space-y-2">
                    {/* Header com data e status */}
                    <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/50">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">
                          {format(new Date(`${match.date}T${match.time}`), "EEE", { locale: ptBR })}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">•</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {format(new Date(`${match.date}T${match.time}`), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {(() => {
                        const status = getMatchStatus(match)
                        return (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.color} flex items-center gap-1 flex-shrink-0`}>
                            {status.useIcon ? (
                              <Radio className="h-3 w-3 animate-pulse" />
                            ) : (
                              <span>{status.icon}</span>
                            )}
                            <span>{status.label}</span>
                          </span>
                        )
                      })()}
                    </div>

                    {/* Layout principal: Confronto + Palpite + Resultado + Pontuação */}
                    <div className="flex items-center justify-between gap-1.5 pt-1.5">
                      {/* Confronto (esquerda) - vertical */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-center gap-1.5 px-1">
                          {/* Home */}
                          <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
                            <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-6 w-6" noCircle />
                            <span className="font-semibold text-xs text-center truncate leading-tight">{match.homeTeam}</span>
                          </div>
                          
                          {/* VS */}
                          <span className="text-xs text-muted-foreground flex-shrink-0">vs</span>
                          
                          {/* Away */}
                          <div className="flex flex-col items-center gap-0.5 min-w-0 flex-1">
                            <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-6 w-6" noCircle />
                            <span className="font-semibold text-xs text-center truncate leading-tight">{match.awayTeam}</span>
                          </div>
                        </div>
                      </div>

                      {/* Palpite (centro) */}
                      <div className="flex-shrink-0 px-1.5">
                        <div className="flex items-center gap-0.5 bg-primary/20 rounded-lg px-1.5 py-0.5">
                          <span className="font-bold text-sm text-primary">{pred.homeScore}</span>
                          <span className="text-[10px] text-muted-foreground">x</span>
                          <span className="font-bold text-sm text-primary">{pred.awayScore}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-0.5 leading-tight">Palpite</p>
                      </div>

                      {/* Resultado (centro) */}
                      {matchStarted ? (
                        <div className="flex-shrink-0 px-1.5">
                          <div className="flex items-center justify-center gap-0.5 bg-foreground/10 border border-border/50 rounded-lg px-1.5 py-0.5 min-w-[60px]">
                            <span className="font-bold text-sm text-foreground">{match.homeScore}</span>
                            <span className="text-[10px] text-muted-foreground">x</span>
                            <span className="font-bold text-sm text-foreground">{match.awayScore}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center mt-0.5 leading-tight">Resultado</p>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 px-1.5">
                          <div className="flex items-center justify-center gap-0.5 bg-gray-700/20 rounded-lg px-1.5 py-0.5 min-w-[60px]">
                            <span className="font-bold text-sm text-gray-500/50">--</span>
                            <span className="text-[10px] text-muted-foreground">x</span>
                            <span className="font-bold text-sm text-gray-500/50">--</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 text-center mt-0.5 leading-tight">Não iniciado</p>
                        </div>
                      )}

                      {/* Pontuação (direita) */}
                      <div className="flex-shrink-0 px-1.5 text-center">
                        <div className={`font-bold text-base ${
                          !matchStarted
                            ? 'text-gray-500/50'
                            : matchPoints === 3 
                            ? 'text-green-400' 
                            : matchPoints === 1 
                            ? 'text-yellow-400' 
                            : matchPoints === 0
                            ? 'text-red-400'
                            : 'text-gray-500'
                        }`}>
                          {!matchStarted ? '0' : (matchPoints === 0 ? matchPoints : `+${matchPoints}`)}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">pts</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })
          )}
        </div>
    )
  }

  // Renderizar modo Tickets (apenas palpite e data, estilo compacto como Rounds)
  const renderTicketsMode = () => {
    return (
      <div className="space-y-2">
        {(Array.isArray(ticket.predictions) ? ticket.predictions : []).map((pred: any, idx: number) => {
          const match = matches.find(m => m.id === pred.matchId)
          if (!match) {
            console.warn(`Match not found for prediction:`, pred.matchId)
            return null
          }

          const matchDate = parseMatchDateTime(match)
          const dateDisplay = matchDate ? {
            dayOfWeek: format(matchDate, "EEE", { locale: ptBR }),
            date: format(matchDate, "dd/MM"),
            time: match.time || '??:??'
          } : null

          const canEdit = isOwnTicket && ticket.status === 'pending' && !isFromAdmin && allowsNewBets !== false

          return (
            <Card 
              key={idx} 
              className={cn(
                "p-2",
                canEdit && "cursor-pointer hover:bg-secondary/30 transition-colors"
              )}
              onClick={canEdit ? () => {
                const pred = Array.isArray(ticket.predictions) 
                  ? ticket.predictions.find((p: any) => p.matchId === match.id)
                  : null
                if (pred) {
                  navigate(`/games?round=${ticket.round}&ticketId=${ticket.id}&matchId=${match.id}`)
                } else {
                  navigate(`/games?round=${ticket.round}&ticketId=${ticket.id}`)
                }
              } : undefined}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <div className="flex items-center gap-2">
                  {/* Data e hora */}
                  <div className="flex items-center flex-shrink-0">
                    {dateDisplay ? (
                      <div className="flex flex-col items-start min-w-[3rem]">
                        <span className="text-muted-foreground leading-none text-[9px] font-semibold uppercase tracking-wide">
                          {dateDisplay.dayOfWeek}
                        </span>
                        <span className="text-muted-foreground/80 leading-tight text-[9px] font-medium mt-0.5">
                          {dateDisplay.date}
                          {' '}
                          <span className="font-semibold">
                            {dateDisplay.time}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start min-w-[3rem]">
                        <span className="text-muted-foreground leading-none text-[9px] font-semibold uppercase tracking-wide">
                          ---
                        </span>
                        <span className="text-muted-foreground/70 leading-tight text-[9px] font-medium mt-0.5">
                          --/-- ??:??
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Separador vertical */}
                  <div className="h-6 w-px bg-border flex-shrink-0" />

                  {/* Confronto compacto com palpite */}
                  <div className="flex-1 flex items-center min-w-0">
                    {/* Nome time 1 */}
                    <div className="flex-1 flex justify-end pr-1.5 min-w-0">
                      <span className="text-sm font-semibold truncate text-right leading-tight text-foreground">
                        {match.homeTeam}
                      </span>
                    </div>
                    
                    {/* Escudos e palpite centralizados */}
                    <div className="w-[80px] flex items-center gap-1 justify-center flex-shrink-0 px-1">
                      <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-5 w-5" noCircle />
                      <span className="text-xs font-bold flex-shrink-0 min-w-[2rem] text-center text-primary">
                        {pred.homeScore} × {pred.awayScore}
                      </span>
                      <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-5 w-5" noCircle />
                    </div>
                    
                    {/* Nome time 2 */}
                    <div className="flex-1 flex justify-start pl-1.5 min-w-0">
                      <span className="text-sm font-semibold truncate text-left leading-tight text-foreground">
                        {match.awayTeam}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0">
      <PulsingBall
        show={showPulsingBall}
        matchInfo={lastScoreUpdate || undefined}
        onClick={() => setShowPulsingBall(false)}
      />
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              // Voltar para o lugar correto baseado na origem
              if (isFromAdmin && roundParam) {
                navigate(`/admin?view=manage-palpites&round=${roundParam}`)
              } else if (isFromAdmin) {
                navigate('/admin?view=manage-palpites')
              } else if (isFromRanking) {
                navigate(`/ranking?round=${ticket.round}`)
              } else {
                navigate('/tickets')
              }
            }}
            className="rounded-full h-10 w-10 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Palpite #{ticket.id.slice(-6)}</h1>
            <p className="text-sm text-muted-foreground">
              {displayUserName} • Rodada {ticket.round}
            </p>
          </div>
          {ticket.status === 'confirmed' ? (
            <CheckCircle className="h-5 w-5 text-primary" />
          ) : ticket.status === 'cancelled' ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Clock className="h-5 w-5 text-yellow-500" />
          )}
        </div>

        {/* Pending Confirmation Box - não mostrar para admin */}
        {ticket.status === 'pending' && !isFromAdmin && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 space-y-2"
          >
            <Card className="bg-yellow-500/20 border-yellow-500/50 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-yellow-500">Aguardando Confirmação</p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleWhatsAppConfirmation}
                      className="bg-green-500 hover:bg-green-600 text-white rounded-full h-7 px-3 text-xs flex-shrink-0"
                    >
                      <MessageSquare className="mr-1.5 h-3 w-3" />
                      Solicitar
                    </Button>
                  </div>
                  {isOwnTicket && allowsNewBets !== false && (
                    <p className="text-xs text-yellow-500/80">
                      Você pode editar este palpite clicando em qualquer jogo abaixo enquanto não estiver confirmado.
                    </p>
                  )}
                </div>
              </div>
            </Card>
            {allowsNewBets === false && (
              <Card className="bg-red-500/20 border-red-500/50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-500">Palpite não confirmado</p>
                    <p className="text-xs text-red-500/80 mt-0.5">
                      Este palpite não foi confirmado e a rodada não aceita mais edição ou criação de novos palpites.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </motion.div>
          )}

        {/* Confirmed Box - não mostrar para admin nem quando vem do ranking */}
        {ticket.status === 'confirmed' && !isFromAdmin && !isFromRanking && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <Card className="bg-green-500/20 border-green-500/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-500">Palpite Confirmado</p>
                  <p className="text-xs text-green-500/80 mt-0.5">
                    Este palpite foi confirmado e está participando do ranking.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Cancelled Box */}
        {ticket.status === 'cancelled' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3"
          >
            <Card className="bg-red-500/20 border-red-500/50 rounded-lg">
              <div className="flex flex-col items-center gap-2 text-center p-2">
                <XCircle className="h-6 w-6 text-red-500" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-500">Palpite Cancelado</p>
                  <p className="text-xs text-red-500/80">
                    Este palpite foi cancelado e não será considerado no ranking.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
          )}
          
        {/* Container dos Jogos - Modo Ranking ou Tickets */}
        {loading || showLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : isFromRanking ? renderRankingMode() : renderTicketsMode()}

        {/* Pontuação Total - apenas no modo Ranking */}
        {isFromRanking && (() => {
          // Verificar se todos os jogos da rodada estão finalizados
          const allMatchesFinished = matches.length > 0 && matches.every(m => m.status === 'finished')
          const isPartialResult = !allMatchesFinished
          
          return (
            <Card className="border-primary/50 bg-primary/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Pontuação Total</p>
                    {isPartialResult && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/50">
                        Resultado Parcial
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {ticket.points ?? 0}
                  </p>
                </div>
              </div>
            </Card>
          )
        })()}

        {/* Botões de Aprovar/Cancelar - apenas para admin */}
        {isFromAdmin && ticket.status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-2"
          >
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="lg"
                onClick={handleConfirmTicket}
                disabled={savingStatus.confirm}
                className="flex-1"
              >
                {savingStatus.confirm ? (
                  'Aprovando...'
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aprovar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleCancelTicket}
                disabled={savingStatus.cancel}
                className="flex-1 text-red-400 border-red-400/50 hover:bg-red-400/10 hover:border-red-400"
              >
                {savingStatus.cancel ? (
                  'Cancelando...'
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Botão de Excluir - apenas para tickets pendentes do próprio usuário (não mostrar para admin) */}
        {isOwnTicket && ticket.status === 'pending' && !isFromAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2"
          >
            <Button
              variant="outline"
              size="lg"
              onClick={handleDeleteTicket}
              className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10 hover:border-red-500"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
