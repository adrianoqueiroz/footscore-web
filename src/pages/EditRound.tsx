import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, Clock, Save, Loader2, CheckCircle2, XCircle, Plus, Trash2, CheckCircle, AlertCircle, ArrowLeft, Minus, Edit, GripVertical, Move, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Match } from '@/types'
import { matchService } from '@/services/match.service'
import { ticketService } from '@/services/ticket.service'
import RoundSelector from '@/components/ui/RoundSelector'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import TeamLogo from '@/components/ui/TeamLogo'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import { useConfirmContext } from '@/contexts/ConfirmContext'
import { useToastContext } from '@/contexts/ToastContext'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { config } from '@/config'
import { cn } from '@/lib/utils'
import { getTeamDisplayName } from '@/lib/teamNames'

interface MatchWithInclude extends Match {
  includeInRound?: boolean
}

// Times da Série A
const SERIE_A_TEAMS = [
  'Flamengo', 'Palmeiras', 'Corinthians', 'São Paulo', 'Fluminense',
  'Vasco', 'Atlético-MG', 'Cruzeiro', 'Internacional', 'Grêmio',
  'Santos', 'Botafogo', 'Athletico-PR', 'Bahia', 'Fortaleza',
  'Ceará', 'Sport', 'Goiás', 'Coritiba', 'América-MG',
  'Bragantino', 'Cuiabá', 'Juventude', 'Vitória'
]

const SERIE_B_TEAMS = [
  'Avaí', 'Chapecoense', 'Criciúma', 'Guarani', 'Ituano',
  'Juventude', 'Londrina', 'Mirassol', 'Novorizontino', 'Operário',
  'Ponte Preta', 'Sampaio Corrêa', 'Tombense', 'Vila Nova', 'Vitória'
]

