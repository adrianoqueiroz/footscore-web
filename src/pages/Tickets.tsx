import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Clock, Eye, XCircle, Plus, Users, Info, Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import Button from '@/components/ui/Button'
import RoundSelector from '@/components/ui/RoundSelector'
import PulsingBall from '@/components/ui/PulsingBall'
import ContentWrapper from '@/components/ui/ContentWrapper'
import { ticketService } from '@/services/ticket.service'
import { authService } from '@/services/auth.service'
import { matchService } from '@/services/match.service'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePageVisibility } from '@/hooks/usePageVisibility'
import { Ticket, Match } from '@/types'
import { format } from 'date-fns'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'

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

// Função para mascarar apelido do usuário (mesma lógica do nome)
const maskNickname = (nickname: string): string => {
  if (!nickname || nickname.length === 0) {
    return ''
  }
  const firstLetter = nickname.trim().charAt(0).toUpperCase()
  const FIXED_LENGTH = 9
  const asterisks = '*'.repeat(FIXED_LENGTH - 1)
  return firstLetter + asterisks
}

type TabView = 'my' | 'round'

export default function Tickets() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [confirmedTickets, setConfirmedTickets] = useState<Ticket[]>([])

  // AbortController para cancelar operações quando a página muda
  const abortControllerRef = useRef<AbortController | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [loadingConfirmed, setLoadingConfirmed] = useState(false)
  const [confirmedTicketsCount, setConfirmedTicketsCount] = useState<number>(0)
  const [loadingCount, setLoadingCount] = useState(false)
  const [allowsNewBets, setAllowsNewBets] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [activeTab, setActiveTab] = useState<TabView>('my')
  const [showPulsingBall, setShowPulsingBall] = useState(false)
  const [lastScoreUpdate, setLastScoreUpdate] = useState<{ homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; goalScorer?: 'home' | 'away' | null; isGoalCancelled?: boolean; homeTeamLogo?: string | null; awayTeamLogo?: string | null } | null>(null)
  const [notificationPreferences, setNotificationPreferences] = useState<{
    bellGoalsAllTeams: boolean
    bellGoalsFavoriteTeam: boolean
  } | null>(null)
  const { rounds, selectedRound, setSelectedRound, loading: roundsLoading, refreshRounds, validateSelection } = useRoundSelector()
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

  // Recarregar dados quando a página volta a ficar visível
  usePageVisibility({
    onVisible: () => {
      if (selectedRound) {
        loadPageData()
        if (selectedRound) {
          loadRoundStatus()
        }
      }
    },
    reloadOnFocus: true,
    delay: 500,
  })

  // Conectar ao SSE para receber atualizações de placar
  useMatchEvents((event) => {
    if (event.type === 'score_update' && event.data.scoreChanged && !event.data.isGoalCancelled) {
      // Verificar se deve mostrar a bolinha pulsando baseado nas preferências
      if (!notificationPreferences) return // Aguardar preferências carregarem
      
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
      
      if (!shouldNotifyAll && !shouldNotifyFavorite) {
        // Não deve mostrar a bolinha, mas ainda recarregar dados
        loadPageData()
        return
      }

      // Recarregar matches quando placar atualizar (sempre, não apenas se for a rodada selecionada)
      loadPageData()

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
  })

  const loadPageData = useCallback(async () => {
    // Cancelar operação anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Criar novo AbortController para esta operação
    abortControllerRef.current = new AbortController()

    setPageLoading(true)
    try {
      const user = authService.getCurrentUser()
      if (!user) {
        setPageLoading(false)
        return
      }

      const [ticketsData, matchesData] = await Promise.all([
        ticketService.getTicketsByUser(user.id),
        matchService.getAllMatches(),
      ])

      setTickets(ticketsData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ))
      setMatches(matchesData)
    } catch (error: any) {
      console.error('Error loading tickets page data:', error)
      // Garantir que arrays vazios sejam definidos em caso de erro
      setTickets([])
      setMatches([])
      // Mostrar toast de erro apenas se não for erro de conexão genérico
      if (error?.status !== 0 || error?.message?.includes('conexão')) {
        toast.error(error?.message || 'Erro ao carregar dados')
      }

      // Verificar se a operação foi cancelada
      if (abortControllerRef.current?.signal.aborted) {
        return
      }
    } finally {
      // Só atualizar loading se a operação não foi cancelada
      if (!abortControllerRef.current?.signal.aborted) {
        setPageLoading(false)
      }
    }
  }, [toast])

  // Cleanup effect para cancelar operações quando o componente desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const loadRoundStatus = useCallback(async () => {
    if (!selectedRound) {
      setAllowsNewBets(true)
      setIsBlocked(false)
      return
    }
    try {
      const status = await matchService.getRoundStatus(selectedRound)
      if (status) {
        setAllowsNewBets(status.allowsNewBets)
        setIsBlocked(status.isBlocked)
      }
    } catch (error) {
      console.error('Error loading round status:', error)
      // Em caso de erro, manter valores padrão
      setAllowsNewBets(true)
      setIsBlocked(false)
    }
  }, [selectedRound])

  useEffect(() => {
    loadPageData()
  }, [loadPageData])

  // Validar seleção quando rodadas mudam
  useEffect(() => {
    if (rounds.length > 0) {
      validateSelection()
    }
  }, [rounds, validateSelection])

  // Atualizar status da rodada quando selectedRound mudar e periodicamente
  useEffect(() => {
    if (!selectedRound) {
      // Resetar estados quando não há rodada selecionada
      setAllowsNewBets(true)
      setIsBlocked(false)
      return
    }

    // Verificar status imediatamente quando a rodada muda
    loadRoundStatus()

    // Verificar status a cada 30 segundos
    const interval = setInterval(() => {
      loadRoundStatus()
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedRound, loadRoundStatus])

  useEffect(() => {
    if (selectedRound) {
      // Resetar contagem ao trocar de rodada
      setConfirmedTicketsCount(0)
      
      if (!allowsNewBets) {
        // Se não permite mais palpites, carregar lista completa
        loadConfirmedTickets()
      } else {
        // Se permite novos palpites, carregar apenas a contagem
        setConfirmedTickets([])
        loadConfirmedTicketsCount()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound, allowsNewBets])

  const loadConfirmedTicketsCount = async () => {
    if (!selectedRound) return
    setLoadingCount(true)
    try {
      // Usar ranking apenas para obter a contagem (mais leve que buscar todos os detalhes)
      const ranking = await ticketService.getRanking(selectedRound, true)
      setConfirmedTicketsCount(ranking.length)
    } catch (error) {
      console.error('Error loading confirmed tickets count:', error)
      setConfirmedTicketsCount(0)
    } finally {
      setLoadingCount(false)
    }
  }

  const loadConfirmedTickets = async () => {
    if (!selectedRound) return
    setLoadingConfirmed(true)
    try {
      const user = authService.getCurrentUser()
      
      // Buscar todos os tickets confirmados da rodada diretamente
      const allConfirmedTickets = await ticketService.getConfirmedTicketsByRound(selectedRound)
      
      
      // Atualizar contagem
      setConfirmedTicketsCount(allConfirmedTickets.length)
      
      // Mascarar nomes e apelidos dos tickets (exceto o do próprio usuário)
      const ticketsWithMaskedNames = allConfirmedTickets.map(ticket => {
        if (user && ticket.userId === user.id) {
          // Manter nome e apelido completos do próprio usuário
          return ticket
        }
        // Mascarar nome e apelido dos outros
        const ticketNickname = (ticket as any).userNickname || (ticket as any).nickname
        return {
          ...ticket,
          userName: maskUserName(ticket.userName),
          ...(ticketNickname && {
            userNickname: maskNickname(ticketNickname),
            nickname: maskNickname(ticketNickname)
          })
        }
      })
      
      setConfirmedTickets(ticketsWithMaskedNames.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ))
    } catch (error) {
      console.error('Error loading confirmed tickets:', error)
      // Em caso de erro, tentar usar o ranking como fallback
      try {
        const ranking = await ticketService.getRanking(selectedRound, true)
        setConfirmedTicketsCount(ranking.length)
        setConfirmedTickets([])
      } catch (fallbackError) {
        console.error('Error loading confirmed tickets (fallback):', fallbackError)
      }
    } finally {
      setLoadingConfirmed(false)
    }
  }

  const filteredTickets = useMemo(() => {
    if (!selectedRound) return []
    
    const filtered = tickets.filter((ticket: Ticket) => ticket.round === selectedRound)
    
    // Sort by earliest match date in each ticket
    return filtered.sort((a: Ticket, b: Ticket) => {
      const getEarliestMatchDate = (ticket: Ticket) => {
        const predictions = Array.isArray(ticket.predictions) ? ticket.predictions : []
        
        if (matches.length === 0) {
          return new Date(ticket.createdAt).getTime()
        }
        
        const matchDates = predictions
          .map(pred => matches.find(m => m.id === pred.matchId))
          .filter((m): m is Match => Boolean(m))
          .map(m => new Date(`${m.date}T${m.time}`).getTime())
        return matchDates.length > 0 ? Math.min(...matchDates) : Infinity
      }
      
      return getEarliestMatchDate(a) - getEarliestMatchDate(b)
    })
  }, [tickets, selectedRound, matches])

  const handleDeleteTicket = async (ticketId: string) => {
    const confirmed = await confirm.confirm({
      title: 'Excluir Palpite',
      message: 'Tem certeza que deseja excluir este palpite? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Excluir Palpite',
    })
    if (!confirmed) return

    try {
      await ticketService.deleteTicket(ticketId)
      toast.success('Palpite excluído com sucesso')
      loadPageData()
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
      if (status && !status.allowsNewBets) {
        // Atualizar estado local (a mensagem já existente será exibida automaticamente)
        setAllowsNewBets(false)
        setIsBlocked(status.isBlocked || false)
        return
      }
      
      // Se permite novos palpites, navegar normalmente (mesmo se isBlocked for true, se allowsNewBets for true, permite)
      setAllowsNewBets(status?.allowsNewBets ?? true)
      setIsBlocked(status?.isBlocked || false)
      navigate(`/games?round=${selectedRound}`)
    } catch (error) {
      console.error('Error checking round status:', error)
      // Em caso de erro, tentar navegar mesmo assim (o backend vai validar)
      navigate(`/games?round=${selectedRound}`)
    }
  }


  const renderTicketCard = (ticket: Ticket, index: number, isUserTicket: boolean = true) => {
    const user = authService.getCurrentUser()
    const isOwnTicket = user && ticket.userId === user.id
    const ticketNickname = ticket.userNickname || ticket.nickname
    
    return (
      <motion.div
        key={ticket.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <Card 
          className="p-3 cursor-pointer hover:opacity-80 active:opacity-70 transition-opacity"
          onClick={() => navigate(`/tickets/${ticket.id}`)}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Conteúdo principal */}
            <div className="flex-1 min-w-0">
              {/* Primeira linha: Número do bilhete */}
              <div className="mb-1">
                <span className="text-sm font-semibold text-muted-foreground">Bilhete #{ticket.id.slice(-6)}</span>
              </div>

              {/* Segunda linha: Nome e apelido lado a lado */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className={`text-sm font-semibold truncate ${isOwnTicket ? 'text-primary' : 'text-foreground'}`}>
                  {ticket.userName}
                </p>
                {ticketNickname && (
                  <span className="text-xs text-muted-foreground">({ticketNickname})</span>
                )}
                {isOwnTicket && <span className="ml-1.5 text-xs text-primary/70">(Você)</span>}
              </div>

              {/* Segunda linha: Criação e Confirmação */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Criação:</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ticket.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                  </span>
                </div>
                {ticket.status === 'pending' && (
                  <span className="text-xs text-yellow-500 font-medium">Aguardando confirmação</span>
                )}
                {ticket.status === 'cancelled' && (
                  <span className="text-xs text-red-500 font-medium">Cancelado</span>
                )}
                {ticket.status === 'confirmed' && ticket.confirmedAt && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confirmação:</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ticket.confirmedAt), "dd/MM/yyyy 'às' HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações à direita */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Ícone de status */}
              {ticket.status === 'confirmed' ? (
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
              ) : ticket.status === 'pending' ? (
                <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              ) : ticket.status === 'cancelled' ? (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              ) : null}
              
            </div>
          </div>
        </Card>
      </motion.div>
    )
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
            <h1 className="text-2xl md:text-3xl font-bold">Palpites</h1>
            <RoundSelector
              rounds={rounds}
              selectedRound={selectedRound}
              onRoundChange={setSelectedRound}
              onOpen={refreshRounds}
            />
          </div>

        {/* Abas de visualização */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'my' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('my')}
            className="flex-1"
          >
            Meus Palpites
            <span className={`ml-2 text-xs bg-background/50 px-1.5 py-0.5 rounded min-w-[20px] text-center inline-block ${pageLoading || roundsLoading ? 'opacity-40' : ''}`}>
              {selectedRound ? filteredTickets.length : 0}
            </span>
          </Button>
          <Button
            variant={activeTab === 'round' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('round')}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-1.5" />
            Todos
            <span className={`ml-2 text-xs bg-background/50 px-1.5 py-0.5 rounded min-w-[20px] text-center inline-block ${loadingCount || loadingConfirmed ? 'opacity-40' : ''}`}>
              {selectedRound ? confirmedTicketsCount : 0}
            </span>
          </Button>
        </div>

        {/* Mensagem quando não há rodadas ativas */}
        {!selectedRound && rounds.length === 0 && !roundsLoading && (
          <Card className="p-6 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">
              Nenhuma rodada ativa no momento
            </p>
            <p className="text-xs text-muted-foreground">
              Não há rodadas disponíveis para visualização de palpites. Entre em contato com o administrador.
            </p>
          </Card>
        )}

        {/* Conteúdo da aba: Meus Palpites */}
        {selectedRound && activeTab === 'my' && (
          <div className="space-y-3">
            {/* Aviso de rodada finalizada */}
            {!allowsNewBets && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-red-500/20 border border-red-500/50 p-3 flex items-start gap-2"
              >
                <Lock className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-500">
                  Os palpites para esta rodada estão encerrados.
                </p>
              </motion.div>
            )}

            {!pageLoading && !roundsLoading && filteredTickets.length === 0 && (
              <Card className="p-6">
                <div className="text-center space-y-4">
                  <Info className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-muted-foreground">
                    Você ainda não criou nenhum palpite nesta rodada
                  </p>
                </div>
              </Card>
            )}

            <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
              {pageLoading ? (
                <>
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </>
              ) : (
                filteredTickets.map((ticket, index) => renderTicketCard(ticket, index, true))
              )}
            </div>

            {/* Botão Novo Palpite - apenas se permite novos palpites */}
            {!pageLoading && !roundsLoading && selectedRound && allowsNewBets && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2"
              >
                <Button
                  onClick={handleNewPrediction}
                  size="lg"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Palpite
                </Button>
              </motion.div>
            )}
          </div>
        )}

        {/* Conteúdo da aba: Todos */}
        {selectedRound && activeTab === 'round' && (
          <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
            {allowsNewBets ? (
              // Quando ainda permite novos palpites
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <Card className="bg-yellow-500/10 border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-3 p-4">
                    <Info className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-semibold text-yellow-500">
                        Criação de Palpites Ativada
                      </p>
                      <p className="text-xs text-yellow-500/80">
                        Todos os palpites serão exibidos quando a rodada não permitir mais criação de novos palpites.
                      </p>
                      {loadingCount ? (
                        <div className="pt-1">
                          <span className="text-xs text-yellow-500/60">Carregando...</span>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <p className="text-sm font-semibold text-yellow-500">
                            <span className="text-base font-bold">{confirmedTicketsCount}</span> palpite{confirmedTicketsCount !== 1 ? 's' : ''} confirmado{confirmedTicketsCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : (
              // Quando não permite mais palpites - mostrar lista completa
              <>
                {/* Aviso informativo */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 flex items-start gap-2"
                >
                  <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-500">
                    Todos os palpites válidos confirmados para esta rodada.
                  </p>
                </motion.div>

                {loadingConfirmed ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-32" />
                    ))}
                  </div>
                ) : confirmedTickets.length === 0 ? (
                  <Card>
                    <p className="text-muted-foreground text-center py-6 text-sm">
                      Nenhum palpite confirmado nesta rodada
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
                    {confirmedTickets.map((ticket, index) => renderTicketCard(ticket, index, false))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        </div>
    </ContentWrapper>
  )
}
