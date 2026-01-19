import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Calendar, Clock, Minus, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import TeamLogo from '@/components/ui/TeamLogo'
import { matchService } from '@/services/match.service'
import { Match } from '@/types'
import { config } from '@/config'
import { getTeamDisplayName } from '@/lib/teamNames'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'
import { cn } from '@/lib/utils'

export default function EditGame() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToastContext()
  const confirm = useConfirmContext()

  // Parâmetros da URL
  const urlRound = searchParams.get('round')
  const urlMatchId = searchParams.get('matchId')

  // Estados
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [initializedFromUrl, setInitializedFromUrl] = useState(false)
  const carouselContainerRef = useRef<HTMLDivElement>(null)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [showDateTimeModal, setShowDateTimeModal] = useState(false)
  const [editingMatchForDateTime, setEditingMatchForDateTime] = useState<string | null>(null)
  const [tempDate, setTempDate] = useState('')
  const [tempTime, setTempTime] = useState('')
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [savingScore, setSavingScore] = useState<Record<string, boolean>>({})
  const [showScoreHint, setShowScoreHint] = useState<Record<string, 'home' | 'away' | null>>({})
  const [isButtonPressed, setIsButtonPressed] = useState(false)
  const [isDraggingHorizontally, setIsDraggingHorizontally] = useState(false)

  // Carregar matches da rodada
  useEffect(() => {
    if (urlRound) {
      const roundNum = parseInt(urlRound, 10)
      if (!isNaN(roundNum)) {
        loadMatches(roundNum)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlRound])

  // Focar no jogo específico quando matchId estiver na URL (apenas no carregamento inicial)
  useEffect(() => {
    if (!initializedFromUrl && urlMatchId && matches.length > 0) {
      const matchIndex = matches.findIndex(m => m.id === urlMatchId)
      if (matchIndex !== -1) {
        console.log('[EditGame] useEffect: Inicializando currentMatchIndex para', matchIndex, 'a partir da URL')
        setCurrentMatchIndex(matchIndex)
        setSelectedMatchId(urlMatchId)
        setInitializedFromUrl(true)
      }
    }
  }, [urlMatchId, matches, initializedFromUrl])

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

  const loadMatches = async (round: number) => {
    setLoading(true)
    try {
      const { matches: data } = await matchService.getMatchesByRoundWithStatus(round)
      const matchesWithDefaults = data.map(m => ({
        ...m,
        includeInRound: m.includeInRound ?? true,
        status: m.status ?? 'scheduled',
        homeScore: m.homeScore ?? undefined,
        awayScore: m.awayScore ?? undefined,
      }))
      
      console.log('[EditGame] Matches carregados:', matchesWithDefaults.length)
      
      // Ler urlMatchId novamente para garantir que está atualizado
      const currentUrlMatchId = searchParams.get('matchId')
      console.log('[EditGame] urlMatchId da URL:', currentUrlMatchId)
      
      setMatches(matchesWithDefaults)
      
      if (matchesWithDefaults.length > 0) {
        // Resetar flag de inicialização quando carregamos novos matches
        setInitializedFromUrl(false)
        
        if (currentUrlMatchId) {
          const matchIndex = matchesWithDefaults.findIndex(m => m.id === currentUrlMatchId)
          console.log('[EditGame] MatchIndex encontrado:', matchIndex, 'de', matchesWithDefaults.length - 1)
          if (matchIndex !== -1) {
            setCurrentMatchIndex(matchIndex)
            setSelectedMatchId(currentUrlMatchId)
            setInitializedFromUrl(true)
          } else {
            // Se não encontrou o matchId na URL, usar o primeiro
            console.log('[EditGame] MatchId não encontrado, usando primeiro')
            setCurrentMatchIndex(0)
            setSelectedMatchId(matchesWithDefaults[0].id)
            setInitializedFromUrl(true)
          }
        } else {
          console.log('[EditGame] Sem urlMatchId, usando primeiro')
          setCurrentMatchIndex(0)
          setSelectedMatchId(matchesWithDefaults[0].id)
          setInitializedFromUrl(true)
        }
      }
    } catch (error) {
      console.error('Error loading matches:', error)
      toast.error('Erro ao carregar jogos')
    } finally {
      setLoading(false)
    }
  }

  const handleMatchChange = async (id: string, field: keyof Match, value: any) => {
    setMatches(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)))
    
    try {
      await matchService.updateMatch(id, { [field]: value })
    } catch (error) {
      console.error('Error updating match:', error)
      toast.error('Erro ao atualizar jogo')
    }
  }

  const handleScoreUpdate = async (matchId: string, field: 'homeScore' | 'awayScore', value: number) => {
    const currentMatch = matches.find(m => m.id === matchId)
    if (!currentMatch) return
    
    if (currentMatch.status === 'scheduled') {
      toast.error('O placar só pode ser atualizado quando o jogo está em andamento.')
      return
    }
    
    const score = value < 0 ? 0 : value
    
    setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, [field]: score } : m)))

    setSavingScore(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = {
        homeScore: field === 'homeScore' ? score : currentMatch.homeScore,
        awayScore: field === 'awayScore' ? score : currentMatch.awayScore,
      }
      
      const updatedMatch = await matchService.updateMatch(matchId, payload)
      setMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
    } catch (error) {
      console.error('Error saving score:', error)
      toast.error('Erro ao salvar placar. Tente novamente.')
    } finally {
      setSavingScore(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleStatusUpdate = async (matchId: string, newStatus: Match['status']) => {
    const currentMatch = matches.find(m => m.id === matchId)
    if (!currentMatch) return

    if (newStatus === 'scheduled') {
      const homeScore = currentMatch.homeScore ?? 0
      const awayScore = currentMatch.awayScore ?? 0
      
      if (homeScore !== 0 || awayScore !== 0) {
        const statusText = {
          'scheduled': 'Agendado',
          'live': 'Em Andamento',
          'finished': 'Finalizado'
        }[currentMatch.status] || currentMatch.status

        const confirmed = await confirm.confirm({
          title: 'Zerar Placar',
          message: `O placar atual é ${homeScore} × ${awayScore}. Ao alterar o status de "${statusText}" para "Agendado", o placar será zerado para 0 × 0. Deseja continuar?`,
          variant: 'warning',
          confirmText: 'Sim',
        })
        
        if (!confirmed) {
          return
        }
      }
    }

    setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, status: newStatus } : m)))

    setSavingStatus(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = { status: newStatus }
      
      if (newStatus === 'scheduled') {
        const homeScore = currentMatch.homeScore ?? 0
        const awayScore = currentMatch.awayScore ?? 0
        
        if (homeScore !== 0 || awayScore !== 0) {
          payload.homeScore = 0
          payload.awayScore = 0
        }
      }
      
      const updatedMatch = await matchService.updateMatch(matchId, payload)
      setMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
    } catch (error) {
      console.error('Error saving status:', error)
      toast.error('Erro ao salvar status. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleRemoveMatch = async (matchId: string) => {
    const confirmed = await confirm.confirm({
      title: 'Deletar Confronto Permanentemente',
      message: 'Tem certeza que deseja deletar este confronto?\n\nEsta ação irá:\n- Deletar o confronto da base de dados\n- Remover todas as predictions associadas deste confronto dos palpites\n- Recalcular os pontos dos palpites afetados\n\nEsta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Deletar Permanentemente',
    })
    if (!confirmed) return

    try {
      await matchService.deleteMatch(matchId)
      setMatches(prev => prev.filter(m => m.id !== matchId))
      toast.success('Confronto deletado com sucesso')
      
      // Se deletou o último jogo, voltar para a lista
      const remainingMatches = matches.filter(m => m.id !== matchId)
      if (remainingMatches.length === 0) {
        navigate('/admin/update-games')
      } else {
        // Ir para o próximo jogo ou anterior
        const deletedIndex = currentMatchIndex
        const newIndex = deletedIndex >= remainingMatches.length ? remainingMatches.length - 1 : deletedIndex
        setCurrentMatchIndex(newIndex)
        setSelectedMatchId(remainingMatches[newIndex]?.id || null)
      }
    } catch (error) {
      console.error('Error deleting match:', error)
      toast.error('Erro ao deletar confronto. Tente novamente.')
    }
  }

  const handleCarouselNavigation = (direction: 'prev' | 'next') => {
    console.log('[EditGame] handleCarouselNavigation:', direction, 'currentMatchIndex:', currentMatchIndex, 'matches.length:', matches.length)
    if (direction === 'prev' && currentMatchIndex > 0) {
      const newIndex = currentMatchIndex - 1
      console.log('[EditGame] Navegando para anterior, novo index:', newIndex, 'matchId:', matches[newIndex]?.id)
      setCurrentMatchIndex(newIndex)
      setSelectedMatchId(matches[newIndex].id)
      // Atualizar URL sem recarregar a página (opcional, mas útil para compartilhar links)
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('matchId', matches[newIndex].id)
      navigate(`/admin/edit-game?${newSearchParams.toString()}`, { replace: true })
    } else if (direction === 'next' && currentMatchIndex < matches.length - 1) {
      const newIndex = currentMatchIndex + 1
      console.log('[EditGame] Navegando para próximo, novo index:', newIndex, 'matchId:', matches[newIndex]?.id)
      setCurrentMatchIndex(newIndex)
      setSelectedMatchId(matches[newIndex].id)
      // Atualizar URL sem recarregar a página (opcional, mas útil para compartilhar links)
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('matchId', matches[newIndex].id)
      navigate(`/admin/edit-game?${newSearchParams.toString()}`, { replace: true })
    } else {
      console.log('[EditGame] Navegação bloqueada:', direction, 'currentMatchIndex:', currentMatchIndex, 'matches.length:', matches.length)
    }
  }

  const handleSaveDateTime = async () => {
    if (!editingMatchForDateTime) return

    const match = matches.find(m => m.id === editingMatchForDateTime)
    if (!match) return

    const updates: Partial<Match> = {}
    if (tempDate !== (match.date || '')) {
      updates.date = tempDate
    }
    if (tempTime !== (match.time || '')) {
      updates.time = tempTime
    }

    if (Object.keys(updates).length > 0) {
      try {
        await matchService.updateMatch(editingMatchForDateTime, updates)
        setMatches(prev => prev.map(m => 
          m.id === editingMatchForDateTime ? { ...m, ...updates } : m
        ))
        toast.success('Data e hora atualizadas com sucesso')
      } catch (error) {
        console.error('Error updating date/time:', error)
        toast.error('Erro ao atualizar data e hora')
      }
    }

    setShowDateTimeModal(false)
    setEditingMatchForDateTime(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-2 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/update-games')}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold">Carregando...</h2>
          </div>
        </div>
      </div>
    )
  }

  const currentMatch = matches.find(m => m.id === selectedMatchId)
  
  if (!currentMatch) {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-2 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/update-games')}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold">Jogo não encontrado</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-2 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/update-games')}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">Editar Jogo</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs lg:text-sm text-muted-foreground">Incluído nos Palpites</span>
                  <Switch
                    checked={currentMatch.includeInRound !== false}
                    onCheckedChange={(checked) => handleMatchChange(currentMatch.id, 'includeInRound', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Carrossel de Jogos */}
          {matches.length > 0 && (
            <Card className="p-0 relative overflow-hidden">
              {matches[currentMatchIndex] && (
                <div className="px-3 sm:px-4 pt-1.5 sm:pt-2 md:pt-2.5 pb-1 sm:pb-1.5 border-b border-border/30">
                  <div className="flex justify-center">
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-primary/10 transition-all border border-dashed border-primary/30 hover:border-primary/50 bg-primary/5 group"
                      onClick={() => {
                        setEditingMatchForDateTime(matches[currentMatchIndex].id)
                        setTempDate(matches[currentMatchIndex].date || '')
                        setTempTime(matches[currentMatchIndex].time || '')
                        setShowDateTimeModal(true)
                      }}
                    >
                      <Calendar className="h-4 w-4 text-primary group-hover:text-primary/80" />
                      <span className="text-sm font-medium text-foreground group-hover:text-primary/80">
                        {matches[currentMatchIndex].date && matches[currentMatchIndex].time
                          ? `${new Date(matches[currentMatchIndex].date).toLocaleDateString('pt-BR')} às ${matches[currentMatchIndex].time}`
                          : matches[currentMatchIndex].date
                            ? `${new Date(matches[currentMatchIndex].date).toLocaleDateString('pt-BR')} - Horário não definido`
                            : 'Clique para definir data e horário'
                        }
                      </span>
                      <Clock className="h-4 w-4 text-primary group-hover:text-primary/80" />
                    </div>
                  </div>
                </div>
              )}
              <div 
                ref={carouselContainerRef} 
                className="relative overflow-hidden pt-1.5 sm:pt-2 md:pt-3 pb-0.5 sm:pb-1"
                style={{ touchAction: isDraggingHorizontally ? 'pan-x' : 'pan-y pinch-zoom' }}
              >
                <motion.div
                  className="flex"
                  animate={{
                    x: carouselWidth > 0 ? -currentMatchIndex * carouselWidth : `-${currentMatchIndex * 100}%`,
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
                  whileDrag={{ 
                    transition: { duration: 0 } 
                  }}
                  onDrag={(_, info) => {
                    const isHorizontal = Math.abs(info.offset.x) > Math.abs(info.offset.y) && Math.abs(info.offset.x) > 10
                    if (isHorizontal !== isDraggingHorizontally) {
                      setIsDraggingHorizontally(isHorizontal)
                    }
                  }}
                  onDragStart={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('button') || target.closest('[data-navigation]') || target.closest('[data-no-drag]')) {
                      return false
                    }
                  }}
                  onDragEnd={(_, info) => {
                    setIsDraggingHorizontally(false)
                    
                    const threshold = carouselWidth > 0 ? carouselWidth * 0.3 : 80
                    const direction = info.offset.x > 0 ? -1 : 1
                    const newIndex = currentMatchIndex + direction
                    
                    console.log('[EditGame] onDragEnd:', {
                      offsetX: info.offset.x,
                      threshold,
                      direction,
                      currentIndex: currentMatchIndex,
                      newIndex,
                      matchesLength: matches.length
                    })
                    
                    if (Math.abs(info.offset.x) > threshold) {
                      if (newIndex >= 0 && newIndex < matches.length) {
                        console.log('[EditGame] Mudando para índice:', newIndex, 'matchId:', matches[newIndex]?.id)
                        setCurrentMatchIndex(newIndex)
                        setSelectedMatchId(matches[newIndex].id)
                        // Atualizar URL sem recarregar a página
                        const newSearchParams = new URLSearchParams(searchParams)
                        newSearchParams.set('matchId', matches[newIndex].id)
                        navigate(`/admin/edit-game?${newSearchParams.toString()}`, { replace: true })
                      } else {
                        console.log('[EditGame] Índice inválido:', newIndex)
                      }
                    } else {
                      console.log('[EditGame] Threshold não atingido')
                    }
                  }}
                >
                  {matches.map((match) => {
                    const isCurrentMatch = match.id === selectedMatchId

                    return (
                      <div
                        key={match.id}
                        className="flex-shrink-0 p-2 sm:p-3 md:p-4"
                        style={{ 
                          width: carouselWidth > 0 ? carouselWidth : '100%',
                          minWidth: carouselWidth > 0 ? carouselWidth : '100%',
                        }}
                      >
                        <div className="flex flex-col items-center gap-0.5 sm:gap-1 md:gap-2 w-full">
                          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 w-full relative z-30 px-0.5 sm:px-1 md:px-2">
                            <div className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 md:gap-1.5 min-w-0 max-w-[40%]">
                              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Casa</span>
                              <TeamLogo 
                                teamName={match.homeTeam} 
                                logo={match.homeTeamLogo} 
                                size="xl" 
                                className="aspect-square" 
                                noCircle
                                style={{
                                  width: 'clamp(2rem, 8vw, 4rem)',
                                  height: 'clamp(2rem, 8vw, 4rem)',
                                  minWidth: '2rem',
                                  minHeight: '2rem',
                                  maxWidth: '4rem',
                                  maxHeight: '4rem'
                                }}
                              />
                              <span 
                                className="font-semibold text-center break-words leading-tight px-1"
                                style={{ fontSize: 'clamp(0.75rem, 4vw, 1.25rem)' }}
                              >{getTeamDisplayName(match.homeTeam)}</span>
                            </div>
                            
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1 flex-shrink-0 px-0.5 sm:px-1 md:px-2">
                              <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
                                <div 
                                  className={cn(
                                    "font-bold tabular-nums cursor-pointer hover:opacity-70 transition-opacity text-center",
                                    isCurrentMatch ? 'text-primary' : 'text-foreground'
                                  )}
                                  style={{
                                    fontSize: 'clamp(1.5rem, 8vw, 2.25rem)',
                                    width: 'clamp(2rem, 10vw, 3rem)'
                                  }}
                                  onClick={() => {
                                    setShowScoreHint(prev => {
                                      if (prev[match.id] === 'home') {
                                        const next = { ...prev }
                                        delete next[match.id]
                                        return next
                                      }
                                      return { ...prev, [match.id]: 'home' }
                                    })
                                  }}
                                >
                                  {match.homeScore ?? 0}
                                </div>
                                <span 
                                  className="font-bold text-muted-foreground"
                                  style={{ fontSize: 'clamp(1.25rem, 6vw, 1.875rem)' }}
                                >×</span>
                                <div 
                                  className={cn(
                                    "font-bold tabular-nums cursor-pointer hover:opacity-70 transition-opacity text-center",
                                    isCurrentMatch ? 'text-primary' : 'text-foreground'
                                  )}
                                  style={{
                                    fontSize: 'clamp(1.5rem, 8vw, 2.25rem)',
                                    width: 'clamp(2rem, 10vw, 3rem)'
                                  }}
                                  onClick={() => {
                                    setShowScoreHint(prev => {
                                      if (prev[match.id] === 'away') {
                                        const next = { ...prev }
                                        delete next[match.id]
                                        return next
                                      }
                                      return { ...prev, [match.id]: 'away' }
                                    })
                                  }}
                                >
                                  {match.awayScore ?? 0}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 md:gap-1.5 min-w-0 max-w-[40%]">
                              <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Visitante</span>
                              <TeamLogo 
                                teamName={match.awayTeam} 
                                logo={match.awayTeamLogo} 
                                size="xl" 
                                className="aspect-square" 
                                noCircle
                                style={{
                                  width: 'clamp(2rem, 8vw, 4rem)',
                                  height: 'clamp(2rem, 8vw, 4rem)',
                                  minWidth: '2rem',
                                  minHeight: '2rem',
                                  maxWidth: '4rem',
                                  maxHeight: '4rem'
                                }}
                              />
                              <span 
                                className="font-semibold text-center break-words leading-tight px-1"
                                style={{ fontSize: 'clamp(0.75rem, 4vw, 1.25rem)' }}
                              >{getTeamDisplayName(match.awayTeam)}</span>
                            </div>
                          </div>

                          <div className="mt-3 w-full" data-no-drag>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'scheduled')}
                                disabled={savingStatus[match.id]}
                                className={cn(
                                  'flex-1 px-1.5 py-1 rounded text-xs font-medium transition-all',
                                  'border',
                                  match.status === 'scheduled'
                                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                    : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                                )}
                              >
                                Agendado
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'live')}
                                disabled={savingStatus[match.id]}
                                className={cn(
                                  'flex-1 px-1.5 py-1 rounded text-xs font-medium transition-all',
                                  'border',
                                  match.status === 'live'
                                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                    : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                                )}
                              >
                                Ao Vivo
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(match.id, 'finished')}
                                disabled={savingStatus[match.id]}
                                className={cn(
                                  'flex-1 px-1.5 py-1 rounded text-xs font-medium transition-all',
                                  'border',
                                  match.status === 'finished'
                                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                    : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                                )}
                              >
                                Finalizado
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </motion.div>
              </div>
              
              {/* Barra de progresso */}
              <div className="w-full px-3 sm:px-4 pt-1 sm:pt-1.5 md:pt-2 pb-1 sm:pb-1.5 md:pb-2 border-t border-border/30">
                <div className="w-full h-0.5 sm:h-1 bg-secondary rounded-full overflow-hidden mb-0.5 sm:mb-1 md:mb-2">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ 
                      width: matches.length > 0
                        ? matches.length === 1
                          ? '100%'
                          : currentMatchIndex === 0 
                            ? '0%' 
                            : currentMatchIndex === matches.length - 1 
                              ? '100%' 
                              : `${(currentMatchIndex / (matches.length - 1)) * 100}%`
                        : '0%'
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                  {matches.length > 0 ? `Jogo ${currentMatchIndex + 1} de ${matches.length}` : ''}
                </p>
              </div>
            </Card>
          )}

          {/* Navegação do Carrossel */}
          {matches.length > 0 && (
            <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mt-2 sm:mt-2.5 md:mt-3 mb-16 sm:mb-20">
              <div data-navigation className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 relative z-30">
                <Button
                  variant="outline"
                  size="md"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('[EditGame] Anterior clicado. currentMatchIndex:', currentMatchIndex, 'matches.length:', matches.length)
                    handleCarouselNavigation('prev')
                  }}
                  disabled={currentMatchIndex === 0 || matches.length === 0}
                  className="flex-1 opacity-70 hover:opacity-100 transition-opacity text-xs sm:text-sm h-9 sm:h-10 md:h-11"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                  <span>Anterior</span>
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('[EditGame] Próximo clicado. currentMatchIndex:', currentMatchIndex, 'matches.length:', matches.length)
                    handleCarouselNavigation('next')
                  }}
                  disabled={currentMatchIndex >= matches.length - 1 || matches.length === 0}
                  className="flex-1 text-xs sm:text-sm h-9 sm:h-10 md:h-11"
                >
                  <span>Próximo</span>
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 ml-0.5 sm:ml-1" />
                </Button>
              </div>
            </div>
          )}

          <div className="h-1"></div>

          <div className="space-y-2">
            <Card className="p-0 relative overflow-hidden">
              <div 
                className="flex items-center justify-center gap-1 sm:gap-2 w-full p-1.5 sm:p-2 md:p-3 overflow-x-auto"
                style={{ touchAction: isButtonPressed ? 'none' : 'pan-y pinch-zoom' }}
              >
                <div className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 md:gap-2 min-w-0">
                  <span className="text-xs font-medium text-muted-foreground">Casa</span>
                  <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 justify-center w-full max-w-full">
                    <motion.div 
                      whileTap={{ scale: 0.9 }} 
                      transition={{ duration: 0.05 }}
                      className="relative flex-shrink-0"
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
                          if ((currentMatch.homeScore ?? 0) > 0) {
                            handleScoreUpdate(currentMatch.id, 'homeScore', (currentMatch.homeScore ?? 0) - 1)
                          }
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.homeScore ?? 0) === 0}
                        className="rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 aspect-square"
                        style={{
                          width: 'clamp(3.5rem, 20vw, 5rem)',
                          height: 'clamp(3.5rem, 20vw, 5rem)',
                          minWidth: '3.5rem',
                          minHeight: '3.5rem',
                          maxWidth: '5rem',
                          maxHeight: '5rem'
                        }}
                      >
                        <Minus className="w-full h-full p-2" style={{ minWidth: '1.5rem', minHeight: '1.5rem' }} />
                      </Button>
                    </motion.div>
                    <motion.div 
                      whileTap={{ scale: 0.9 }} 
                      transition={{ duration: 0.05 }}
                      className="relative flex-shrink-0"
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
                          if ((currentMatch.homeScore ?? 0) < 10) {
                            handleScoreUpdate(currentMatch.id, 'homeScore', (currentMatch.homeScore ?? 0) + 1)
                          }
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.homeScore ?? 0) === 10}
                        className="rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 aspect-square"
                        style={{
                          width: 'clamp(3.5rem, 20vw, 5rem)',
                          height: 'clamp(3.5rem, 20vw, 5rem)',
                          minWidth: '3.5rem',
                          minHeight: '3.5rem',
                          maxWidth: '5rem',
                          maxHeight: '5rem'
                        }}
                      >
                        <Plus className="w-full h-full p-2" style={{ minWidth: '1.5rem', minHeight: '1.5rem' }} />
                      </Button>
                    </motion.div>
                  </div>
                </div>
                
                <div className="h-14 sm:h-18 md:h-22 lg:h-24 w-px bg-border/60 flex-shrink-0 mx-0.5 sm:mx-1 md:mx-2" />

                <div className="flex-1 flex flex-col items-center gap-0.5 sm:gap-1 md:gap-2 min-w-0">
                  <span className="text-xs font-medium text-muted-foreground">Visitante</span>
                  <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 justify-center w-full max-w-full">
                    <motion.div 
                      whileTap={{ scale: 0.9 }} 
                      transition={{ duration: 0.05 }}
                      className="relative flex-shrink-0"
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
                          if ((currentMatch.awayScore ?? 0) > 0) {
                            handleScoreUpdate(currentMatch.id, 'awayScore', (currentMatch.awayScore ?? 0) - 1)
                          }
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.awayScore ?? 0) === 0}
                        className="rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 aspect-square"
                        style={{
                          width: 'clamp(3.5rem, 20vw, 5rem)',
                          height: 'clamp(3.5rem, 20vw, 5rem)',
                          minWidth: '3.5rem',
                          minHeight: '3.5rem',
                          maxWidth: '5rem',
                          maxHeight: '5rem'
                        }}
                      >
                        <Minus className="w-full h-full p-2" style={{ minWidth: '1.5rem', minHeight: '1.5rem' }} />
                      </Button>
                    </motion.div>
                    <motion.div 
                      whileTap={{ scale: 0.9 }} 
                      transition={{ duration: 0.05 }}
                      className="relative flex-shrink-0"
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
                          if ((currentMatch.awayScore ?? 0) < 10) {
                            handleScoreUpdate(currentMatch.id, 'awayScore', (currentMatch.awayScore ?? 0) + 1)
                          }
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.awayScore ?? 0) === 10}
                        className="rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 aspect-square"
                        style={{
                          width: 'clamp(3.5rem, 20vw, 5rem)',
                          height: 'clamp(3.5rem, 20vw, 5rem)',
                          minWidth: '3.5rem',
                          minHeight: '3.5rem',
                          maxWidth: '5rem',
                          maxHeight: '5rem'
                        }}
                      >
                        <Plus className="w-full h-full p-2" style={{ minWidth: '1.5rem', minHeight: '1.5rem' }} />
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </Card>

            <Button
              variant="outline"
              size="sm"
              className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-600 hover:border-red-500"
              onClick={() => handleRemoveMatch(currentMatch.id)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir Jogo
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de edição de data e hora */}
      {showDateTimeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full shadow-xl backdrop-blur-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold mb-4 text-foreground">
                  Editar Data e Hora
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Data
                    </label>
                    <input
                      type="date"
                      value={tempDate}
                      onChange={(e) => setTempDate(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Hora
                    </label>
                    <select
                      value={tempTime}
                      onChange={(e) => setTempTime(e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Selecione</option>
                      {config.getGameTimesSync().map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowDateTimeModal(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveDateTime}
                className="flex-1"
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
