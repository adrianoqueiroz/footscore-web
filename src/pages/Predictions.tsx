import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, ChevronLeft, ChevronRight, Eye, Info, X, Plus, Minus, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import TeamLogo from '@/components/ui/TeamLogo'
import { matchService } from '@/services/match.service'
import { ticketService } from '@/services/ticket.service'
import { authService } from '@/services/auth.service'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { Match, Prediction, Ticket } from '@/types'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'
import { parseMatchDateTime } from '@/lib/utils'
import { getTeamDisplayName } from '@/lib/teamNames'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ViewMode = 'cards' | 'preview'

export default function Predictions() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [matches, setMatches] = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isEditingFromPreview, setIsEditingFromPreview] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const carouselContainerRef = useRef<HTMLDivElement>(null)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [isDraggingHorizontally, setIsDraggingHorizontally] = useState(false)
  const [isButtonPressed, setIsButtonPressed] = useState(false)
  const { rounds, selectedRound, setSelectedRound, validateSelection } = useRoundSelector()
  const toast = useToastContext()
  const confirm = useConfirmContext()
  const showMatchesLoading = useDelayedLoading(matchesLoading)
  const triggerHaptic = useHapticFeedback()
  const [showScoreHint, setShowScoreHint] = useState<Record<string, 'home' | 'away' | null>>({})


  // Ler parâmetros da URL
  useEffect(() => {
    const roundParam = searchParams.get('round')
    const ticketIdParam = searchParams.get('ticketId')
    
    if (roundParam && rounds.length > 0) {
      const roundNumber = parseInt(roundParam, 10)
      if (!isNaN(roundNumber) && rounds.includes(roundNumber)) {
        setSelectedRound(roundNumber)
      }
    }
    
    if (ticketIdParam) {
      setEditingTicketId(ticketIdParam)
      setIsEditingFromPreview(true) // Quando está editando um ticket, mostrar botão voltar
    } else {
      setEditingTicketId(null)
    }
  }, [searchParams, rounds, setSelectedRound])

  useEffect(() => {
    if (selectedRound) {
      loadMatches()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound, editingTicketId])

  // Validar seleção quando rodadas mudam
  useEffect(() => {
    if (rounds.length > 0) {
      validateSelection()
    }
  }, [rounds, validateSelection])

  // Garantir que todas as previsões sejam inicializadas quando matches mudarem
  useEffect(() => {
    if (matches.length > 0) {
      setPredictions(prev => {
        const updated = { ...prev }
        let hasChanges = false
        
        matches.forEach((match: Match) => {
          if (!updated[match.id]) {
            updated[match.id] = {
              matchId: match.id,
              homeScore: 0,
              awayScore: 0,
            }
            hasChanges = true
          }
        })
        
        return hasChanges ? updated : prev
      })
    }
  }, [matches])

  useEffect(() => {
    if (selectedRound) {
      loadRoundStatus()
    }
  }, [selectedRound])

  // Calcular largura do carrossel
  useEffect(() => {
    if (matches.length === 0) return
    
    const updateCarouselWidth = () => {
      if (carouselContainerRef.current) {
        const rect = carouselContainerRef.current.getBoundingClientRect()
        if (rect.width > 0) {
          setCarouselWidth(rect.width)
        }
      }
    }
    
    const timeoutId = setTimeout(updateCarouselWidth, 100)
    
    const observer = new ResizeObserver(() => {
      updateCarouselWidth()
    })
    
    if (carouselContainerRef.current) {
      observer.observe(carouselContainerRef.current)
    }
    
    window.addEventListener('resize', updateCarouselWidth)
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateCarouselWidth)
      observer.disconnect()
    }
  }, [matches.length])

  const loadRoundStatus = async () => {
    if (!selectedRound) return
    try {
      // Carregar status da rodada (allowsNewBets)
      // A única regra é: se allowsNewBets está true, permite. Ponto.
      const status = await matchService.getRoundStatus(selectedRound)
      if (status) {
        // Se allowsNewBets é true, permite independente de outras flags
        setIsLocked(!status.allowsNewBets)
      } else {
        // Se não tem status, assume que permite (padrão)
        setIsLocked(false)
      }

    } catch (error) {
      console.error('Error loading round status:', error)
      // Em caso de erro, assume que permite (padrão)
      setIsLocked(false)
    }
  }

  const loadMatches = async () => {
    if (!selectedRound) return
    setMatchesLoading(true)
    try {
      const data = await matchService.getMatchesByRound(selectedRound, true)
      // Filtrar apenas jogos incluídos na rodada (includeInRound !== false)
      // Jogos não incluídos não aparecem no carrossel porque não são contabilizados no ranking
      const filteredData = data.filter(match => match.includeInRound !== false)
      setMatches(filteredData)
      
      // Se está editando um ticket, carregar as predictions existentes
      if (editingTicketId) {
        try {
          const ticket = await ticketService.getTicketById(editingTicketId)
          if (ticket && ticket.predictions) {
            const existingPredictions: Record<string, Prediction> = {}
            filteredData.forEach((match: Match) => {
              const existingPred = Array.isArray(ticket.predictions) 
                ? ticket.predictions.find((p: any) => p.matchId === match.id)
                : null
              
              existingPredictions[match.id] = existingPred || {
                matchId: match.id,
                homeScore: 0,
                awayScore: 0,
              }
            })
            setPredictions(existingPredictions)
          } else {
            // Se não encontrou o ticket, inicializar com zeros
            const initial: Record<string, Prediction> = {}
            filteredData.forEach((match: Match) => {
              initial[match.id] = {
                matchId: match.id,
                homeScore: 0,
                awayScore: 0,
              }
            })
            setPredictions(initial)
          }
        } catch (error) {
          console.error('Error loading ticket for editing:', error)
          // Em caso de erro, inicializar com zeros
          const initial: Record<string, Prediction> = {}
          filteredData.forEach((match: Match) => {
            initial[match.id] = {
              matchId: match.id,
              homeScore: 0,
              awayScore: 0,
            }
          })
          setPredictions(initial)
        }
      } else {
        // Se não está editando, inicializar com zeros
        const initial: Record<string, Prediction> = {}
        filteredData.forEach((match: Match) => {
          initial[match.id] = {
            matchId: match.id,
            homeScore: 0,
            awayScore: 0,
          }
        })
        setPredictions(initial)
      }
      
      // Se está editando e há matchId na URL, ir direto para esse jogo
      const matchIdParam = searchParams.get('matchId')
      if (matchIdParam && editingTicketId) {
        const matchIndex = data.findIndex((m: Match) => m.id === matchIdParam)
        if (matchIndex !== -1) {
          setCurrentIndex(matchIndex)
          // Remover matchId da URL após usar
          const newSearchParams = new URLSearchParams(searchParams)
          newSearchParams.delete('matchId')
          navigate(`/games?${newSearchParams.toString()}`, { replace: true })
        } else {
          setCurrentIndex(0)
        }
      } else {
        setCurrentIndex(0)
      }
    } catch (error) {
      console.error('Error loading matches:', error)
    } finally {
      setMatchesLoading(false)
    }
  }

  const handleScoreChange = (matchId: string, type: 'home' | 'away', value: number) => {
    if (isLocked) return
    
    setPredictions(prev => {
      const current = prev[matchId] || { matchId, homeScore: 0, awayScore: 0 }
      return {
        ...prev,
        [matchId]: {
          ...current,
          [type === 'home' ? 'homeScore' : 'awayScore']: value,
        },
      }
    })
  }

  const handleNext = () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else if (currentIndex === matches.length - 1) {
      handleShowPreview()
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleShowPreview = () => {
    setViewMode('preview')
  }

  const handleBackToCards = () => {
    setViewMode('cards')
    setIsEditingFromPreview(false)
  }

  const handleEditMatch = (matchId: string) => {
    const index = matches.findIndex(m => m.id === matchId)
    if (index !== -1) {
      setCurrentIndex(index)
      setViewMode('cards')
      setIsEditingFromPreview(true)
      setShowSummaryModal(false)
    }
  }

  const handleSubmit = async () => {
    const user = authService.getCurrentUser()
    if (!user || !selectedRound) return

    // Verificar status da rodada antes de submeter (pode ter mudado enquanto o usuário estava preenchendo)
    // A única regra é: se allowsNewBets está true, permite. Ponto.
    try {
      const status = await matchService.getRoundStatus(selectedRound)
      if (status && status.allowsNewBets === false) {
        // Se allowsNewBets é explicitamente false, bloqueia
        setIsLocked(true)
        const errorMessage = editingTicketId 
          ? 'Esta rodada não aceita mais edições de palpites.'
          : 'Esta rodada não aceita mais palpites.'
        toast.error(errorMessage)
        return
      }
      // Se allowsNewBets é true ou não existe (undefined/null), permite
      setIsLocked(false)
    } catch (error) {
      console.error('Error checking round status:', error)
      // Em caso de erro, permite continuar (o backend vai validar)
      setIsLocked(false)
    }

    const predictionsArray = Object.values(predictions)
    const hasPredictions = predictionsArray.some(p => p.homeScore > 0 || p.awayScore > 0)
    
    if (!hasPredictions) {
      const confirmed = await confirm.confirm({
        title: 'Atenção',
        message: 'Nenhum placar foi alterado (todos estão em 0x0).\n\nDeseja continuar mesmo assim?',
        variant: 'warning',
      })
      if (!confirmed) return
    }

    setSubmitting(true)
    try {
      let savedTicket: Ticket
      
      if (editingTicketId) {
        // Atualizar ticket existente
        savedTicket = await ticketService.updateTicket(editingTicketId, predictionsArray)
        toast.success('Palpite atualizado com sucesso!')
      } else {
        // Criar novo ticket
        savedTicket = await ticketService.createTicket(user.id, user.name, selectedRound, predictionsArray)
        toast.success('Palpite criado com sucesso!')
      }
      
      // Reinicializar predictions apenas com matches incluídos na rodada
      const initial: Record<string, Prediction> = {}
      matches.filter(match => match.includeInRound !== false).forEach(match => {
        initial[match.id] = {
          matchId: match.id,
          homeScore: 0,
          awayScore: 0,
        }
      })
      setPredictions(initial)
      setCurrentIndex(0)
      setViewMode('cards')
      setIsEditingFromPreview(false)
      setEditingTicketId(null)
      
      navigate(`/tickets/${savedTicket.id}`)
    } catch (error: any) {
      console.error('Error creating ticket:', error)
      
      const errorMessage = error?.message || error?.error || ''
      
      // Verificar se é erro de rodada fechada - apenas se o backend retornar explicitamente
      const isRoundClosedError = 
        error?.status === 400 && (
          errorMessage.includes('não permite novos palpites') ||
          errorMessage.includes('não permite mais') ||
          errorMessage.includes('bloqueados') ||
          errorMessage.includes('Rodada não está ativa')
        )
      
      if (isRoundClosedError) {
        // Se o backend retornou erro de rodada fechada, verificar status novamente
        try {
          const status = await matchService.getRoundStatus(selectedRound)
          // Só bloquear se o status confirmar que não permite
          if (status && status.allowsNewBets === false) {
            setIsLocked(true)
            toast.error('Esta rodada não aceita mais palpites.')
          } else {
            // Se o status diz que permite, mostrar erro mas não bloquear
            toast.error(errorMessage || 'Erro ao criar palpite. Tente novamente.')
          }
        } catch (statusError) {
          // Se não conseguir verificar status, mostrar erro mas não bloquear
          toast.error(errorMessage || 'Erro ao criar palpite. Tente novamente.')
        }
      } else {
        // Outros erros - apenas mostrar mensagem
        toast.error(errorMessage || 'Erro ao criar palpite. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Calcular progresso - inicia em 0% quando está no primeiro jogo, 100% no último
  const progress = matches.length > 0 
    ? matches.length === 1
      ? 100
      : currentIndex === 0 
        ? 0 
        : currentIndex === matches.length - 1 
          ? 100 
          : (currentIndex / (matches.length - 1)) * 100
    : 0
  const completedMatches = Object.values(predictions).filter(p => p.homeScore > 0 || p.awayScore > 0).length

  // Renderizar preview final
  if (viewMode === 'preview') {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 select-none relative">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToCards}
              className="!rounded-full !h-10 !w-10 !p-0 !px-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold flex-1">Revisar Palpites</h1>
          </div>

          <Card className="bg-blue-500/20 border-blue-500/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-500">
                Toque em qualquer jogo para editar o palpite
              </p>
            </div>
          </Card>

          {showMatchesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((match, index) => {
                const pred = predictions[match.id] || { matchId: match.id, homeScore: 0, awayScore: 0 }
                const matchDate = parseMatchDateTime(match)
                const dateDisplay = matchDate ? {
                  dayOfWeek: format(matchDate, "EEE", { locale: ptBR }),
                  date: format(matchDate, "dd/MM"),
                  time: match.time || '??:??'
                } : null

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Card
                      className="p-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => handleEditMatch(match.id)}
                    >
                      <div className="flex items-center gap-3">
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
                              {getTeamDisplayName(match.homeTeam)}
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
                              {getTeamDisplayName(match.awayTeam)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}

          {matches.length > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? 'Enviando...' : 'Concluir'}
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (matches.length === 0 && !matchesLoading) {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 select-none relative">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
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
            <h1 className="text-2xl md:text-3xl font-bold flex-1">
              {editingTicketId ? 'Revisar Palpite' : 'Novo Palpite'}
            </h1>
          </div>

          <div className="text-center py-10">
            <p className="text-muted-foreground">Nenhuma partida encontrada para a rodada selecionada.</p>
          </div>
        </div>
      </div>
    )
  }

  const currentMatch = matches[currentIndex]
  const currentPrediction = currentMatch ? predictions[currentMatch.id] || { matchId: currentMatch.id, homeScore: 0, awayScore: 0 } : null
  const matchLocked = currentMatch ? matchService.isMatchLocked(currentMatch) : false

  // Classes CSS para os cards (cores neutras para consistência)
  const getMatchCardClasses = () => {
    return 'border border-border bg-secondary/50 shadow-lg'
  }



  // Renderizar preview final
  if (viewMode === 'preview') {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 select-none relative">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToCards}
              className="!rounded-full !h-10 !w-10 !p-0 !px-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold flex-1">Revisar Palpites</h1>
          </div>

          <Card className="bg-blue-500/20 border-blue-500/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-500">
                Toque em qualquer jogo para editar o palpite
              </p>
            </div>
          </Card>

          <div className="space-y-2">
            {matches.map((match, index) => {
              const pred = predictions[match.id] || { matchId: match.id, homeScore: 0, awayScore: 0 }
              const matchDate = parseMatchDateTime(match)
              const dateDisplay = matchDate ? {
                dayOfWeek: format(matchDate, "EEE", { locale: ptBR }),
                date: format(matchDate, "dd/MM"),
                time: match.time || '??:??'
              } : null
              
              return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card 
                    className="p-2 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => handleEditMatch(match.id)}
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
                            {getTeamDisplayName(match.homeTeam)}
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
                            {getTeamDisplayName(match.awayTeam)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {isLocked ? (
            <Card className="bg-red-500/20 border-red-500/50 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-500 font-medium">
                  Rodada bloqueada
                </p>
              </div>
            </Card>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
              className="w-full"
            >
              {submitting ? 'Enviando...' : 'Concluir'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Renderizar cards deslizantes
  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] overflow-x-hidden relative min-h-0 select-none">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8 overflow-x-hidden">
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
          <h1 className="text-2xl md:text-3xl font-bold flex-1">
            {editingTicketId ? 'Revisar Palpite' : 'Novo Palpite'}
          </h1>
        </div>


        {/* Card do confronto (carrossel arrastável) */}
        {showMatchesLoading ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : matches.length > 0 ? (
          <Card className={`p-0 relative overflow-hidden ${getMatchCardClasses()}`}>
            {/* Header */}
            <div className="px-4 pt-3 pb-2 border-b border-border/30">
              <div className="flex items-center justify-center">
                {currentMatch && (
                  <span className="text-base font-semibold text-foreground">
                    {format(new Date(`${currentMatch.date}T${currentMatch.time}`), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
                {!currentMatch && (
                  <span className="text-base font-semibold text-foreground">
                    Confrontos
                  </span>
                )}
              </div>
            </div>
            <div 
              ref={carouselContainerRef} 
              className="relative overflow-hidden pt-3 pb-1"
              style={{ touchAction: isDraggingHorizontally ? 'pan-x' : 'pan-y pinch-zoom' }}
            >
              <motion.div
                className="flex"
                animate={{
                  x: `-${currentIndex * 100}%`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
                drag="x"
                dragConstraints={
                  carouselWidth > 0
                    ? {
                        left: -(matches.length - 1) * carouselWidth,
                        right: 0,
                      }
                    : false
                }
                dragElastic={0.2}
                dragDirectionLock={true}
                onDrag={(_, info) => {
                  // Detectar se está arrastando horizontalmente (movimento horizontal maior que vertical)
                  const isHorizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y) && Math.abs(info.offset.x) > 10
                  if (isHorizontal !== isDraggingHorizontally) {
                    setIsDraggingHorizontally(isHorizontal)
                  }
                }}
                onDragStart={(e) => {
                  const target = e.target as HTMLElement
                  if (target.closest('button') || target.closest('[data-navigation]')) {
                    return false
                  }
                }}
                onDragEnd={(_, info) => {
                  // Reabilitar scroll vertical após o drag
                  setIsDraggingHorizontally(false)
                  
                  const threshold = 80
                  const direction = info.offset.x > 0 ? -1 : 1
                  const newIndex = currentIndex + direction
                  
                  if (Math.abs(info.offset.x) > threshold) {
                    if (newIndex >= 0 && newIndex < matches.length) {
                      setCurrentIndex(newIndex)
                    } else if (newIndex >= matches.length && currentIndex === matches.length - 1) {
                      handleShowPreview()
                    }
                  }
                }}
              >
                {matches.map((match) => {
                  const prediction = predictions[match.id] || {
                    matchId: match.id,
                    homeScore: 0,
                    awayScore: 0,
                  }
                  
                  return (
                    <div
                      key={match.id}
                      className="flex-shrink-0 p-4"
                      style={{ 
                        width: carouselWidth > 0 ? carouselWidth : '100%',
                        minWidth: carouselWidth > 0 ? carouselWidth : '100%',
                      }}
                    >
                      <div className="flex flex-col items-center gap-2 w-full">
                        <div className="flex items-center gap-2 w-full relative z-30 px-2">
                          <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-[40%]">
                            <span className="text-xs font-medium text-muted-foreground">Casa</span>
                            <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="xl" className="h-20 w-20" noCircle />
                            <span className="text-sm font-semibold text-center break-words leading-tight px-1">{match.homeTeam}</span>
                          </div>
                          
                          <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2">
                            <div className="flex items-center gap-2">
                              <div 
                                className="text-4xl font-bold text-foreground w-12 text-center tabular-nums relative cursor-pointer hover:opacity-70 transition-opacity"
                                onClick={() => {
                                  setShowScoreHint(prev => {
                                    // Se já está ativo, para a animação
                                    if (prev[match.id] === 'home') {
                                      const next = { ...prev }
                                      delete next[match.id]
                                      return next
                                    }
                                    // Caso contrário, inicia a animação
                                    return { ...prev, [match.id]: 'home' }
                                  })
                                }}
                              >
                                <AnimatePresence mode="wait">
                                  <motion.span
                                    key={prediction.homeScore}
                                    initial={{ scale: 0.95 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0.95 }}
                                    transition={{ duration: 0.06, ease: 'easeOut' }}
                                    className="absolute inset-0 flex items-center justify-center"
                                  >
                                    {prediction.homeScore}
                                  </motion.span>
                                </AnimatePresence>
                              </div>
                              <span className="text-3xl font-bold text-muted-foreground">×</span>
                              <div 
                                className="text-4xl font-bold text-foreground w-12 text-center tabular-nums relative cursor-pointer hover:opacity-70 transition-opacity"
                                onClick={() => {
                                  setShowScoreHint(prev => {
                                    // Se já está ativo, para a animação
                                    if (prev[match.id] === 'away') {
                                      const next = { ...prev }
                                      delete next[match.id]
                                      return next
                                    }
                                    // Caso contrário, inicia a animação
                                    return { ...prev, [match.id]: 'away' }
                                  })
                                }}
                              >
                                <AnimatePresence mode="wait">
                                  <motion.span
                                    key={prediction.awayScore}
                                    initial={{ scale: 0.95 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0.95 }}
                                    transition={{ duration: 0.06, ease: 'easeOut' }}
                                    className="absolute inset-0 flex items-center justify-center"
                                  >
                                    {prediction.awayScore}
                                  </motion.span>
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-[40%]">
                            <span className="text-xs font-medium text-muted-foreground">Visitante</span>
                            <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="xl" className="h-20 w-20" noCircle />
                            <span className="text-sm font-semibold text-center break-words leading-tight px-1">{match.awayTeam}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            </div>
            
            {/* Barra de progresso */}
            <div className="w-full px-4 pt-2 pb-2 border-t border-border/30">
              <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mb-2">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {matches.length > 0 ? `Jogo ${currentIndex + 1} de ${matches.length}` : ''}
              </p>
            </div>
          </Card>
        ) : null}

        {/* Card de seleção de placar */}
        {currentMatch && currentPrediction && (
          <Card className="p-0 relative overflow-hidden" style={{ touchAction: 'pan-y' }}>
            <div className="px-4 pt-3 pb-2 border-b border-border/30">
              <div className="flex items-center justify-center">
                <span className="text-base font-semibold text-foreground">
                  Escolher Placar
                </span>
              </div>
            </div>
            <div 
              className="flex items-center justify-center gap-2 w-full p-4" 
              style={{ touchAction: isButtonPressed ? 'none' : 'pan-y pinch-zoom' }}
            >
                  {/* Controles Casa */}
                  <div className="flex-1 flex flex-col items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">Casa</span>
                    <div className="flex items-center gap-6">
                      <motion.div 
                        whileTap={{ scale: 0.9 }} 
                        transition={{ duration: 0.05 }}
                        className="relative"
                      >
                        <AnimatePresence>
                          {showScoreHint[currentMatch.id] === 'home' && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-4 border-primary -inset-1 pointer-events-none"
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: 1.1, opacity: 0 }}
                              exit={{ opacity: 0 }}
                        transition={{ 
                          duration: 0.6, 
                          repeat: 2, 
                          ease: [0.4, 0, 0.2, 1],
                          repeatType: "loop",
                          repeatDelay: 0.2
                        }}
                            />
                          )}
                        </AnimatePresence>
                        <Button
                          variant="outline"
                          size="lg"
                          onTouchStart={() => {
                            setIsButtonPressed(true)
                            // Trigger háptico no início do toque (melhor para iOS)
                            triggerHaptic('light')
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          onTouchEnd={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseDown={() => {
                            setIsButtonPressed(true)
                          }}
                          onMouseUp={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseLeave={() => {
                            setIsButtonPressed(false)
                          }}
                          onClick={() => {
                            if (currentPrediction.homeScore > 0) {
                              handleScoreChange(currentMatch.id, 'home', currentPrediction.homeScore - 1)
                            }
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          disabled={isLocked || currentPrediction.homeScore === 0}
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-9 w-9" />
                        </Button>
                      </motion.div>
                      <motion.div 
                        whileTap={{ scale: 0.9 }} 
                        transition={{ duration: 0.05 }}
                        className="relative"
                      >
                        <AnimatePresence>
                          {showScoreHint[currentMatch.id] === 'home' && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-4 border-primary -inset-1 pointer-events-none"
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: 1.1, opacity: 0 }}
                              exit={{ opacity: 0 }}
                        transition={{ 
                          duration: 0.6, 
                          repeat: 2, 
                          ease: [0.4, 0, 0.2, 1],
                          repeatType: "loop",
                          repeatDelay: 0.2
                        }}
                            />
                          )}
                        </AnimatePresence>
                        <Button
                          variant="outline"
                          size="lg"
                          onTouchStart={() => {
                            setIsButtonPressed(true)
                            // Trigger háptico no início do toque (melhor para iOS)
                            triggerHaptic('light')
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          onTouchEnd={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseDown={() => {
                            setIsButtonPressed(true)
                          }}
                          onMouseUp={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseLeave={() => {
                            setIsButtonPressed(false)
                          }}
                          onClick={() => {
                            if (currentPrediction.homeScore < 10) {
                              handleScoreChange(currentMatch.id, 'home', currentPrediction.homeScore + 1)
                            }
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          disabled={isLocked || currentPrediction.homeScore === 10}
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-9 w-9" />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                  
                  {/* Separador visual vertical */}
                  <div className="h-24 w-px bg-border/60 flex-shrink-0" />
                  
                  {/* Controles Visitante */}
                  <div className="flex-1 flex flex-col items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">Visitante</span>
                    <div className="flex items-center gap-6">
                      <motion.div 
                        whileTap={{ scale: 0.9 }} 
                        transition={{ duration: 0.05 }}
                        className="relative"
                      >
                        <AnimatePresence>
                          {showScoreHint[currentMatch.id] === 'away' && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-4 border-primary -inset-1 pointer-events-none"
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: 1.1, opacity: 0 }}
                              exit={{ opacity: 0 }}
                        transition={{ 
                          duration: 0.6, 
                          repeat: 2, 
                          ease: [0.4, 0, 0.2, 1],
                          repeatType: "loop",
                          repeatDelay: 0.2
                        }}
                            />
                          )}
                        </AnimatePresence>
                        <Button
                          variant="outline"
                          size="lg"
                          onTouchStart={() => {
                            setIsButtonPressed(true)
                            // Trigger háptico no início do toque (melhor para iOS)
                            triggerHaptic('light')
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          onTouchEnd={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseDown={() => {
                            setIsButtonPressed(true)
                          }}
                          onMouseUp={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseLeave={() => {
                            setIsButtonPressed(false)
                          }}
                          onClick={() => {
                            if (currentPrediction.awayScore > 0) {
                              handleScoreChange(currentMatch.id, 'away', currentPrediction.awayScore - 1)
                            }
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          disabled={isLocked || currentPrediction.awayScore === 0}
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-9 w-9" />
                        </Button>
                      </motion.div>
                      <motion.div 
                        whileTap={{ scale: 0.9 }} 
                        transition={{ duration: 0.05 }}
                        className="relative"
                      >
                        <AnimatePresence>
                          {showScoreHint[currentMatch.id] === 'away' && (
                            <motion.div
                              className="absolute inset-0 rounded-full border-4 border-primary -inset-1 pointer-events-none"
                              initial={{ scale: 1, opacity: 1 }}
                              animate={{ scale: 1.1, opacity: 0 }}
                              exit={{ opacity: 0 }}
                        transition={{ 
                          duration: 0.6, 
                          repeat: 2, 
                          ease: [0.4, 0, 0.2, 1],
                          repeatType: "loop",
                          repeatDelay: 0.2
                        }}
                            />
                          )}
                        </AnimatePresence>
                        <Button
                          variant="outline"
                          size="lg"
                          onTouchStart={() => {
                            setIsButtonPressed(true)
                            // Trigger háptico no início do toque (melhor para iOS)
                            triggerHaptic('light')
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          onTouchEnd={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseDown={() => {
                            setIsButtonPressed(true)
                          }}
                          onMouseUp={() => {
                            setIsButtonPressed(false)
                          }}
                          onMouseLeave={() => {
                            setIsButtonPressed(false)
                          }}
                          onClick={() => {
                            if (currentPrediction.awayScore < 10) {
                              handleScoreChange(currentMatch.id, 'away', currentPrediction.awayScore + 1)
                            }
                            setShowScoreHint(prev => {
                              const next = { ...prev }
                              delete next[currentMatch.id]
                              return next
                            })
                          }}
                          disabled={isLocked || currentPrediction.awayScore === 10}
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-9 w-9" />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>
            </Card>
        )}

        {/* Navegação */}
        {currentMatch && currentPrediction && (
          <div className="space-y-3">
            {isEditingFromPreview && (
              <Button
                variant="primary"
                size="md"
                onClick={handleShowPreview}
                disabled={isLocked}
                className="w-full font-semibold"
              >
                <Eye className="h-4 w-4 mr-2" />
                Voltar para Revisão
              </Button>
            )}
            
            <div data-navigation className="flex items-center justify-between gap-4 relative z-30">
              <Button
                variant="outline"
                size="lg"
                onClick={handlePrevious}
                disabled={currentIndex === 0 || isLocked}
                className="flex-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="text-sm">Anterior</span>
              </Button>
              
              {currentIndex === matches.length - 1 ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleShowPreview}
                  disabled={isLocked}
                  className="flex-1"
                >
                  <Eye className="h-5 w-5 mr-1" />
                  Revisar
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleNext}
                  disabled={isLocked}
                  className="flex-1"
                >
                  Próximo
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Aviso de bloqueio */}
        {isLocked && (
          <Card className="bg-red-500/20 border-red-500/50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-500 font-medium">
                Rodada bloqueada
              </p>
            </div>
          </Card>
        )}
      </div>


      {/* Modal de Resumo */}
      <AnimatePresence>
        {showSummaryModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSummaryModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background border border-border rounded-t-2xl sm:rounded-2xl p-6 max-w-md md:max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Resumo dos Palpites</h2>
                  <button
                    onClick={() => setShowSummaryModal(false)}
                    className="p-2 hover:bg-secondary rounded-full transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso:</span>
                    <span className="font-semibold text-primary">
                      {completedMatches} de {matches.length} jogos
                    </span>
                  </div>
                  <div className="mt-2 w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedMatches / matches.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <Card className="p-3">
                  <div className="divide-y divide-border/50">
                    {matches.map((match, index) => {
                      const pred = predictions[match.id] || { matchId: match.id, homeScore: 0, awayScore: 0 }
                      const isCurrentMatch = match.id === currentMatch?.id
                      
                      return (
                        <motion.div
                          key={match.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={`py-2 first:pt-0 last:pb-0 cursor-pointer hover:bg-secondary/30 transition-colors rounded px-2 -mx-2 ${
                            isCurrentMatch ? 'bg-primary/10 border border-primary/20' : ''
                          }`}
                          onClick={() => {
                            handleEditMatch(match.id)
                            setShowSummaryModal(false)
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center min-w-0">
                              <div className="flex-1 flex justify-end pr-2 min-w-0">
                                <span className="text-xs font-semibold truncate text-foreground text-right">{match.homeTeam}</span>
                              </div>
                              
                              <div className="w-[130px] flex items-center gap-1 justify-center flex-shrink-0">
                                <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-10 w-10" />
                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/20 rounded">
                                  <span className="text-sm font-bold text-foreground">{pred.homeScore}</span>
                                  <span className="text-xs text-muted-foreground">×</span>
                                  <span className="text-sm font-bold text-foreground">{pred.awayScore}</span>
                                </div>
                                <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-10 w-10" />
                              </div>
                              
                              <div className="flex-1 flex justify-start pl-2 min-w-0">
                                <span className="text-xs font-semibold truncate text-foreground text-left">{match.awayTeam}</span>
                              </div>
                            </div>
                            {isCurrentMatch && (
                              <span className="text-xs font-medium text-primary">Atual</span>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </Card>

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSummaryModal(false)}
                    className="flex-1"
                  >
                    Fechar
                  </Button>
                  {completedMatches === matches.length && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        setShowSummaryModal(false)
                        handleShowPreview()
                      }}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Revisar
                    </Button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

