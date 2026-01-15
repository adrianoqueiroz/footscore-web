import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Radio, Plus, ArrowLeft, Info, CheckCircle2, XCircle, Trash2, Calendar, Minus, Move, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import TeamLogo from '@/components/ui/TeamLogo'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import RoundSelector from '@/components/ui/RoundSelector'
import SortableItem from '@/components/ui/SortableItem'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { ticketService } from '@/services/ticket.service'
import { matchService } from '@/services/match.service'
import { Match } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { config } from '@/config'
import { cn, parseMatchDateTime } from '@/lib/utils'
import { getTeamDisplayName } from '@/lib/teamNames'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'

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

export default function AdminUpdateGames() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { rounds, selectedRound, setSelectedRound, refreshRounds } = useRoundSelector()

  // Chave para armazenar a seleção da página admin no localStorage
  const ADMIN_ROUND_SELECTION_KEY = 'admin_selected_round'
  const toast = useToastContext()
  const confirm = useConfirmContext()

  // Estados para update-games
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [updateGamesMatches, setUpdateGamesMatches] = useState<Match[]>([])
  const [updateGamesLoading, setUpdateGamesLoading] = useState(false)
  const [roundsSelectorLoading, setRoundsSelectorLoading] = useState(false)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const carouselContainerRef = useRef<HTMLDivElement>(null)
  const [currentMatchIndex2, setCurrentMatchIndex2] = useState(0)
  const carouselContainerRef2 = useRef<HTMLDivElement>(null)
  const [carouselWidth2, setCarouselWidth2] = useState(0)
  const [carouselWidth, setCarouselWidth] = useState(0)
  const [showDateTimeModal, setShowDateTimeModal] = useState(false)
  const [editingMatchForDateTime, setEditingMatchForDateTime] = useState<string | null>(null)
  const [tempDate, setTempDate] = useState('')
  const [tempTime, setTempTime] = useState('')
  const [roundsSelectorInitialized, setRoundsSelectorInitialized] = useState(false)
  const [showAllRounds, setShowAllRounds] = useState(false)
  const [allRoundsForSelector, setAllRoundsForSelector] = useState<number[]>([])
  const [adminSelectedRound, setAdminSelectedRound] = useState<number | undefined>(undefined)
  const [allowsNewBets, setAllowsNewBets] = useState<boolean | undefined>(undefined)
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined)
  const [savingAllowsNewBets, setSavingAllowsNewBets] = useState(false)
  const [savingIsActive, setSavingIsActive] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [reorderKey, setReorderKey] = useState(0)
  const [isTwoColumns, setIsTwoColumns] = useState(window.innerWidth >= 1024)
  const [customTimeMatches, setCustomTimeMatches] = useState<Set<string>>(new Set())
  const [showDeleteRoundModal, setShowDeleteRoundModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletingRound, setDeletingRound] = useState(false)
  const [showDeleteTicketsModal, setShowDeleteTicketsModal] = useState(false)
  const [deleteTicketsPassword, setDeleteTicketsPassword] = useState('')
  const [deletingTickets, setDeletingTickets] = useState(false)
  const isInitialLoadRef = useRef(true)
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [addingMatch, setAddingMatch] = useState(false)
  const [selectedLeague, setSelectedLeague] = useState<'serie-a' | 'serie-b'>('serie-a')
  const [newMatch, setNewMatch] = useState({
    homeTeam: '',
    awayTeam: '',
    date: '',
    time: '',
  })
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [savingScore, setSavingScore] = useState<Record<string, boolean>>({})
  const [showScoreHint, setShowScoreHint] = useState<Record<string, 'home' | 'away' | null>>({})

  // Ler query params na inicialização
  useEffect(() => {
    const roundParam = searchParams.get('round')
    if (roundParam) {
      const roundNumber = parseInt(roundParam, 10)
      if (!isNaN(roundNumber) && rounds.length > 0 && rounds.includes(roundNumber)) {
        setSelectedRound(roundNumber)
      }
    }
  }, [searchParams, rounds, setSelectedRound])

  // Carregar todas as rodadas quando a página é montada (uma vez)
  useEffect(() => {
    const loadAllRoundsOnMount = async () => {
      if (!roundsSelectorInitialized) {
        // Definir showAllRounds imediatamente para evitar mudança visual
        setShowAllRounds(true)
        setRoundsSelectorLoading(true)
        try {
          const roundsData = await matchService.getAllRounds()
          const sortedRounds = [...roundsData].sort((a, b) => a - b)
          setAllRoundsForSelector(sortedRounds)

          // Inicializar a seleção local da admin
          setAdminSelectedRound(() => {
            // Primeiro tentar carregar do localStorage
            const savedAdminRound = localStorage.getItem(ADMIN_ROUND_SELECTION_KEY)
            if (savedAdminRound) {
              const parsedRound = parseInt(savedAdminRound, 10)
              if (!isNaN(parsedRound)) {
                return parsedRound
              }
            }
            // Caso contrário, inicializar com a seleção global ou última rodada
            return selectedRound || (roundsData.length > 0 ? roundsData[roundsData.length - 1] : undefined)
          })

          setRoundsSelectorInitialized(true)
        } catch (error) {
          console.error('Error loading all rounds on mount:', error)
          // Em caso de erro, usar as rodadas ativas como fallback
          setAllRoundsForSelector(rounds)
          setAdminSelectedRound(() => {
            // Mesmo tratamento em caso de erro
            const savedAdminRound = localStorage.getItem(ADMIN_ROUND_SELECTION_KEY)
            if (savedAdminRound) {
              const parsedRound = parseInt(savedAdminRound, 10)
              if (!isNaN(parsedRound)) {
                return parsedRound
              }
            }
            return selectedRound || (rounds.length > 0 ? rounds[rounds.length - 1] : undefined)
          })
          setRoundsSelectorInitialized(true)
        } finally {
          setRoundsSelectorLoading(false)
        }
      }
    }

    loadAllRoundsOnMount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Removido rounds e selectedRound das dependências para evitar recarregamento

  // Detectar layout de 2 colunas
  useEffect(() => {
    const handleResize = () => {
      setIsTwoColumns(window.innerWidth >= 1024)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Carregar matches quando rodada selecionada mudar
  useEffect(() => {
    if (adminSelectedRound) {
      isInitialLoadRef.current = true
      // Resetar estados para mostrar skeletons durante o loading
      setAllowsNewBets(undefined)
      setIsActive(undefined)
      loadUpdateGamesMatches(adminSelectedRound)
    }
  }, [adminSelectedRound])

  // Calcular largura do carrossel
  useEffect(() => {
    if (updateGamesMatches.length === 0) return

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
  }, [updateGamesMatches.length])

  // Calcular largura do carrossel2 (duplicado)
  useEffect(() => {
    if (updateGamesMatches.length === 0) return

    const updateCarouselWidth2 = () => {
      if (carouselContainerRef2.current) {
        const rect = carouselContainerRef2.current.getBoundingClientRect()
        if (rect.width > 0) {
          setCarouselWidth2(rect.width)
        }
      }
    }

    const timeoutId = setTimeout(updateCarouselWidth2, 100)

    const observer = new ResizeObserver(() => {
      updateCarouselWidth2()
    })

    if (carouselContainerRef2.current) {
      observer.observe(carouselContainerRef2.current)
    }

    window.addEventListener('resize', updateCarouselWidth2)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateCarouselWidth2)
      observer.disconnect()
    }
  }, [updateGamesMatches.length])

  // Configurar sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Aumentado para evitar conflitos com scroll
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Aumentado para dar mais tempo para scroll antes de ativar drag
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleCarouselNavigation = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentMatchIndex2 > 0) {
      const newIndex = currentMatchIndex2 - 1
      setCurrentMatchIndex2(newIndex)
      setSelectedMatchId(updateGamesMatches[newIndex].id)
    } else if (direction === 'next' && currentMatchIndex2 < updateGamesMatches.length - 1) {
      const newIndex = currentMatchIndex2 + 1
      setCurrentMatchIndex2(newIndex)
      setSelectedMatchId(updateGamesMatches[newIndex].id)
    }
  }

  const handleSaveDateTime = async () => {
    if (!editingMatchForDateTime) return

    const match = updateGamesMatches.find(m => m.id === editingMatchForDateTime)
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
        setUpdateGamesMatches(prev => prev.map(m => 
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

  const loadUpdateGamesMatches = async (round: number) => {
    setUpdateGamesLoading(true)
    try {
      const { matches: data, allowsNewBets: allows, isActive: active } = await matchService.getMatchesByRoundWithStatus(round)
      const matchesWithDefaults = data.map(m => ({
        ...m,
        includeInRound: m.includeInRound ?? true,
        status: m.status ?? 'scheduled',
        homeScore: m.homeScore ?? undefined,
        awayScore: m.awayScore ?? undefined,
      }))
      setUpdateGamesMatches(matchesWithDefaults)
      
      // Inicializar carrossel novo com o primeiro match
      if (matchesWithDefaults.length > 0) {
        setCurrentMatchIndex2(0)
        setSelectedMatchId(matchesWithDefaults[0].id)
      } else {
        setCurrentMatchIndex2(0)
        setSelectedMatchId(null)
      }
      
      const predefinedTimes = config.getGameTimesSync().map(t => t.trim())
      const customMatches = new Set<string>()
      matchesWithDefaults.forEach(match => {
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
      
      setAllowsNewBets(allows !== undefined ? allows : true)
      setIsActive(active !== undefined ? active : true)
      
      isInitialLoadRef.current = false
    } catch (error) {
      console.error('Error loading matches:', error)
      try {
        const data = await matchService.getMatchesByRound(round)
        const matchesWithDefaults = data.map(m => ({
          ...m,
          includeInRound: m.includeInRound ?? true,
          status: m.status ?? 'scheduled',
          homeScore: m.homeScore ?? undefined,
          awayScore: m.awayScore ?? undefined,
        }))
        setUpdateGamesMatches(matchesWithDefaults)
        
        // Inicializar carrossel novo com o primeiro match
        if (matchesWithDefaults.length > 0) {
          setCurrentMatchIndex2(0)
          setSelectedMatchId(matchesWithDefaults[0].id)
        } else {
          setCurrentMatchIndex2(0)
          setSelectedMatchId(null)
        }
        
        setAllowsNewBets(true)
        setIsActive(true)
      } catch (fallbackError) {
        console.error('Error loading matches (fallback):', fallbackError)
      }
    } finally {
      setUpdateGamesLoading(false)
      isInitialLoadRef.current = false
    }
  }

  const handleMatchChange = async (id: string, field: keyof Match, value: any) => {
    setUpdateGamesMatches(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)))
    
    // Salvar imediatamente no backend
    try {
      await matchService.updateMatch(id, { [field]: value })
    } catch (error) {
      console.error('Error updating match:', error)
      toast.error('Erro ao atualizar jogo')
    }
  }

  const handleScoreUpdate = async (matchId: string, field: 'homeScore' | 'awayScore', value: number) => {
    const currentMatch = updateGamesMatches.find(m => m.id === matchId)
    if (!currentMatch) return
    
    if (currentMatch.status === 'scheduled') {
      toast.error('O placar só pode ser atualizado quando o jogo está em andamento.')
      return
    }
    
    const score = value < 0 ? 0 : value
    
    setUpdateGamesMatches(prev => prev.map(m => (m.id === matchId ? { ...m, [field]: score } : m)))

    setSavingScore(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = {
        homeScore: field === 'homeScore' ? score : currentMatch.homeScore,
        awayScore: field === 'awayScore' ? score : currentMatch.awayScore,
      }
      
      const updatedMatch = await matchService.updateMatch(matchId, payload)
      setUpdateGamesMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
    } catch (error) {
      console.error('Error saving score:', error)
      toast.error('Erro ao salvar placar. Tente novamente.')
    } finally {
      setSavingScore(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleStatusUpdate = async (matchId: string, newStatus: Match['status']) => {
    const currentMatch = updateGamesMatches.find(m => m.id === matchId)
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

    setUpdateGamesMatches(prev => prev.map(m => (m.id === matchId ? { ...m, status: newStatus } : m)))

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
      setUpdateGamesMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
    } catch (error) {
      console.error('Error saving status:', error)
      toast.error('Erro ao salvar status. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleToggleAllowsNewBets = async (newValue: boolean) => {
    if (!adminSelectedRound) return
    
    if (newValue === true) {
      const hasStartedMatches = updateGamesMatches.some(m => m.status === 'live' || m.status === 'finished')
      if (hasStartedMatches) {
        toast.error('Novos palpites só podem ser permitidos quando todos os jogos estiverem agendados')
        return
      }
    }
    
    setSavingAllowsNewBets(true)
    try {
      await matchService.updateRoundAllowsNewBets(adminSelectedRound, newValue)
      setAllowsNewBets(newValue) // Atualizar estado local para mudança visual imediata
    } catch (error) {
      console.error('Error updating allowsNewBets:', error)
      toast.error('Erro ao atualizar. Tente novamente.')
    } finally {
      setSavingAllowsNewBets(false)
    }
  }

  const handleToggleIsActive = async (newValue: boolean) => {
    if (!adminSelectedRound) return
    
    setSavingIsActive(true)
    try {
      await matchService.updateRoundIsActive(adminSelectedRound, newValue)
      setIsActive(newValue) // Atualizar estado local para mudança visual imediata

      // Atualizar listas de rodadas nas outras telas
      await refreshRounds()
    } catch (error) {
      console.error('Error updating isActive:', error)
      toast.error('Erro ao atualizar. Tente novamente.')
    } finally {
      setSavingIsActive(false)
    }
  }

  const handleColumnDragEnd = (event: DragEndEvent, column: 'left' | 'right', leftColumn: Match[], rightColumn: Match[]) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const currentColumn = column === 'left' ? leftColumn : rightColumn
    const otherColumn = column === 'left' ? rightColumn : leftColumn

    const oldIndexInColumn = currentColumn.findIndex((match) => match.id === active.id)
    const newIndexInColumn = currentColumn.findIndex((match) => match.id === over.id)

    if (oldIndexInColumn === -1 || newIndexInColumn === -1) {
      return
    }

    const reorderedColumn = arrayMove(currentColumn, oldIndexInColumn, newIndexInColumn)

    const result: Match[] = []
    const maxLength = Math.max(reorderedColumn.length, otherColumn.length)

    for (let i = 0; i < maxLength; i++) {
      if (column === 'left') {
        if (i < reorderedColumn.length) result.push(reorderedColumn[i])
        if (i < otherColumn.length) result.push(otherColumn[i])
      } else {
        if (i < otherColumn.length) result.push(otherColumn[i])
        if (i < reorderedColumn.length) result.push(reorderedColumn[i])
      }
    }

    setUpdateGamesMatches(result.map((match, index) => ({
      ...match,
      order: index + 1
    })))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = updateGamesMatches.findIndex((match) => match.id === active.id)
    const newIndex = updateGamesMatches.findIndex((match) => match.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const reorderedMatches = arrayMove(updateGamesMatches, oldIndex, newIndex)
    setUpdateGamesMatches(reorderedMatches.map((match, index) => ({
      ...match,
      order: index + 1
    })))
  }

  const saveNewOrder = async (matchesWithNewOrder: Match[]) => {
    if (!adminSelectedRound) return

    setSavingOrder(true)
    try {
      const matchOrders = matchesWithNewOrder.map(match => ({
        matchId: match.id,
        order: match.order || 1
      }))

      await matchService.updateMatchOrder(adminSelectedRound, matchOrders)
      toast.success('Ordem dos jogos atualizada com sucesso!')
    } catch (error) {
      console.error('Error saving order:', error)
      toast.error('Erro ao salvar ordem. Tente novamente.')
      if (adminSelectedRound) {
        await loadUpdateGamesMatches(adminSelectedRound)
      }
    } finally {
      setSavingOrder(false)
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
      setUpdateGamesMatches(prev => prev.filter(m => m.id !== matchId))
      toast.success('Confronto deletado com sucesso')
    } catch (error) {
      console.error('Error deleting match:', error)
      toast.error('Erro ao deletar confronto. Tente novamente.')
    }
  }

  const handleDeleteAllTickets = async () => {
    if (!adminSelectedRound || !deleteTicketsPassword) return

    setDeletingTickets(true)
    try {
      await ticketService.deleteTicketsByRound(adminSelectedRound, deleteTicketsPassword)
      setShowDeleteTicketsModal(false)
      setDeleteTicketsPassword('')
      toast.success('Todos os palpites foram deletados com sucesso')
    } catch (error: any) {
      console.error('Error deleting tickets:', error)
      toast.error(error?.message || 'Erro ao deletar palpites. Verifique a senha e tente novamente.')
    } finally {
      setDeletingTickets(false)
    }
  }

  const handleDeleteRound = async () => {
    if (!adminSelectedRound || !deletePassword) return

    setDeletingRound(true)
    try {
      await matchService.deleteRound(adminSelectedRound, deletePassword)
      setShowDeleteRoundModal(false)
      setDeletePassword('')
      await refreshRounds()
      setSelectedRound(undefined)
      navigate('/admin')
      toast.success('Rodada deletada com sucesso')
    } catch (error: any) {
      console.error('Error deleting round:', error)
      toast.error(error?.message || 'Erro ao deletar rodada. Verifique a senha e tente novamente.')
    } finally {
      setDeletingRound(false)
    }
  }

  const handleMatchClick = (matchId: string) => {
    // Navegar para página separada de edição de jogo
    if (adminSelectedRound) {
      navigate(`/admin/edit-game?round=${adminSelectedRound}&matchId=${matchId}`)
    }
  }


  const handleAddMatch = async () => {
    if (!adminSelectedRound) return

    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.date || !newMatch.time) {
      toast.warning('Preencha todos os campos do confronto')
      return
    }

    if (newMatch.homeTeam === newMatch.awayTeam) {
      toast.warning('Os times não podem ser iguais')
      return
    }

    setAddingMatch(true)
    try {
      await matchService.createMatch({
        homeTeam: newMatch.homeTeam,
        awayTeam: newMatch.awayTeam,
        date: newMatch.date,
        time: newMatch.time,
        round: adminSelectedRound,
        homeTeamLogo: getLogoPath(newMatch.homeTeam, selectedLeague),
        awayTeamLogo: getLogoPath(newMatch.awayTeam, selectedLeague),
      })

      await loadUpdateGamesMatches(adminSelectedRound)
      setNewMatch({ homeTeam: '', awayTeam: '', date: '', time: '' })
      setShowAddMatch(false)
      toast.success('Confronto adicionado com sucesso')
    } catch (error) {
      console.error('Error adding match:', error)
      toast.error('Erro ao adicionar confronto. Tente novamente.')
    } finally {
      setAddingMatch(false)
    }
  }

  const availableTeams = selectedLeague === 'serie-a' ? SERIE_A_TEAMS : SERIE_B_TEAMS

  const getMatchDisplayInfo = (match: Match) => {
    const statusType = match.status || 'scheduled'
    const isLive = statusType === 'live'
    const isFinished = statusType === 'finished'
    
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
      isScheduled: statusType === 'scheduled' || !statusType
    }
  }


  // View de lista (principal) - continua na próxima parte devido ao tamanho
  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-4">
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
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold">Gerenciar Rodadas</h2>
              </div>
              <RoundSelector
                rounds={showAllRounds ? allRoundsForSelector : rounds}
                selectedRound={adminSelectedRound}
                onRoundChange={(round) => {
                  setAdminSelectedRound(round)
                  // Salvar no localStorage para persistir entre sessões
                  localStorage.setItem(ADMIN_ROUND_SELECTION_KEY, round.toString())
                  // Seleção independente - não afeta seleção global das outras páginas
                }}
                alwaysCallOnOpen={false}
              />
            </div>
          </div>
        </div>
        <div className="space-y-4 pt-4">
          {/* Switches de controle da rodada */}
          {adminSelectedRound && (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Permitir Novos Palpites</h3>
                    {updateGamesLoading || allowsNewBets === undefined ? (
                      <Skeleton className="h-4 w-48 mt-1" />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {allowsNewBets ? 'Novos palpites podem ser criados para esta rodada' : 'Novos palpites estão bloqueados para esta rodada'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {savingAllowsNewBets && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {updateGamesLoading || allowsNewBets === undefined ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <Switch
                        checked={allowsNewBets}
                        onCheckedChange={handleToggleAllowsNewBets}
                        disabled={savingAllowsNewBets}
                      />
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Rodada Ativa</h3>
                    {updateGamesLoading || isActive === undefined ? (
                      <Skeleton className="h-4 w-48 mt-1" />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {isActive ? 'Rodada visível no menu e aceita palpites' : 'Rodada oculta do menu e não aceita palpites'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {savingIsActive && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {updateGamesLoading || isActive === undefined ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <Switch
                        checked={isActive}
                        onCheckedChange={handleToggleIsActive}
                        disabled={savingIsActive}
                      />
                    )}
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">Reordenar Jogos</h3>
                    <p className="text-xs text-muted-foreground">
                      {isReordering ? 'Clique em "Salvar" após reordenar' : 'Clique para ativar o modo de reordenação'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant={isReordering ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isReordering) {
                          saveNewOrder(updateGamesMatches).then(() => {
                            setIsReordering(false)
                            setReorderKey(prev => prev + 1)
                          })
                        } else {
                          setIsReordering(true)
                          setReorderKey(prev => prev + 1)
                        }
                      }}
                      disabled={savingOrder}
                      className={`h-8 px-3 text-xs ${isReordering ? 'bg-green-600 hover:bg-green-700' : ''}`}
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
                  </div>
                </div>
              </Card>
            </>
          )}

          {isReordering && (
            <Card className="p-3 bg-blue-500/10 border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Move className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Modo reordenação ativo - Toque e arraste os jogos para reordenar
                </span>
              </div>
            </Card>
          )}

          {updateGamesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : updateGamesMatches.length === 0 ? (
            <Card className="p-6 text-center">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-2">
                Nenhum jogo encontrado
              </p>
              <p className="text-xs text-muted-foreground">
                Não há jogos cadastrados para esta rodada.
              </p>
            </Card>
          ) : (
            <>
              {(() => {
                const leftColumn = updateGamesMatches.filter((_, index) => index % 2 === 0)
                const rightColumn = updateGamesMatches.filter((_, index) => index % 2 === 1)

                return isTwoColumns ? (
                  <div className="grid grid-cols-2 gap-3">
                    <DndContext
                      key={`left-column-${reorderKey}`}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleColumnDragEnd(event, 'left', leftColumn, rightColumn)}
                    >
                      <SortableContext items={leftColumn.map(m => m.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {leftColumn.map((match, index) => {
                            const displayInfo = getMatchDisplayInfo(match)
                            const cardClasses = displayInfo.isLive
                              ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg'
                              : displayInfo.isFinished
                              ? 'border-2 border-green-400 bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-lg'
                              : ''
                            const isExcluded = match.includeInRound === false
                            const excludedClasses = isExcluded ? 'opacity-60 border-dashed' : ''
                            return (
                              <SortableItem key={`${match.id}-${isReordering}`} id={match.id} isReordering={isReordering}>
                                <Card
                                  className={cn(
                                    "p-2 transition-colors relative",
                                    isReordering
                                      ? "hover:bg-secondary/20"
                                      : "cursor-pointer hover:bg-secondary/30",
                                    cardClasses,
                                    excludedClasses
                                  )}
                                  onClick={isReordering ? undefined : () => handleMatchClick(match.id)}
                                >
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center flex-shrink-0">
                                        {displayInfo.showLiveBadge ? (
                                          <div className="flex flex-col items-center justify-center gap-0 min-w-[3rem]">
                                            <div className="flex items-center gap-0.5">
                                              <Radio className="h-2.5 w-2.5 text-yellow-300 animate-pulse flex-shrink-0" />
                                              <span className="text-yellow-300 leading-none text-[9px] font-semibold uppercase tracking-wide">
                                                AO VIVO
                                              </span>
                                            </div>
                                          </div>
                                        ) : displayInfo.dateDisplay ? (
                                          <div className="flex flex-col items-start min-w-[3rem]">
                                            <span className={cn(
                                              "leading-none text-[9px] font-semibold uppercase tracking-wide",
                                              displayInfo.isFinished
                                                ? "text-green-300"
                                                : displayInfo.isLive
                                                ? "text-yellow-300"
                                                : "text-muted-foreground"
                                            )}>
                                              {displayInfo.dateDisplay.dayOfWeek}
                                            </span>
                                            <span className={cn(
                                              "leading-tight text-[9px] font-medium mt-0.5",
                                              displayInfo.isFinished
                                                ? "text-green-300/90"
                                                : displayInfo.isLive
                                                ? "text-yellow-300/90"
                                                : "text-muted-foreground/80"
                                            )}>
                                              {displayInfo.dateDisplay.date}
                                              {' '}
                                              <span className={cn(
                                                "font-semibold",
                                                displayInfo.isFinished && "text-green-300",
                                                displayInfo.isLive && "text-yellow-300"
                                              )}>
                                                {displayInfo.dateDisplay.time}
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

                                      <div className={cn(
                                        "h-6 w-px flex-shrink-0",
                                        displayInfo.isLive && "bg-yellow-400",
                                        displayInfo.isFinished && "bg-green-400",
                                        !displayInfo.isLive && !displayInfo.isFinished && "bg-border"
                                      )} />

                                      <div className="flex-1 flex items-center min-w-0">
                                        <div className="flex-1 flex justify-end pr-1.5 min-w-0">
                                          <span className={cn(
                                            "text-sm font-semibold truncate text-right leading-tight",
                                            displayInfo.isLive && "text-yellow-300",
                                            displayInfo.isFinished && "text-green-300",
                                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                          )}>{getTeamDisplayName(match.homeTeam)}</span>
                                        </div>
                                        <div className="w-[80px] flex items-center gap-1 justify-center flex-shrink-0 px-1">
                                          <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-5 w-5" noCircle />
                                          <span className={cn(
                                            "text-sm font-bold flex-shrink-0 min-w-[2rem] text-center",
                                            displayInfo.isLive && "text-yellow-300",
                                            displayInfo.isFinished && "text-green-300",
                                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                          )}>
                                            {displayInfo.scoreDisplay || "0 × 0"}
                                          </span>
                                          <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-5 w-5" noCircle />
                                        </div>
                                        <div className="flex-1 flex justify-start pl-1.5 min-w-0">
                                          <span className={cn(
                                            "text-sm font-semibold truncate text-left leading-tight",
                                            displayInfo.isLive && "text-yellow-300",
                                            displayInfo.isFinished && "text-green-300",
                                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                          )}>{getTeamDisplayName(match.awayTeam)}</span>
                                        </div>
                                      </div>

                                      {isExcluded && (
                                        <XCircle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                      )}

                                      <div className="flex-shrink-0 ml-2">
                                        {displayInfo.statusType === 'scheduled' && (
                                          <Clock className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        {displayInfo.statusType === 'live' && (
                                          <Radio className="h-4 w-4 text-yellow-400" />
                                        )}
                                        {displayInfo.statusType === 'finished' && (
                                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                </Card>
                              </SortableItem>
                            )
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>

                    <DndContext
                      key={`right-column-${reorderKey}`}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleColumnDragEnd(event, 'right', leftColumn, rightColumn)}
                    >
                      <SortableContext items={rightColumn.map(m => m.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {rightColumn.map((match, index) => {
                            const displayInfo = getMatchDisplayInfo(match)
                            const cardClasses = displayInfo.isLive
                              ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg'
                              : displayInfo.isFinished
                              ? 'border-2 border-green-400 bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-lg'
                              : ''
                            const isExcluded = match.includeInRound === false
                            const excludedClasses = isExcluded ? 'opacity-60 border-dashed' : ''
                            return (
                              <SortableItem key={`${match.id}-${isReordering}`} id={match.id} isReordering={isReordering}>
                                <Card
                                  className={cn(
                                    "p-2 transition-colors relative",
                                    isReordering
                                      ? "hover:bg-secondary/20"
                                      : "cursor-pointer hover:bg-secondary/30",
                                    cardClasses,
                                    excludedClasses
                                  )}
                                  onClick={isReordering ? undefined : () => handleMatchClick(match.id)}
                                >
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.03 }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center flex-shrink-0">
                                        {displayInfo.showLiveBadge ? (
                                          <div className="flex flex-col items-center justify-center gap-0 min-w-[3rem]">
                                            <div className="flex items-center gap-0.5">
                                              <Radio className="h-2.5 w-2.5 text-yellow-300 animate-pulse flex-shrink-0" />
                                              <span className="text-yellow-300 leading-none text-[9px] font-semibold uppercase tracking-wide">
                                                AO VIVO
                                              </span>
                                            </div>
                                          </div>
                                        ) : displayInfo.dateDisplay ? (
                                          <div className="flex flex-col items-start min-w-[3rem]">
                                            <span className={cn(
                                              "leading-none text-[9px] font-semibold uppercase tracking-wide",
                                              displayInfo.isFinished
                                                ? "text-green-300"
                                                : displayInfo.isLive
                                                ? "text-yellow-300"
                                                : "text-muted-foreground"
                                            )}>
                                              {displayInfo.dateDisplay.dayOfWeek}
                                            </span>
                                            <span className={cn(
                                              "leading-tight text-[9px] font-medium mt-0.5",
                                              displayInfo.isFinished
                                                ? "text-green-300/90"
                                                : displayInfo.isLive
                                                ? "text-yellow-300/90"
                                                : "text-muted-foreground/80"
                                            )}>
                                              {displayInfo.dateDisplay.date}
                                              {' '}
                                              <span className={cn(
                                                "font-semibold",
                                                displayInfo.isFinished && "text-green-300",
                                                displayInfo.isLive && "text-yellow-300"
                                              )}>
                                                {displayInfo.dateDisplay.time}
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

                                      <div className={cn(
                                        "h-6 w-px flex-shrink-0",
                                        displayInfo.isLive && "bg-yellow-400",
                                        displayInfo.isFinished && "bg-green-400",
                                        !displayInfo.isLive && !displayInfo.isFinished && "bg-border"
                                      )} />

                                      <div className="flex-1 flex items-center min-w-0">
                                        <div className="flex-1 flex justify-end pr-1.5 min-w-0">
                                          <span className={cn(
                                            "text-sm font-semibold truncate text-right leading-tight",
                                            displayInfo.isLive && "text-yellow-300",
                                            displayInfo.isFinished && "text-green-300",
                                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                          )}>{getTeamDisplayName(match.homeTeam)}</span>
                                        </div>
                                        <div className="w-[80px] flex items-center gap-1 justify-center flex-shrink-0 px-1">
                                          <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-5 w-5" noCircle />
                                          <span className={cn(
                                            "text-sm font-bold flex-shrink-0 min-w-[2rem] text-center",
                                            displayInfo.isLive && "text-yellow-300",
                                            displayInfo.isFinished && "text-green-300",
                                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                          )}>
                                            {displayInfo.scoreDisplay || "0 × 0"}
                                          </span>
                                          <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-5 w-5" noCircle />
                                        </div>
                                        <div className="flex-1 flex justify-start pl-1.5 min-w-0">
                                          <span className={cn(
                                            "text-sm font-semibold truncate text-left leading-tight",
                                            displayInfo.isLive && "text-yellow-300",
                                            displayInfo.isFinished && "text-green-300",
                                            !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                          )}>{getTeamDisplayName(match.awayTeam)}</span>
                                        </div>
                                      </div>

                                      {isExcluded && (
                                        <XCircle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                      )}

                                      <div className="flex-shrink-0 ml-2">
                                        {displayInfo.statusType === 'scheduled' && (
                                          <Clock className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        {displayInfo.statusType === 'live' && (
                                          <Radio className="h-4 w-4 text-yellow-400" />
                                        )}
                                        {displayInfo.statusType === 'finished' && (
                                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                </Card>
                              </SortableItem>
                            )
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                ) : (
                  <DndContext
                    key={`single-column-${reorderKey}`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={updateGamesMatches.map(m => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {updateGamesMatches.map((match, index) => {
                          const displayInfo = getMatchDisplayInfo(match)
                          const cardClasses = displayInfo.isLive
                            ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg'
                            : displayInfo.isFinished
                            ? 'border-2 border-green-400 bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-lg'
                            : ''
                          const isExcluded = match.includeInRound === false
                          const excludedClasses = isExcluded ? 'opacity-60 border-dashed' : ''
                          return (
                            <SortableItem key={`${match.id}-${isReordering}`} id={match.id} isReordering={isReordering}>
                              <Card
                                className={cn(
                                  "p-2 transition-colors relative",
                                  isReordering
                                    ? "hover:bg-secondary/20"
                                    : "cursor-pointer hover:bg-secondary/30",
                                  cardClasses,
                                  excludedClasses
                                )}
                                onClick={isReordering ? undefined : () => handleMatchClick(match.id)}
                              >
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.03 }}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center flex-shrink-0">
                                      {displayInfo.showLiveBadge ? (
                                        <div className="flex flex-col items-center justify-center gap-0 min-w-[3rem]">
                                          <div className="flex items-center gap-0.5">
                                            <Radio className="h-2.5 w-2.5 text-yellow-300 animate-pulse flex-shrink-0" />
                                            <span className="text-yellow-300 leading-none text-[9px] font-semibold uppercase tracking-wide">
                                              AO VIVO
                                            </span>
                                          </div>
                                        </div>
                                      ) : displayInfo.dateDisplay ? (
                                        <div className="flex flex-col items-start min-w-[3rem]">
                                          <span className={cn(
                                            "leading-none text-[9px] font-semibold uppercase tracking-wide",
                                            displayInfo.isFinished
                                              ? "text-green-300"
                                              : displayInfo.isLive
                                              ? "text-yellow-300"
                                              : "text-muted-foreground"
                                          )}>
                                            {displayInfo.dateDisplay.dayOfWeek}
                                          </span>
                                          <span className={cn(
                                            "leading-tight text-[9px] font-medium mt-0.5",
                                            displayInfo.isFinished
                                              ? "text-green-300/90"
                                              : displayInfo.isLive
                                              ? "text-yellow-300/90"
                                              : "text-muted-foreground/80"
                                          )}>
                                            {displayInfo.dateDisplay.date}
                                            {' '}
                                            <span className={cn(
                                              "font-semibold",
                                              displayInfo.isFinished && "text-green-300",
                                              displayInfo.isLive && "text-yellow-300"
                                            )}>
                                              {displayInfo.dateDisplay.time}
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

                                    <div className={cn(
                                      "h-6 w-px flex-shrink-0",
                                      displayInfo.isLive && "bg-yellow-400",
                                      displayInfo.isFinished && "bg-green-400",
                                      !displayInfo.isLive && !displayInfo.isFinished && "bg-border"
                                    )} />

                                    <div className="flex-1 flex items-center min-w-0">
                                      <div className="flex-1 flex justify-end pr-1.5 min-w-0">
                                        <span className={cn(
                                          "text-sm font-semibold truncate text-right leading-tight",
                                          displayInfo.isLive && "text-yellow-300",
                                          displayInfo.isFinished && "text-green-300",
                                          !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                        )}>{getTeamDisplayName(match.homeTeam)}</span>
                                      </div>
                                      <div className="w-[80px] flex items-center gap-1 justify-center flex-shrink-0 px-1">
                                        <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-5 w-5" noCircle />
                                        <span className={cn(
                                          "text-sm font-bold flex-shrink-0 min-w-[2rem] text-center",
                                          displayInfo.isLive && "text-yellow-300",
                                          displayInfo.isFinished && "text-green-300",
                                          !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                        )}>
                                          {displayInfo.scoreDisplay || "0 × 0"}
                                        </span>
                                        <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-5 w-5" noCircle />
                                      </div>
                                      <div className="flex-1 flex justify-start pl-1.5 min-w-0">
                                        <span className={cn(
                                          "text-sm font-semibold truncate text-left leading-tight",
                                          displayInfo.isLive && "text-yellow-300",
                                          displayInfo.isFinished && "text-green-300",
                                          !displayInfo.isLive && !displayInfo.isFinished && "text-foreground"
                                        )}>{getTeamDisplayName(match.awayTeam)}</span>
                                      </div>
                                    </div>

                                    {isExcluded && (
                                      <XCircle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                                    )}

                                    <div className="flex-shrink-0 ml-2">
                                      {displayInfo.statusType === 'scheduled' && (
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      {displayInfo.statusType === 'live' && (
                                        <Radio className="h-4 w-4 text-yellow-400" />
                                      )}
                                      {displayInfo.statusType === 'finished' && (
                                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              </Card>
                            </SortableItem>
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                )
              })()}

              {!showAddMatch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddMatch(true)}
                  className="w-full flex items-center gap-1 mt-3"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Jogo
                </Button>
              )}

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
                        <Input
                          type="date"
                          value={newMatch.date}
                          onChange={e => setNewMatch({ ...newMatch, date: e.target.value })}
                          className="h-8 text-xs"
                          style={{ fontSize: '12px', height: '32px', lineHeight: '32px' }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Hora</label>
                        <select
                          value={newMatch.time}
                          onChange={e => setNewMatch({ ...newMatch, time: e.target.value })}
                          className="w-full h-8 text-xs px-2 rounded border border-border bg-background"
                        >
                          <option value="">Selecione</option>
                          {config.getGameTimesSync().map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
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
            </>
          )}

          {adminSelectedRound && (
            <>
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
                    disabled={deletingTickets}
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Deletar Todos os Palpites
                  </Button>
                </div>
              </Card>

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
                    disabled={deletingRound}
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Rodada
                  </Button>
                </div>
              </Card>
            </>
          )}

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
                    <h2 className="text-xl font-bold">Excluir Rodada {adminSelectedRound}</h2>
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
                    <h2 className="text-xl font-bold">Deletar Todos os Palpites - Rodada {adminSelectedRound}</h2>
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
                      onClick={handleDeleteAllTickets}
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
    </div>
  )
}