const getLogoPath = (teamName: string, league: 'serie-a' | 'serie-b' = 'serie-a') => {
  const normalized = teamName.toLowerCase()
    .replace(/\s+/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
  return `/assets/teams/${league}/${normalized}.svg`
}

// Componente para itens arrastáveis
function SortableItem({ id, children, isReordering }: { id: string; children: React.ReactNode; isReordering: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isReordering && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing touch-none"
          style={{
            // Área de toque maior: 48x48px (tamanho mínimo recomendado para toque)
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="p-1 rounded hover:bg-secondary/50 transition-colors">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
      <div className={isReordering ? 'pl-12' : ''} style={isReordering ? { touchAction: 'pan-y' } : undefined}>
        {children}
      </div>
    </div>
  )
}

export default function EditRound() {
  const navigate = useNavigate()
  const [rounds, setRounds] = useState<number[]>([])
  const [selectedRound, setSelectedRound] = useState<number>()
  
  // Debug: monitorar mudanças no array rounds
  useEffect(() => {
  }, [rounds])
  const [roundsLoading, setRoundsLoading] = useState(true)
  const [matches, setMatches] = useState<MatchWithInclude[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingAllowsNewBets, setSavingAllowsNewBets] = useState(false)
  const [allowsNewBets, setAllowsNewBets] = useState(true)
  const [savingIsActive, setSavingIsActive] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const confirm = useConfirmContext()
  const toast = useToastContext()
  const showRoundsLoading = useDelayedLoading(roundsLoading)
  const showLoadingMatches = useDelayedLoading(loadingMatches)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [deletingTickets, setDeletingTickets] = useState(false)
  const [addingMatch, setAddingMatch] = useState(false)
  const [showMessage, setShowMessage] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [selectedLeague, setSelectedLeague] = useState<'serie-a' | 'serie-b'>('serie-a')
  const [newMatch, setNewMatch] = useState({
    homeTeam: '',
    awayTeam: '',
    date: '',
    time: '',
  })
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [showDeleteRoundModal, setShowDeleteRoundModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingRound, setDeletingRound] = useState(false)
  const [showDeleteTicketsModal, setShowDeleteTicketsModal] = useState(false)
  const [deleteTicketsPassword, setDeleteTicketsPassword] = useState('')
  const [customTimeMatches, setCustomTimeMatches] = useState<Set<string>>(new Set())
  const isInitialLoadRef = useRef(true)
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [globalDate, setGlobalDate] = useState<string>('')
  const [globalTime, setGlobalTime] = useState<string>('')
  const [savingScore, setSavingScore] = useState<Record<string, boolean>>({})
  const [showScoreHint, setShowScoreHint] = useState<Record<string, 'home' | 'away' | null>>({}) // Para mostrar indicativo visual
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [isReordering, setIsReordering] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const carouselContainerRef = useRef<HTMLDivElement>(null)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  // Configurar sensores para drag and drop
  // Usar activationConstraint para evitar conflitos com scroll em dispositivos móveis
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Requer movimento de 8px antes de ativar o drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    // Carregar todas as rodadas (incluindo inativas) para admin poder editá-las
    const loadAllRounds = async () => {
      setRoundsLoading(true)
      try {
        const roundsData = await matchService.getAllRounds()
        // Garantir que todas as rodadas sejam armazenadas (não filtrar)
        // Ordenar as rodadas para garantir ordem correta
        const sortedRounds = [...roundsData].sort((a, b) => a - b)
        setRounds(sortedRounds)
        
        // Sempre atualizar o array de rodadas, independente de ter rodada selecionada
        // Se não há rodada selecionada, buscar a última rodada que foi selecionada anteriormente
        // ou a última rodada ativa como padrão
        if (roundsData.length > 0) {
          if (!selectedRound) {
            // Tentar recuperar a última rodada selecionada do localStorage
            const lastSelectedRound = localStorage.getItem('lastSelectedRound')
            const lastSelectedRoundNum = lastSelectedRound ? parseInt(lastSelectedRound, 10) : null
            
            // Se a última selecionada ainda existe na lista, usar ela
            if (lastSelectedRoundNum && sortedRounds.includes(lastSelectedRoundNum)) {
              setSelectedRound(lastSelectedRoundNum)
            } else {
              // Caso contrário, buscar a última rodada ativa
              let lastActiveRound: number | null = null
              
              // Verificar rodadas de trás para frente para encontrar a última ativa
              for (let i = sortedRounds.length - 1; i >= 0; i--) {
                const round = sortedRounds[i]
                try {
                  const status = await matchService.getMatchesByRoundWithStatus(round)
                  if (status.isActive !== false) {
                    lastActiveRound = round
                    break
                  }
                } catch (error) {
                  console.error(`Error checking status for round ${round}:`, error)
                  // Continuar verificando outras rodadas
                }
              }
              
              // Se encontrou uma rodada ativa, selecionar ela; caso contrário, selecionar a última da lista
              const roundToSelect = lastActiveRound || sortedRounds[sortedRounds.length - 1]
              setSelectedRound(roundToSelect)
              // Salvar no localStorage para próxima vez
              if (roundToSelect) {
                localStorage.setItem('lastSelectedRound', roundToSelect.toString())
              }
            }
          } else {
            // Se já há uma rodada selecionada, garantir que ela ainda existe na lista
            if (!sortedRounds.includes(selectedRound)) {
              // Se a rodada selecionada não existe mais, selecionar a última ativa ou a última da lista
              let lastActiveRound: number | null = null
              for (let i = sortedRounds.length - 1; i >= 0; i--) {
                const round = sortedRounds[i]
                try {
                  const status = await matchService.getMatchesByRoundWithStatus(round)
                  if (status.isActive !== false) {
                    lastActiveRound = round
                    break
                  }
                } catch (error) {
                  console.error(`Error checking status for round ${round}:`, error)
                }
              }
              const roundToSelect = lastActiveRound || sortedRounds[sortedRounds.length - 1]
              setSelectedRound(roundToSelect)
              if (roundToSelect) {
                localStorage.setItem('lastSelectedRound', roundToSelect.toString())
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading all rounds:', error)
      } finally {
        setRoundsLoading(false)
      }
    }

    loadAllRounds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedRound) {
      isInitialLoadRef.current = true
      loadMatches(selectedRound)
      // Salvar a rodada selecionada no localStorage para manter como padrão
      localStorage.setItem('lastSelectedRound', selectedRound.toString())
    }
  }, [selectedRound])

  // Recalcular customTimeMatches quando matches mudarem (garantir consistência)
  useEffect(() => {
    if (matches.length > 0) {
      const predefinedTimes = config.getGameTimesSync().map(t => t.trim())
      const customMatches = new Set<string>()
      matches.forEach(match => {
        if (match.time) {
          const normalizedTime = match.time.trim()
          const timeWithoutSeconds = normalizedTime.split(':').slice(0, 2).join(':')
          const isInPredefined = predefinedTimes.includes(normalizedTime) || predefinedTimes.includes(timeWithoutSeconds)
          if (!isInPredefined) {
            customMatches.add(match.id)
          }
        }
      })
      setCustomTimeMatches(customMatches)
    }
  }, [matches])

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
    setLoadingMatches(true)
    try {
      const { matches: data, allowsNewBets: allows, isActive: active } = await matchService.getMatchesByRoundWithStatus(round)
      const matchesWithDefaults = data.map(m => ({
        ...m,
        includeInRound: m.includeInRound ?? true,
      }))
      setMatches(matchesWithDefaults)
      
      // Inicializar customTimeMatches com matches que têm horários fora da lista pré-definida
      const predefinedTimes = config.getGameTimesSync().map(t => t.trim())
      const customMatches = new Set<string>()
      matchesWithDefaults.forEach(match => {
        if (match.time) {
          const normalizedTime = match.time.trim()
          // Normalizar formato HH:MM (remover segundos se houver)
          const timeWithoutSeconds = normalizedTime.split(':').slice(0, 2).join(':')
          // Só marca como custom se NÃO está na lista pré-definida (nem com segundos, nem sem)
          const isInPredefined = predefinedTimes.includes(normalizedTime) || predefinedTimes.includes(timeWithoutSeconds)
          if (!isInPredefined) {
            customMatches.add(match.id)
          }
        }
      })
      setCustomTimeMatches(customMatches)
      
      setAllowsNewBets(allows)
      setIsActive(active !== undefined ? active : true) // Default true se não existir

      // Definir data/hora global baseada no primeiro jogo da rodada
      if (data.length > 0) {
        const firstMatch = data[0]
        setGlobalDate(firstMatch.date || '')
        setGlobalTime(firstMatch.time || '')
      }

      // Marcar como carregamento inicial completo
      isInitialLoadRef.current = false
    } catch (error) {
      console.error('Error loading matches:', error)
      // Fallback: tentar sem status
      try {
        const data = await matchService.getMatchesByRound(round)
        const matchesWithDefaults = data.map(m => ({
          ...m,
          includeInRound: m.includeInRound ?? true,
        }))
        setMatches(matchesWithDefaults)
        
        // Inicializar customTimeMatches com matches que têm horários fora da lista pré-definida
        const predefinedTimes = config.getGameTimesSync().map(t => t.trim())
        const customMatches = new Set<string>()
        matchesWithDefaults.forEach(match => {
          if (match.time) {
            const normalizedTime = match.time.trim()
            // Normalizar formato HH:MM (remover segundos se houver)
            const timeWithoutSeconds = normalizedTime.split(':').slice(0, 2).join(':')
            // Só marca como custom se NÃO está na lista pré-definida (nem com segundos, nem sem)
            const isInPredefined = predefinedTimes.includes(normalizedTime) || predefinedTimes.includes(timeWithoutSeconds)
            if (!isInPredefined) {
              customMatches.add(match.id)
            }
          }
        })
        setCustomTimeMatches(customMatches)
        
        setAllowsNewBets(true)
        setIsActive(true)
      } catch (fallbackError) {
        console.error('Error loading matches (fallback):', fallbackError)
      }
    } finally {
      setLoadingMatches(false)
      // Marcar como carregamento inicial completo mesmo em caso de erro
      isInitialLoadRef.current = false
    }
  }

  const displayMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text)
    setMessageType(type)
    setShowMessage(true)
    setTimeout(() => {
      setShowMessage(false)
    }, 3000)
  }

  const handleMatchChange = (id: string, field: keyof MatchWithInclude, value: any) => {
    setMatches(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)))
  }

  const handleScoreUpdate = async (matchId: string, field: 'homeScore' | 'awayScore', value: number) => {
    const currentMatch = matches.find(m => m.id === matchId)
    if (!currentMatch) return
    
    // Não permitir alterar placar se o jogo estiver agendado
    if (currentMatch.status === 'scheduled') {
      toast.error('O placar só pode ser atualizado quando o jogo está em andamento.')
      return
    }
    
    const score = value < 0 ? 0 : value
    
    // Update local state immediately
    setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, [field]: score } : m)))

    setSavingScore(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = {
        homeScore: field === 'homeScore' ? score : currentMatch.homeScore,
        awayScore: field === 'awayScore' ? score : currentMatch.awayScore,
      }
      
      const updatedMatch = await matchService.updateMatch(matchId, payload)
      // Update local matches with updatedMatch
      setMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
    } catch (error) {
      console.error('Error saving score:', error)
      toast.error('Erro ao salvar placar. Tente novamente.')
    } finally {
      setSavingScore(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleStatusUpdate = async (matchId: string, newStatus: 'scheduled' | 'live' | 'finished') => {
    const currentMatch = matches.find(m => m.id === matchId)
    if (!currentMatch) return

    // Verificar se está mudando para "scheduled" (agendado) e se o placar não é 0x0
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

    setSavingStatus(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = { status: newStatus }

      // Se está mudando para "scheduled" e o placar não é 0x0, zerar o placar
      if (newStatus === 'scheduled') {
        const homeScore = currentMatch.homeScore ?? 0
        const awayScore = currentMatch.awayScore ?? 0

        if (homeScore !== 0 || awayScore !== 0) {
          payload.homeScore = 0
          payload.awayScore = 0
        }
      }

      const updatedMatch = await matchService.updateMatch(matchId, payload)
      // Update local matches with updatedMatch
      setMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))

      toast.success('Status atualizado com sucesso')
    } catch (error) {
      console.error('Error saving status:', error)
      toast.error('Erro ao salvar status. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleToggleAllowsNewBets = async (newValue: boolean) => {
    if (!selectedRound) return
    
    // Se tentando ativar, verificar se há jogos em andamento ou finalizados
    if (newValue === true) {
      const hasStartedMatches = matches.some(m => m.status === 'live' || m.status === 'finished')
      if (hasStartedMatches) {
        toast.error('Não é possível permitir novos palpites quando houver jogos em andamento ou finalizados')
        return
      }
    }
    
    setSavingAllowsNewBets(true)
    try {
      await matchService.updateRoundAllowsNewBets(selectedRound, newValue)
      setAllowsNewBets(newValue)
      // Mensagem removida conforme solicitado
    } catch (error) {
      console.error('Error updating allowsNewBets:', error)
      displayMessage('Erro ao atualizar. Tente novamente.', 'error')
      // Reverter mudança local em caso de erro
      setAllowsNewBets(!newValue)
    } finally {
      setSavingAllowsNewBets(false)
    }
  }

  const handleToggleIsActive = async (newValue: boolean) => {
    if (!selectedRound) return
    
    setSavingIsActive(true)
    try {
      await matchService.updateRoundIsActive(selectedRound, newValue)
      setIsActive(newValue)
      // Mensagem removida conforme solicitado
    } catch (error) {
      console.error('Error updating isActive:', error)
      displayMessage('Erro ao atualizar. Tente novamente.', 'error')
      // Reverter mudança local em caso de erro
      setIsActive(!newValue)
    } finally {
      setSavingIsActive(false)
    }
  }

  const handleRemoveMatch = async (matchId: string) => {
    const confirmed = await confirm.confirm({
      title: 'Deletar Confronto Permanentemente',
      message: 'Tem certeza que deseja deletar este confronto?\n\nEsta ação irá:\n- Deletar o confronto da base de dados\n- Remover todas as predictions associadas deste confronto dos palpites\n- Recalcular os pontos dos palpites afetados\n\nEsta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Deletar Permanentemente',
    })
    if (!confirmed) {
      return
    }
    
    try {
      // Deletar o match permanentemente
      await matchService.deleteMatch(matchId)
      
      // Atualizar estado local removendo o match da lista
      setMatches(prev => prev.filter(m => m.id !== matchId))
      
      displayMessage('Confronto deletado permanentemente com sucesso', 'success')
    } catch (error) {
      console.error('Error deleting match:', error)
      displayMessage('Erro ao deletar confronto. Tente novamente.', 'error')
      // Recarregar dados em caso de erro
      if (selectedRound) {
        await loadMatches(selectedRound)
      }
    }
  }

  const handleDeleteRound = async () => {
    if (!selectedRound) return
    
    if (!deletePassword) {
      displayMessage('Por favor, digite sua senha para confirmar', 'error')
      return
    }

    setDeletingRound(true)
    try {
      const result = await matchService.deleteRound(selectedRound, deletePassword)
      
      displayMessage(
        `Rodada ${selectedRound} deletada com sucesso! ${result.deletedMatches} confrontos e ${result.deletedTickets} palpites removidos.`,
        'success'
      )
      
      // Fechar modal e limpar senha
      setShowDeleteRoundModal(false)
      setDeletePassword('')
      
      // Recarregar rodadas e selecionar a primeira disponível
      const roundsData = await matchService.getAllRounds()
      const sortedRounds = [...roundsData].sort((a, b) => a - b)
      setRounds(sortedRounds)
      if (sortedRounds.length > 0) {
        setSelectedRound(sortedRounds[0])
      } else {
        setSelectedRound(undefined)
        setMatches([])
      }
    } catch (error: any) {
      console.error('Error deleting round:', error)
      const errorMessage = error?.message || 'Erro ao deletar rodada. Verifique sua senha e tente novamente.'
      displayMessage(errorMessage, 'error')
    } finally {
      setDeletingRound(false)
    }
  }

  const handleDeleteTicketsByRound = async () => {
    if (!selectedRound) return

    if (!deleteTicketsPassword) {
      toast.warning('Por favor, digite sua senha para confirmar')
      return
    }

    setDeletingTickets(true)
    try {
      const result = await ticketService.deleteTicketsByRound(selectedRound, deleteTicketsPassword)
      
      toast.success(
        `${result.deletedTickets} palpite${result.deletedTickets !== 1 ? 's' : ''} deletado${result.deletedTickets !== 1 ? 's' : ''} com sucesso da rodada ${selectedRound}.`
      )
      
      // Fechar modal e limpar senha
      setShowDeleteTicketsModal(false)
      setDeleteTicketsPassword('')
    } catch (error: any) {
      console.error('Error deleting tickets by round:', error)
      const errorMessage = error?.message || 'Erro ao deletar palpites da rodada. Verifique sua senha e tente novamente.'
      toast.error(errorMessage)
    } finally {
      setDeletingTickets(false)
    }
  }

  const handleAddMatch = async () => {
    if (!selectedRound) return

    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.date || !newMatch.time) {
      displayMessage('Preencha todos os campos do confronto', 'error')
      return
    }

    if (newMatch.homeTeam === newMatch.awayTeam) {
      displayMessage('Os times não podem ser iguais', 'error')
      return
    }

    setAddingMatch(true)
    try {
      await matchService.createMatch({
        homeTeam: newMatch.homeTeam,
        awayTeam: newMatch.awayTeam,
        date: newMatch.date,
        time: newMatch.time,
        round: selectedRound,
        homeTeamLogo: getLogoPath(newMatch.homeTeam, selectedLeague),
        awayTeamLogo: getLogoPath(newMatch.awayTeam, selectedLeague),
      })

      // Recarregar matches
      await loadMatches(selectedRound)
      
      // Limpar formulário
      setNewMatch({ homeTeam: '', awayTeam: '', date: '', time: '' })
      setShowAddMatch(false)
      displayMessage('Confronto adicionado com sucesso', 'success')
    } catch (error) {
      console.error('Error adding match:', error)
      displayMessage('Erro ao adicionar confronto. Tente novamente.', 'error')
    } finally {
      setAddingMatch(false)
    }
  }

  const availableTeams = selectedLeague === 'serie-a' ? SERIE_A_TEAMS : SERIE_B_TEAMS

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = matches.findIndex((match) => match.id === active.id)
    const newIndex = matches.findIndex((match) => match.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      // Reordenar array localmente
      const reorderedMatches = arrayMove(matches, oldIndex, newIndex)

      // Atualizar ordens sequenciais (1, 2, 3, ...)
      const updatedMatches = reorderedMatches.map((match, index) => ({
        ...match,
        order: index + 1
      }))

      setMatches(updatedMatches)

      // Salvar nova ordem no backend
      await saveNewOrder(updatedMatches)
    }
  }

  const saveNewOrder = async (matchesWithNewOrder: MatchWithInclude[]) => {
    if (!selectedRound) return

    setSavingOrder(true)
    try {
      const matchOrders = matchesWithNewOrder.map(match => ({
        matchId: match.id,
        order: match.order || 1
      }))

      await matchService.updateMatchOrder(selectedRound, matchOrders)

      displayMessage('Ordem dos jogos atualizada com sucesso!', 'success')
    } catch (error) {
      console.error('Error saving order:', error)
      displayMessage('Erro ao salvar ordem. Tente novamente.', 'error')
      // Recarregar dados em caso de erro
      await loadMatches(selectedRound)
    } finally {
      setSavingOrder(false)
    }
  }

  const handleCarouselNavigation = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentMatchIndex > 0) {
      setCurrentMatchIndex(currentMatchIndex - 1)
    } else if (direction === 'next' && currentMatchIndex < matches.length - 1) {
      setCurrentMatchIndex(currentMatchIndex + 1)
    }
  }

  const handleSaveRound = async () => {
    if (!selectedRound) return

    setSaving(true)
    try {
      // Preparar payload para atualizar apenas os confrontos (sem allowsNewBets)
      const payload = {
        matches: matches.map(m => {
          // Garantir que includeInRound seja sempre um boolean explícito
          // Se for undefined/null, assume true (padrão)
          const includeInRound = m.includeInRound === undefined || m.includeInRound === null
            ? true
            : Boolean(m.includeInRound)

          return {
            id: m.id,
            date: globalDate || m.date, // Usar data global se definida, senão manter a atual
            time: globalTime || m.time, // Usar hora global se definida, senão manter a atual
            includeInRound, // Sempre boolean explícito
            homeTeam: m.homeTeam, // Incluir times para permitir edição
            awayTeam: m.awayTeam,
          }
        })
      }

      // Debug: verificar se todos os includeInRound são boolean
      const allBooleans = payload.matches.every(m => typeof m.includeInRound === 'boolean')
      if (!allBooleans) {
        console.error('Erro: nem todos os includeInRound são boolean!', payload.matches)
        throw new Error('Erro ao preparar dados: includeInRound deve ser boolean')
      }

      // Chamar endpoint de atualização da rodada (apenas confrontos)
      await matchService.updateRound(selectedRound, payload)

      displayMessage('Rodada atualizada com sucesso!', 'success')
      // Recarregar dados
      await loadMatches(selectedRound)
    } catch (error) {
      console.error('Error saving round:', error)
      displayMessage('Erro ao salvar rodada. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const renderContent = () => {
    if (showRoundsLoading || showLoadingMatches) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Mensagem de sucesso/erro */}
        <AnimatePresence>
          {showMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`rounded-lg p-3 flex items-center gap-2 ${
                messageType === 'success'
                  ? 'bg-green-500/20 border border-green-500/50'
                  : 'bg-red-500/20 border border-red-500/50'
              }`}
            >
              {messageType === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${
                messageType === 'success' ? 'text-green-500' : 'text-red-500'
              }`}>
                {message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Switch de permite palpites */}
        <Card className="p-4 lg:p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm lg:text-base mb-1">Permitir Novos Palpites</h3>
              <p className="text-xs lg:text-sm text-muted-foreground">
                {(() => {
                  const hasStartedMatches = matches.some(m => m.status === 'live' || m.status === 'finished')
                  if (hasStartedMatches && !allowsNewBets) {
                    return 'Novos palpites só podem ser permitidos quando todos os jogos estiverem agendados'
                  }
                  return allowsNewBets ? 'Novos palpites podem ser criados para esta rodada' : 'Novos palpites estão bloqueados para esta rodada'
                })()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savingAllowsNewBets && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={allowsNewBets}
                onCheckedChange={handleToggleAllowsNewBets}
                disabled={savingAllowsNewBets || (matches.some(m => m.status === 'live' || m.status === 'finished') && !allowsNewBets)}
              />
            </div>
          </div>
        </Card>

        {/* Switch de rodada ativa/inativa */}
        <Card className="p-4 lg:p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-sm lg:text-base mb-1">Rodada Ativa</h3>
              <p className="text-xs lg:text-sm text-muted-foreground">
                {isActive ? 'Rodada visível no menu e aceita palpites' : 'Rodada oculta do menu e não aceita palpites'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {savingIsActive && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleIsActive}
                disabled={savingIsActive}
              />
            </div>
          </div>
        </Card>

        {/* Data e Hora do Jogo Atual */}
        {matches.length > 0 && (
          <Card className="p-4 lg:p-5 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-sm lg:text-base mb-1">Jogo Atual</h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <TeamLogo teamName={matches[currentMatchIndex]?.homeTeam} logo={matches[currentMatchIndex]?.homeTeamLogo} size="sm" className="h-6 w-6 lg:h-7 lg:w-7" noCircle />
                    <span className="text-sm font-medium">{getTeamDisplayName(matches[currentMatchIndex]?.homeTeam)}</span>
                  </div>
                  <span className="text-muted-foreground">×</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{getTeamDisplayName(matches[currentMatchIndex]?.awayTeam)}</span>
                    <TeamLogo teamName={matches[currentMatchIndex]?.awayTeam} logo={matches[currentMatchIndex]?.awayTeamLogo} size="sm" className="h-6 w-6 lg:h-7 lg:w-7" noCircle />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground mb-1">Data e Hora</div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {matches[currentMatchIndex]?.date ? new Date(matches[currentMatchIndex].date).toLocaleDateString('pt-BR') : '--/--/----'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {matches[currentMatchIndex]?.time || '--:--'}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Configuração global de data e hora da rodada */}
        <Card className="p-4 lg:p-5">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm lg:text-base mb-1">Data e Hora da Rodada</h3>
              <p className="text-xs lg:text-sm text-muted-foreground">
                Estes valores serão aplicados a todos os jogos da rodada quando salvar.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {/* Input de Data */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Data</label>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    type="date"
                    value={globalDate}
                    onChange={(e) => setGlobalDate(e.target.value)}
                    className="h-10 lg:h-11 text-sm lg:text-base pl-10 lg:pl-12 pr-3 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-datetime-edit]:text-sm lg:[&::-webkit-datetime-edit]:text-base [&::-webkit-datetime-edit]:h-full [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:items-center [&::-webkit-datetime-edit-fields-wrapper]:text-sm lg:[&::-webkit-datetime-edit-fields-wrapper]:text-base [&::-webkit-datetime-edit-fields-wrapper]:h-full [&::-webkit-datetime-edit-fields-wrapper]:flex [&::-webkit-datetime-edit-fields-wrapper]:items-center [&::-webkit-datetime-edit-text]:text-sm lg:[&::-webkit-datetime-edit-text]:text-base [&::-webkit-datetime-edit-month-field]:text-sm lg:[&::-webkit-datetime-edit-month-field]:text-base [&::-webkit-datetime-edit-day-field]:text-sm lg:[&::-webkit-datetime-edit-day-field]:text-base [&::-webkit-datetime-edit-year-field]:text-sm lg:[&::-webkit-datetime-edit-year-field]:text-base"
                  />
                </div>
              </div>

              {/* Input de Hora */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Hora</label>
                <div className="relative flex items-center">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground pointer-events-none z-10" />
                  <Input
                    type="time"
                    value={globalTime}
                    onChange={(e) => setGlobalTime(e.target.value)}
                    className="h-10 lg:h-11 text-sm lg:text-base pl-10 lg:pl-12 pr-3 w-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:text-sm lg:[&::-webkit-datetime-edit]:text-base [&::-webkit-datetime-edit]:h-full [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:items-center [&::-webkit-datetime-edit-fields-wrapper]:text-sm lg:[&::-webkit-datetime-edit-fields-wrapper]:text-base [&::-webkit-datetime-edit-fields-wrapper]:h-full [&::-webkit-datetime-edit-fields-wrapper]:flex [&::-webkit-datetime-edit-fields-wrapper]:items-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Lista de confrontos */}
        <Card className="p-3 lg:p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm lg:text-base">Confrontos da Rodada</h3>
            {/* Controles globais */}
            {matches.length > 0 && (
              <div className="flex items-center gap-3">
                {/* Botão de reordenação */}
                <Button
                  variant={isReordering ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (isReordering) {
                      // Salvar ordem e sair do modo reordenação
                      saveNewOrder(matches).then(() => {
                        setIsReordering(false)
                      })
                    } else {
                      // Entrar no modo reordenação
                      setIsReordering(true)
                    }
                  }}
                  disabled={savingOrder}
                  className="h-8 px-3 text-xs"
                >
                  {savingOrder ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Move className="h-3.5 w-3.5 mr-1.5" />
                      {isReordering ? 'Salvar Ordem' : 'Reordenar'}
                    </>
                  )}
                </Button>
                {/* Switch "Incluído nos Palpites" - global para todos os jogos da rodada */}
                <div className="flex items-center gap-2">
                  <span className="text-xs lg:text-sm text-muted-foreground hidden sm:inline">Incluído nos Palpites</span>
                  <Switch
                    checked={matches.every(m => m.includeInRound !== false)}
                    onCheckedChange={(checked) => {
                      // Atualizar todos os jogos para o mesmo valor
                      matches.forEach(match => {
                        handleMatchChange(match.id, 'includeInRound', checked)
                      })
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={matches.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                {matches.map((match, index) => (
                  <SortableItem key={match.id} id={match.id} isReordering={isReordering}>
                    <div className="space-y-2">
                <Card className={`p-3 lg:p-4 border ${
                  match.includeInRound === false
                    ? 'bg-secondary/10 border-border/30 opacity-60'
                    : 'bg-secondary/30 border-border/50'
                }`}>
                  {/* Linha 1: Times - apenas visualização (não editável) */}
                  <div className="flex items-center gap-2 mb-2 lg:mb-3">
                    <div className="flex-1 flex items-center min-w-0">
                      {/* Nome time 1 */}
                      <div className="flex-1 flex justify-end pr-2 min-w-0">
                        <span className="text-xs lg:text-sm font-semibold truncate text-foreground text-right">{getTeamDisplayName(match.homeTeam)}</span>
                      </div>
                      
                      {/* Escudos alinhados fixamente no centro */}
                      <div className="w-[88px] lg:w-[100px] flex items-center gap-1 justify-center flex-shrink-0">
                        <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-7 w-7 lg:h-8 lg:w-8" noCircle />
                        {editingMatchId === match.id && (match.homeScore !== undefined || match.awayScore !== undefined) ? (
                          <div className="flex items-center gap-1">
                            <div 
                              className="text-lg lg:text-xl font-bold text-foreground w-6 lg:w-8 text-center tabular-nums relative cursor-pointer hover:opacity-70 transition-opacity"
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
                            <span className="text-xs lg:text-sm text-muted-foreground/60 flex-shrink-0 font-medium">×</span>
                            <div 
                              className="text-lg lg:text-xl font-bold text-foreground w-6 lg:w-8 text-center tabular-nums relative cursor-pointer hover:opacity-70 transition-opacity"
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
                        ) : (
                          <span className="text-xs lg:text-sm text-muted-foreground/60 flex-shrink-0 font-medium">×</span>
                        )}
                        <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-7 w-7 lg:h-8 lg:w-8" noCircle />
                      </div>
                      
                      {/* Nome time 2 */}
                      <div className="flex-1 flex justify-start pl-2 min-w-0">
                        <span className="text-xs lg:text-sm font-semibold truncate text-foreground text-left">{getTeamDisplayName(match.awayTeam)}</span>
                      </div>
                    </div>
                  </div>

                </Card>

                {/* Componente de atualizar placar - Card separado, isolado */}
                {editingMatchId === match.id ? (
                  <Card className="p-0 relative overflow-hidden">
                    <div className="px-4 pt-3 pb-2 border-b border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-foreground">
                          Atualizar Placar
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMatchId(null)}
                          className="h-6 px-2"
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 w-full p-4">
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
                              {showScoreHint[match.id] === 'home' && (
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
                              onClick={() => {
                                handleScoreUpdate(match.id, 'homeScore', (match.homeScore ?? 0) - 1)
                                setShowScoreHint(prev => {
                                  const next = { ...prev }
                                  delete next[match.id]
                                  return next
                                })
                              }}
                              disabled={savingScore[match.id] || (match.homeScore ?? 0) === 0}
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
                              {showScoreHint[match.id] === 'home' && (
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
                              onClick={() => {
                                handleScoreUpdate(match.id, 'homeScore', (match.homeScore ?? 0) + 1)
                                setShowScoreHint(prev => {
                                  const next = { ...prev }
                                  delete next[match.id]
                                  return next
                                })
                              }}
                              disabled={savingScore[match.id] || (match.homeScore ?? 0) === 10}
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
                              {showScoreHint[match.id] === 'away' && (
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
                              onClick={() => {
                                handleScoreUpdate(match.id, 'awayScore', (match.awayScore ?? 0) - 1)
                                setShowScoreHint(prev => {
                                  const next = { ...prev }
                                  delete next[match.id]
                                  return next
                                })
                              }}
                              disabled={savingScore[match.id] || (match.awayScore ?? 0) === 0}
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
                              {showScoreHint[match.id] === 'away' && (
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
                              onClick={() => {
                                handleScoreUpdate(match.id, 'awayScore', (match.awayScore ?? 0) + 1)
                                setShowScoreHint(prev => {
                                  const next = { ...prev }
                                  delete next[match.id]
                                  return next
                                })
                              }}
                              disabled={savingScore[match.id] || (match.awayScore ?? 0) === 10}
                              className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus className="h-9 w-9" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMatchId(match.id)}
                    className="w-full flex items-center justify-center gap-1.5 h-8 lg:h-9 text-xs lg:text-sm"
                  >
                    <Edit className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    {match.homeScore !== undefined && match.awayScore !== undefined 
                      ? `Placar: ${match.homeScore} × ${match.awayScore}`
                      : 'Atualizar Placar'}
                  </Button>
                )}

                {/* Status do Jogo */}
                <Card className="p-3 lg:p-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold mb-1.5 text-muted-foreground">Status do Jogo</div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleStatusUpdate(match.id, 'scheduled')}
                        disabled={savingStatus[match.id]}
                        className={cn(
                          'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                          'border-2',
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
                          'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                          'border-2',
                          match.status === 'live'
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                        )}
                      >
                        Em Andamento
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(match.id, 'finished')}
                        disabled={savingStatus[match.id]}
                        className={cn(
                          'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                          'border-2',
                          match.status === 'finished'
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                        )}
                      >
                        Finalizado
                      </button>
                    </div>
                    {savingStatus[match.id] && (
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Salvando...</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Switch e botão deletar - isolados, sem card */}
                <div className="space-y-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm lg:text-base mb-1">Incluído nos Palpites</h3>
                      <p className="text-xs lg:text-sm text-muted-foreground">
                        {match.includeInRound ?? true 
                          ? 'Este jogo está incluído nos palpites' 
                          : 'Este jogo não está incluído nos palpites'}
                      </p>
                    </div>
                    <Switch
                      checked={match.includeInRound ?? true}
                      onCheckedChange={(checked) => handleMatchChange(match.id, 'includeInRound', checked)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-center gap-1.5 h-8 lg:h-9 text-xs lg:text-sm text-red-500 hover:text-red-600 hover:border-red-500"
                    onClick={() => handleRemoveMatch(match.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    Deletar Confronto
                  </Button>
                  </div>
                </div>
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Botão Adicionar Confronto */}
          {!showAddMatch && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddMatch(true)}
              className="w-full flex items-center gap-1 mt-3"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          )}

          {/* Formulário de adicionar novo confronto */}
          {showAddMatch && (
            <Card className="mt-3 p-3 bg-secondary/50 border-2 border-dashed border-primary/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Novo Confronto</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddMatch(false)
                      setNewMatch({ homeTeam: '', awayTeam: '', date: '', time: '' })
                      setShowCustomTime(false)
                    }}
                    className="h-6 px-2"
                  >
                    Cancelar
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Time Casa</label>
                    <select
                      value={newMatch.homeTeam}
                      onChange={e => setNewMatch({ ...newMatch, homeTeam: e.target.value })}
                      className="w-full h-8 text-xs px-2 rounded border border-border bg-background"
                    >
                      <option value="">Selecione</option>
                      {availableTeams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Time Visitante</label>
                    <select
                      value={newMatch.awayTeam}
                      onChange={e => setNewMatch({ ...newMatch, awayTeam: e.target.value })}
                      className="w-full h-8 text-xs px-2 rounded border border-border bg-background"
                    >
                      <option value="">Selecione</option>
                      {availableTeams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Data</label>
                    <div className="relative flex items-center">
                      <Input
                        type="date"
                        value={newMatch.date}
                        onChange={e => setNewMatch({ ...newMatch, date: e.target.value })}
                        className="h-8 text-xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-datetime-edit]:text-xs [&::-webkit-datetime-edit]:h-full [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:items-center [&::-webkit-datetime-edit-fields-wrapper]:text-xs [&::-webkit-datetime-edit-fields-wrapper]:h-full [&::-webkit-datetime-edit-fields-wrapper]:flex [&::-webkit-datetime-edit-fields-wrapper]:items-center [&::-webkit-datetime-edit-text]:text-xs [&::-webkit-datetime-edit-month-field]:text-xs [&::-webkit-datetime-edit-day-field]:text-xs [&::-webkit-datetime-edit-year-field]:text-xs"
                        style={{ fontSize: '12px', minWidth: 0, maxWidth: '100%', width: '100%', height: '32px', lineHeight: '32px', paddingTop: '0', paddingBottom: '0', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Hora</label>
                    {!showCustomTime ? (
                      <div className="relative flex items-center">
                        <select
                          value={newMatch.time}
                          onChange={e => setNewMatch({ ...newMatch, time: e.target.value })}
                          className="w-full h-8 text-xs px-2 rounded border border-border bg-background"
                          style={{ height: '32px', lineHeight: '32px', paddingTop: '0', paddingBottom: '0', boxSizing: 'border-box' }}
                        >
                          <option value="">Selecione</option>
                          {config.getGameTimesSync().map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <div className="relative flex items-center flex-1">
                          <Input
                            type="time"
                            value={newMatch.time}
                            onChange={e => setNewMatch({ ...newMatch, time: e.target.value })}
                            className="h-8 text-xs flex-1 [&::-webkit-datetime-edit]:text-xs [&::-webkit-datetime-edit]:h-full [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:items-center [&::-webkit-datetime-edit-fields-wrapper]:text-xs [&::-webkit-datetime-edit-fields-wrapper]:h-full [&::-webkit-datetime-edit-fields-wrapper]:flex [&::-webkit-datetime-edit-fields-wrapper]:items-center"
                            style={{ height: '32px', lineHeight: '32px', paddingTop: '0', paddingBottom: '0', boxSizing: 'border-box' }}
                            autoFocus
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowCustomTime(false)
                            setNewMatch({ ...newMatch, time: '' })
                          }}
                          className="h-8 px-2"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleAddMatch}
                  disabled={addingMatch}
                  size="sm"
                  className="w-full"
                >
                  {addingMatch ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-3.5 w-3.5" /> Adicionar Confronto
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

        </Card>

        {/* Carrossel de Jogos */}
        {matches.length > 0 && (
          <Card className={`p-0 relative overflow-hidden`}>

            {/* Carrossel */}
            <div
              ref={carouselContainerRef}
              className="relative overflow-hidden pt-3 pb-1"
              style={{ touchAction: 'pan-x' }}
            >
              <motion.div
                className="flex"
                animate={{
                  x: `-${currentMatchIndex * 100}%`,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {matches.map((match) => {
                  const isCurrentMatch = match.id === editingMatchId

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
                              <div className={`text-4xl font-bold tabular-nums ${isCurrentMatch ? 'text-primary' : 'text-foreground'}`}>
                                {match.homeScore ?? 0}
                              </div>
                              <span className="text-3xl font-bold text-muted-foreground">×</span>
                              <div className={`text-4xl font-bold tabular-nums ${isCurrentMatch ? 'text-primary' : 'text-foreground'}`}>
                                {match.awayScore ?? 0}
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
                  animate={{ width: `${matches.length > 0 ? ((currentMatchIndex + 1) / matches.length) * 100 : 0}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {matches.length > 0 ? `Jogo ${currentMatchIndex + 1} de ${matches.length}` : ''}
              </p>
            </div>
          </Card>
        )}

        {/* Navegação do Carrossel */}
        {matches.length > 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 relative z-30">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleCarouselNavigation('prev')}
                disabled={currentMatchIndex === 0}
                className="flex-1 opacity-70 hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="text-sm">Anterior</span>
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={() => handleCarouselNavigation('next')}
                disabled={currentMatchIndex === matches.length - 1}
                className="flex-1"
              >
                <span className="text-sm">Próximo</span>
                <ChevronRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Card de atualização de placar */}
        {editingMatchId && (() => {
          const currentMatch = matches.find(m => m.id === editingMatchId)
          if (!currentMatch) return null

          return (
            <Card className="p-0 relative overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-foreground">
                    Atualizar Placar
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMatchId(null)}
                    className="h-6 px-2"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 w-full p-4">
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
                        onClick={() => {
                          handleScoreUpdate(currentMatch.id, 'homeScore', (currentMatch.homeScore ?? 0) - 1)
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.homeScore ?? 0) === 0}
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
                        onClick={() => {
                          handleScoreUpdate(currentMatch.id, 'homeScore', (currentMatch.homeScore ?? 0) + 1)
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.homeScore ?? 0) === 10}
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
                        onClick={() => {
                          handleScoreUpdate(currentMatch.id, 'awayScore', (currentMatch.awayScore ?? 0) - 1)
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.awayScore ?? 0) === 0}
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
                        onClick={() => {
                          handleScoreUpdate(currentMatch.id, 'awayScore', (currentMatch.awayScore ?? 0) + 1)
                          setShowScoreHint(prev => {
                            const next = { ...prev }
                            delete next[currentMatch.id]
                            return next
                          })
                        }}
                        disabled={savingScore[currentMatch.id] || (currentMatch.awayScore ?? 0) === 10}
                        className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-9 w-9" />
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })()}

        {/* Botão para deletar todos os palpites da rodada */}
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm mb-1 text-red-400">Deletar Todos os Palpites</h3>
              <p className="text-xs text-muted-foreground">
                Remove todos os palpites da rodada, mas mantém a rodada e os confrontos intactos.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteTicketsModal(true)}
              disabled={deletingTickets || !selectedRound}
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Deletar Todos os Palpites
            </Button>
          </div>
        </Card>

        {/* Botão para excluir rodada */}
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm mb-1 text-red-400">Excluir Rodada</h3>
              <p className="text-xs text-muted-foreground">
                Remove permanentemente a rodada, todos os confrontos e todos os palpites associados. Esta ação é irreversível.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteRoundModal(true)}
              disabled={deletingRound || !selectedRound}
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Rodada
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 w-full">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
            className="rounded-full h-10 w-10 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold">Editar Rodada</h1>
              {!roundsLoading ? (
                <>
                  {/* Debug: mostrar quantidade de rodadas */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-muted-foreground">
                      Rodadas: {rounds.length}
                    </div>
                  )}
                  <RoundSelector
                    rounds={rounds}
                    selectedRound={selectedRound}
                    onRoundChange={(round) => {
                      setSelectedRound(round)
                      // Salvar no localStorage para manter como padrão
                      localStorage.setItem('lastSelectedRound', round.toString())
                    }}
                  onOpen={async () => {
                    // Recarregar rodadas quando abrir o dropdown (apenas se necessário)
                    // Verificar se já temos rodadas carregadas antes de recarregar
                    if (rounds.length === 0) {
                      try {
                        const roundsData = await matchService.getAllRounds()
                        const sortedRounds = [...roundsData].sort((a, b) => a - b)
                        setRounds(sortedRounds)
                      } catch (error) {
                        console.error('Error reloading rounds:', error)
                      }
                    }
                  }}
                    className="w-40 lg:w-48"
                  />
                  <Button
                    onClick={handleSaveRound}
                    disabled={saving}
                    size="sm"
                    className="h-9 px-3"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-3.5 w-3.5" />
                        Salvar Rodada
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="w-40 lg:w-48 h-10 bg-secondary/50 rounded-md animate-pulse" />
              )}
            </div>
          </div>
        </div>
        {renderContent()}

        {/* Modal de confirmação para excluir rodada */}
        <AnimatePresence>
          {showDeleteRoundModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !deletingRound && setShowDeleteRoundModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background border border-border rounded-lg p-6 max-w-md md:max-w-2xl w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/20 rounded-full">
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold">Excluir Rodada {selectedRound}</h2>
                </div>

                <div className="space-y-4 mb-6">
                  <p className="text-sm text-muted-foreground">
                    Esta ação é <strong className="text-red-500">irreversível</strong> e irá:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                    <li>Deletar todos os confrontos da rodada</li>
                    <li>Deletar todos os palpites associados à rodada</li>
                    <li>Remover a configuração da rodada</li>
                  </ul>
                  <p className="text-sm font-semibold text-red-500">
                    Digite sua senha para confirmar:
                  </p>
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={deletingRound}
                    className="w-full"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteRoundModal(false)
                      setDeletePassword('')
                    }}
                    disabled={deletingRound}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDeleteRound}
                    disabled={deletingRound || !deletePassword}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {deletingRound ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Rodada
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de confirmação para deletar palpites */}
        <AnimatePresence>
          {showDeleteTicketsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => !deletingTickets && setShowDeleteTicketsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-background border border-border rounded-lg p-6 max-w-md md:max-w-2xl w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-500/20 rounded-full">
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold">Deletar Todos os Palpites - Rodada {selectedRound}</h2>
                </div>

                <div className="space-y-4 mb-6">
                  <p className="text-sm text-muted-foreground">
                    Esta ação é <strong className="text-red-500">irreversível</strong> e irá:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                    <li>Deletar todos os palpites (pendentes, confirmados e cancelados)</li>
                    <li>Remover todas as pontuações calculadas</li>
                    <li>Manter a rodada e os confrontos intactos</li>
                  </ul>
                  <p className="text-sm font-semibold text-red-500">
                    Digite sua senha para confirmar:
                  </p>
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    value={deleteTicketsPassword}
                    onChange={(e) => setDeleteTicketsPassword(e.target.value)}
                    disabled={deletingTickets}
                    className="w-full"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteTicketsModal(false)
                      setDeleteTicketsPassword('')
                    }}
                    disabled={deletingTickets}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleDeleteTicketsByRound}
                    disabled={deletingTickets || !deleteTicketsPassword}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {deletingTickets ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deletando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Deletar Palpites
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
