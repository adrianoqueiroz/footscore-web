import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Clock, Radio, Plus, X, Settings, Trophy, Phone, Pencil, Loader2, Save, Users, ArrowLeft, Info, Search, CheckCircle2, XCircle, Trash2, Calendar, AlertCircle, Minus, Move, GripVertical } from 'lucide-react'
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
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
    // Melhorar performance no mobile
    touchAction: 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isReordering ? 'select-none' : ''}`}
    >
      {/* Área de drag específica - só aparece quando reordenando */}
      {isReordering && (
        <div
          className="absolute left-0 top-0 bottom-0 w-12 z-20 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
          onTouchStart={(e: React.TouchEvent) => {
            // Prevenir scroll padrão durante drag
            e.preventDefault()
          }}
        >
          <div className="flex items-center justify-center h-full">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className={`relative ${isReordering ? 'pl-12' : ''}`}>
        {children}
      </div>
    </div>
  )
}

import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Stepper from '@/components/ui/Stepper'
import MatchHeader from '@/components/MatchHeader'
import TeamLogo from '@/components/ui/TeamLogo'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import CreateRound from './CreateRound'
import RoundSelector from '@/components/ui/RoundSelector'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { ticketService } from '@/services/ticket.service'
import { matchService } from '@/services/match.service'
import { apiService } from '@/services/api.service'
import { authService } from '@/services/auth.service'
import { Ticket, Match, User } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { config } from '@/config'
import { cn, parseMatchDateTime } from '@/lib/utils'
import { getTeamDisplayName } from '@/lib/teamNames'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'

type AdminView = 'menu' | 'create-round' | 'results' | 'update-games' | 'manage-palpites' | 'manage-users' | 'settings'
type UpdateGamesView = 'list' | 'edit'

// Função para normalizar texto removendo acentos
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function Admin() {
  console.log('Admin component called')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({}) // For status updates
  const [savingScore, setSavingScore] = useState<Record<string, boolean>>({})   // For score updates
  const [showScoreHint, setShowScoreHint] = useState<Record<string, 'home' | 'away' | null>>({}) // Para mostrar indicativo visual
  const currentUser = authService.getCurrentUser()
  const userId = currentUser?.id
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<AdminView>('menu')
  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [gameTimes, setGameTimes] = useState<string[]>([])
  const [newGameTime, setNewGameTime] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [originalUser, setOriginalUser] = useState<User | null>(null) // Para comparar mudanças
  const [newPassword, setNewPassword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [palpitesTab, setPalpitesTab] = useState<'pending' | 'confirmed'>('pending')
  const { rounds, selectedRound, setSelectedRound, loading: roundsLoading, refreshRounds } = useRoundSelector()
  const toast = useToastContext()
  const confirm = useConfirmContext()
  const showRoundsLoading = useDelayedLoading(roundsLoading)
  const showLoading = useDelayedLoading(loading)

  // Estados para a nova view 'update-games'
  const [updateGamesView, setUpdateGamesView] = useState<UpdateGamesView>('list')
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [updateGamesMatches, setUpdateGamesMatches] = useState<Match[]>([])
  const [allRoundsForSelector, setAllRoundsForSelector] = useState<number[]>([]) // Todas as rodadas (incluindo inativas) para o seletor
  const [updateGamesLoading, setUpdateGamesLoading] = useState(false)
  const [roundsSelectorLoading, setRoundsSelectorLoading] = useState(false) // Loading específico para o seletor na view update-games
  const [roundsSelectorInitialized, setRoundsSelectorInitialized] = useState(false) // Indica se já carregou as rodadas pelo menos uma vez
  const [allowsNewBets, setAllowsNewBets] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [savingAllowsNewBets, setSavingAllowsNewBets] = useState(false)
  const [savingIsActive, setSavingIsActive] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [reorderKey, setReorderKey] = useState(0) // Força re-renderização quando muda
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

  // Times da Série A e B
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

  // Ler query params na inicialização
  useEffect(() => {
    const viewParam = searchParams.get('view')
    const roundParam = searchParams.get('round')
    
    if (viewParam && ['menu', 'create-round', 'results', 'update-games', 'manage-palpites', 'manage-users', 'settings'].includes(viewParam)) {
      setCurrentView(viewParam as AdminView)
    }
    
    if (roundParam) {
      const roundNumber = parseInt(roundParam, 10)
      if (!isNaN(roundNumber) && rounds.length > 0 && rounds.includes(roundNumber)) {
        setSelectedRound(roundNumber)
      }
    }
  }, [searchParams, rounds, setSelectedRound])

  useEffect(() => {
    if (currentView === 'settings') {
      // Carregar do backend
      config.getAdminWhatsApp().then(value => {
        setWhatsAppNumber(value)
      }).catch(() => {
        // Fallback para sync se falhar
        setWhatsAppNumber(config.getAdminWhatsAppSync())
      })
      
      config.getGameTimes().then(times => {
        setGameTimes(times)
      }).catch(() => {
        // Fallback para sync se falhar
        setGameTimes(config.getGameTimesSync())
      })
    }
  }, [currentView])

  useEffect(() => {
    if (currentView !== 'menu' && currentView !== 'create-round' && currentView !== 'settings' && currentView !== 'manage-users' && currentView !== 'update-games') {
      if (selectedRound) {
        loadData()
        setExpandedTicket(null)
        // Limpar busca e resetar aba ao mudar de rodada
        if (currentView === 'manage-palpites') {
          setSearchTerm('')
          setPalpitesTab('pending')
        }
      } else {
        // Se não há rodada selecionada, limpar estados
        setMatches([])
        setTickets([])
        setLoading(false)
        setSearchTerm('')
        setPalpitesTab('pending')
      }
    }
  }, [currentView, selectedRound])

  // Carregar matches quando rodada selecionada mudar na view update-games
  useEffect(() => {
    if (currentView === 'update-games' && selectedRound) {
      isInitialLoadRef.current = true
      loadUpdateGamesMatches(selectedRound)
    }
  }, [currentView, selectedRound])

  useEffect(() => {
    if (currentView === 'manage-users') {
      loadUsers()
    }
  }, [currentView])

  const loadData = async () => {
    if (!selectedRound) return
    setLoading(true)
    try {
      const [ticketsData, matchesData] = await Promise.all([
        ticketService.getAllTickets(),
        matchService.getMatchesByRound(selectedRound),
      ])

      const matchesWithDefaults = matchesData.map(m => ({
        ...m,
        status: m.status ?? 'scheduled',
        homeScore: m.homeScore ?? undefined,
        awayScore: m.awayScore ?? undefined,
      }))
      
      setTickets(ticketsData)
      setMatches(matchesWithDefaults)
    } catch (error) {
      console.error('Error loading admin data:', error)
      setTickets([])
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmTicket = async (ticketId: string) => {
    setSavingStatus(prev => ({ ...prev, [`confirm-${ticketId}`]: true })) // Reusing savingStatus for ticket operations
    try {
      await ticketService.confirmTicket(ticketId)
      await loadData()
    } catch (error) {
      console.error('Error confirming ticket:', error)
    } finally {
      setSavingStatus(prev => ({ ...prev, [`confirm-${ticketId}`]: false }))
    }
  }

  const handleMatchLocalChange = (matchId: string, field: keyof Match, value: any) => {
    setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, [field]: value } : m)))
  }

  const handleScoreUpdate = async (matchId: string, field: 'homeScore' | 'awayScore', value: number) => {
    const currentMatch = currentView === 'update-games' 
      ? updateGamesMatches.find(m => m.id === matchId)
      : matches.find(m => m.id === matchId)
    if (!currentMatch) return
    
    // Não permitir alterar placar se o jogo estiver agendado
    if (currentMatch.status === 'scheduled') {
      toast.error('O placar só pode ser atualizado quando o jogo está em andamento.')
      return
    }
    
    const score = value < 0 ? 0 : value
    
    // Update local state immediately - usar o estado correto baseado na view
    if (currentView === 'update-games') {
      setUpdateGamesMatches(prev => prev.map(m => (m.id === matchId ? { ...m, [field]: score } : m)))
    } else {
      handleMatchLocalChange(matchId, field, score)
    }

    setSavingScore(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = {
        homeScore: field === 'homeScore' ? score : currentMatch.homeScore,
        awayScore: field === 'awayScore' ? score : currentMatch.awayScore,
      }
      
      const updatedMatch = await matchService.updateMatch(matchId, payload)
      // Update local matches with updatedMatch (backend should return full object)
      if (currentView === 'update-games') {
        setUpdateGamesMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
      } else {
        setMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
      }
    } catch (error) {
      console.error('Error saving score:', error)
      toast.error('Erro ao salvar placar. Tente novamente.')
    } finally {
      setSavingScore(prev => ({ ...prev, [matchId]: false }))
    }
  }

  const handleStatusUpdate = async (matchId: string, newStatus: Match['status']) => {
    // Encontrar o jogo atual para verificar o status e placar
    const currentMatch = currentView === 'update-games' 
      ? updateGamesMatches.find(m => m.id === matchId)
      : matches.find(m => m.id === matchId)
    
    if (!currentMatch) return

    // Verificar se está mudando de "live" (em andamento) para "scheduled" (agendado) e se o placar não é 0x0
    if (currentMatch.status === 'live' && newStatus === 'scheduled') {
      const homeScore = currentMatch.homeScore ?? 0
      const awayScore = currentMatch.awayScore ?? 0
      
      if (homeScore !== 0 || awayScore !== 0) {
        const confirmed = await confirm.confirm({
          title: 'Zerar Placar',
          message: `O placar atual é ${homeScore} × ${awayScore}. Ao alterar o status de "Em Andamento" para "Agendado", o placar será zerado para 0 × 0. Deseja continuar?`,
          variant: 'warning',
          confirmText: 'Sim',
        })
        
        if (!confirmed) {
          return
        }
      }
    }

    // Update local state immediately - usar o estado correto baseado na view
    if (currentView === 'update-games') {
      setUpdateGamesMatches(prev => prev.map(m => (m.id === matchId ? { ...m, status: newStatus } : m)))
    } else {
      handleMatchLocalChange(matchId, 'status', newStatus)
    }

    setSavingStatus(prev => ({ ...prev, [matchId]: true }))
    try {
      const payload: Partial<Match> = { status: newStatus }
      
      // Se está mudando de "live" para "scheduled" e o placar não é 0x0, zerar o placar
      if (currentMatch.status === 'live' && newStatus === 'scheduled') {
        const homeScore = currentMatch.homeScore ?? 0
        const awayScore = currentMatch.awayScore ?? 0
        
        if (homeScore !== 0 || awayScore !== 0) {
          payload.homeScore = 0
          payload.awayScore = 0
        }
      }
      
      const updatedMatch = await matchService.updateMatch(matchId, payload)
      // Update local matches with updatedMatch (backend should return full object)
      if (currentView === 'update-games') {
        setUpdateGamesMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
      } else {
        setMatches(prev => prev.map(m => (m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m)))
      }
    } catch (error) {
      console.error('Error saving status:', error)
      toast.error('Erro ao salvar status. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, [matchId]: false }))
    }
  }
  
  const handleSaveWhatsAppNumber = async () => {
    if (!whatsAppNumber || whatsAppNumber.trim() === '') {
      toast.warning('Por favor, informe o número do WhatsApp')
      return
    }
    const trimmedNumber = whatsAppNumber.trim()
    
    try {
      await config.setAdminWhatsApp(trimmedNumber)
      // Verificar se foi salvo corretamente (buscar do backend)
      const saved = await config.getAdminWhatsApp()
      console.log('[Admin] WhatsApp salvo no backend:', trimmedNumber)
      console.log('[Admin] WhatsApp recuperado do backend:', saved)
      if (saved !== trimmedNumber) {
        console.error('[Admin] ERRO: WhatsApp não foi salvo corretamente!', { expected: trimmedNumber, got: saved })
        toast.error('Erro ao salvar WhatsApp. Verifique o console.')
        return
      }
      // Atualizar o estado para refletir a mudança imediatamente
      setWhatsAppNumber(trimmedNumber)
      toast.success('WhatsApp de confirmação atualizado com sucesso!')
    } catch (error) {
      console.error('[Admin] Erro ao salvar WhatsApp:', error)
      toast.error('Erro ao salvar WhatsApp. Tente novamente.')
    }
  }

  // Configurar sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Ativar após 8px de movimento (melhor para touch)
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Delay menor para resposta mais rápida no mobile
        tolerance: 5, // Tolerância menor para iniciar drag mais facilmente
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleAddGameTime = () => {
    if (!newGameTime || newGameTime.trim() === '') {
      toast.warning('Por favor, informe um horário')
      return
    }
    // Validar formato HH:MM
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(newGameTime)) {
      toast.warning('Formato inválido. Use HH:MM (ex: 16:00)')
      return
    }
    if (gameTimes.includes(newGameTime)) {
      toast.warning('Este horário já está na lista')
      return
    }
    const updatedTimes = [...gameTimes, newGameTime].sort()
    setGameTimes(updatedTimes)
    config.setGameTimes(updatedTimes)
    setNewGameTime('')
    toast.success('Horário adicionado com sucesso!')
  }

  const handleRemoveGameTime = (time: string) => {
    const updatedTimes = gameTimes.filter(t => t !== time)
    setGameTimes(updatedTimes)
    config.setGameTimes(updatedTimes)
    toast.success('Horário removido com sucesso!')
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      // TODO: Criar endpoint no backend GET /api/users
      const usersData = await apiService.get<User[]>('/users')
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Erro ao carregar usuários. Verifique se o endpoint está implementado no backend.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (userId: string, updates: Partial<User>, password?: string) => {
    setSavingStatus(prev => ({ ...prev, [`update-${userId}`]: true }))
    try {
      // Atualizar dados do usuário
      await apiService.put(`/users/${userId}`, updates)
      
      // Se houver senha preenchida, atualizar senha também
      if (password && password.length >= 6) {
        await apiService.put(`/users/${userId}/password`, { password })
      }
      
      await loadUsers()
      setEditingUser(null)
      setNewPassword('')
      
      // Avisar se alterou isAdmin - o usuário precisa fazer logout/login para o token JWT ser atualizado
      const message = password && password.length >= 6 
        ? 'Usuário e senha atualizados com sucesso!'
        : 'Usuário atualizado com sucesso!'
      
      if (updates.isAdmin !== undefined) {
        toast.success(`${message}\n\n⚠️ IMPORTANTE: Se alterou o status de administrador, o usuário precisa fazer logout e login novamente para que as mudanças tenham efeito.`, 6000)
      } else {
        toast.success(message)
      }
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast.error(error?.message || 'Erro ao atualizar usuário')
    } finally {
      setSavingStatus(prev => ({ ...prev, [`update-${userId}`]: false }))
    }
  }




  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirm.confirm({
      title: 'Excluir Usuário',
      message: `Tem certeza que deseja excluir o usuário "${user.name}" (${user.email})?\n\nEsta ação não pode ser desfeita.`,
      variant: 'destructive',
    })

    if (!confirmed) return

    setSavingStatus(prev => ({ ...prev, [`delete-${user.id}`]: true }))
    try {
      await apiService.delete(`/users/${user.id}`)
      await loadUsers()
      toast.success('Usuário excluído com sucesso!')
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error(error?.message || 'Erro ao excluir usuário')
    } finally {
      setSavingStatus(prev => ({ ...prev, [`delete-${user.id}`]: false }))
    }
  }

  const handleSaveRound = async (newMatches: Match[], round: number) => {
    try {
      await matchService.createRound(newMatches)
      // Atualizar a lista de rodadas para incluir a nova rodada criada
      await refreshRounds()
      if (setSelectedRound) {
        setSelectedRound(round)
      }
      setCurrentView('update-games')
      toast.success(`Rodada ${round} criada com sucesso!`)
    } catch (error: any) {
      console.error('Error creating round:', error)
      const errorMessage = error?.message || 'Erro ao criar rodada. Tente novamente.'
      toast.error(errorMessage)
    }
  }

  // Funções para a view update-games
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
      
      // Inicializar customTimeMatches
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
      
      setAllowsNewBets(allows)
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

  const handleMatchChange = (id: string, field: keyof Match, value: any) => {
    setUpdateGamesMatches(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)))
  }

  const handleToggleAllowsNewBets = async (newValue: boolean) => {
    if (!selectedRound) return
    
    if (newValue === true) {
      const hasStartedMatches = updateGamesMatches.some(m => m.status === 'live' || m.status === 'finished')
      if (hasStartedMatches) {
        toast.error('Não é possível permitir novos palpites quando houver jogos em andamento ou finalizados')
        return
      }
    }
    
    setSavingAllowsNewBets(true)
    try {
      await matchService.updateRoundAllowsNewBets(selectedRound, newValue)
      setAllowsNewBets(newValue)
    } catch (error) {
      console.error('Error updating allowsNewBets:', error)
      toast.error('Erro ao atualizar. Tente novamente.')
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
    } catch (error) {
      console.error('Error updating isActive:', error)
      toast.error('Erro ao atualizar. Tente novamente.')
      setIsActive(!newValue)
    } finally {
      setSavingIsActive(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = updateGamesMatches.findIndex((match) => match.id === active.id)
    const newIndex = updateGamesMatches.findIndex((match) => match.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      // Reordenar array localmente apenas (não salva automaticamente)
      const reorderedMatches = arrayMove(updateGamesMatches, oldIndex, newIndex)

      // Atualizar ordens sequenciais (1, 2, 3, ...)
      const updatedMatches = reorderedMatches.map((match, index) => ({
        ...match,
        order: index + 1
      }))

      setUpdateGamesMatches(updatedMatches)
    }
  }

  const saveNewOrder = async (matchesWithNewOrder: Match[]) => {
    if (!selectedRound) return

    setSavingOrder(true)
    try {
      const matchOrders = matchesWithNewOrder.map(match => ({
        matchId: match.id,
        order: match.order || 1
      }))

      await matchService.updateMatchOrder(selectedRound, matchOrders)

      toast.success('Ordem dos jogos atualizada com sucesso!')
    } catch (error) {
      console.error('Error saving order:', error)
      toast.error('Erro ao salvar ordem. Tente novamente.')
      // Recarregar dados em caso de erro
      if (selectedRound) {
        await loadUpdateGamesMatches(selectedRound)
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
    if (!selectedRound || !deleteTicketsPassword) return

    setDeletingTickets(true)
    try {
      await ticketService.deleteTicketsByRound(selectedRound, deleteTicketsPassword)
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
    if (!selectedRound || !deletePassword) return

    setDeletingRound(true)
    try {
      await matchService.deleteRound(selectedRound, deletePassword)
      setShowDeleteRoundModal(false)
      setDeletePassword('')
      // Atualizar a lista de rodadas do contexto
      await refreshRounds()
      setSelectedRound(undefined)
      toast.success('Rodada deletada com sucesso')
    } catch (error: any) {
      console.error('Error deleting round:', error)
      toast.error(error?.message || 'Erro ao deletar rodada. Verifique a senha e tente novamente.')
    } finally {
      setDeletingRound(false)
    }
  }

  const handleMatchClick = (matchId: string) => {
    setSelectedMatchId(matchId)
    setUpdateGamesView('edit')
  }

  const handleBackToList = () => {
    setUpdateGamesView('list')
    setSelectedMatchId(null)
  }

  const handleAddMatch = async () => {
    if (!selectedRound) return

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
        round: selectedRound,
        homeTeamLogo: getLogoPath(newMatch.homeTeam, selectedLeague),
        awayTeamLogo: getLogoPath(newMatch.awayTeam, selectedLeague),
      })

      // Recarregar matches
      await loadUpdateGamesMatches(selectedRound)
      
      // Limpar formulário
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


  const handleCancelTicket = async (ticketId: string) => {
    const confirmed = await confirm.confirm({
      title: 'Cancelar Palpite',
      message: 'Tem certeza que deseja cancelar este palpite? Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmText: 'Cancelar Palpite',
    })
    if (!confirmed) return
    
    setSavingStatus(prev => ({ ...prev, [`cancel-${ticketId}`]: true })) // Reusing savingStatus for ticket operations
    try {
      await ticketService.cancelTicket(ticketId)
      await loadData()
    } catch (error) {
      console.error('Error canceling ticket:', error)
      toast.error('Erro ao cancelar palpite. Tente novamente.')
    } finally {
      setSavingStatus(prev => ({ ...prev, [`cancel-${ticketId}`]: false }))
    }
  }

  // Menu Principal
  console.log('Admin component render:', { currentView, selectedRound, rounds })
  if (currentView === 'menu') {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Painel Administrativo</h1>
            <div className="w-40 h-10"></div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 * 0.05 }}
              whileTap={{ scale: 0.98 }} 
              onClick={() => setCurrentView('create-round')}
            >
              <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Plus className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1"><h3 className="font-semibold text-lg">Criar Nova Rodada</h3><p className="text-sm text-muted-foreground">Criar uma nova rodada com confrontos e horários</p></div>
                </div>
              </Card>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 * 0.05 }}
              whileTap={{ scale: 0.98 }} 
              onClick={() => setCurrentView('update-games')}
            >
              <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Trophy className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1"><h3 className="font-semibold text-lg">Gerenciar Rodadas</h3><p className="text-sm text-muted-foreground">Atualizar placares e status dos jogos</p></div>
                </div>
              </Card>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3 * 0.05 }}
              whileTap={{ scale: 0.98 }} 
              onClick={() => setCurrentView('manage-palpites')}
            >
              <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><CheckCircle className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1"><h3 className="font-semibold text-lg">Gerenciar Palpites</h3><p className="text-sm text-muted-foreground">Aprovar, cancelar e visualizar palpites</p></div>
                </div>
              </Card>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 4 * 0.05 }}
              whileTap={{ scale: 0.98 }} 
              onClick={() => setCurrentView('manage-users')}
            >
              <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Users className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1"><h3 className="font-semibold text-lg">Gerenciar Usuários</h3><p className="text-sm text-muted-foreground">Atualizar dados e permissões dos usuários</p></div>
                </div>
              </Card>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 5 * 0.05 }}
              whileTap={{ scale: 0.98 }} 
              onClick={() => setCurrentView('settings')}
            >
              <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Settings className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1"><h3 className="font-semibold text-lg">Configurações</h3><p className="text-sm text-muted-foreground">Configurar informações gerais do app</p></div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }
  
  // Configurações
  if (currentView === 'settings') {
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('menu')}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">Configurações</h2>
              <p className="text-sm text-muted-foreground">Gerencie as configurações do aplicativo</p>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="whatsapp-number">WhatsApp de Confirmação</label>
                  <div className='flex items-center gap-2'><Phone className="h-5 w-5 text-muted-foreground" /><Input id="whatsapp-number" type="text" value={whatsAppNumber} onChange={(e) => setWhatsAppNumber(e.target.value)} placeholder="Ex: 5511999999999" /></div>
                  <p className="text-xs text-muted-foreground mt-2">Número para onde serão enviadas as mensagens quando usuários solicitarem confirmação de palpites. Formato: código do país + DDD + número (sem espaços ou caracteres especiais).</p>
                </div>
                <Button onClick={handleSaveWhatsAppNumber} className="w-full"><Save className="mr-2 h-4 w-4" />Salvar</Button>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Horários Pré-definidos de Jogos</label>
                <p className="text-xs text-muted-foreground mb-3">Lista de horários comuns para facilitar o preenchimento ao criar ou editar rodadas. Estes horários aparecerão como opções nos formulários.</p>
                
                {/* Lista de horários */}
                <div className="space-y-2 mb-3">
                  {gameTimes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Nenhum horário cadastrado</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {gameTimes.map((time) => (
                        <div key={time} className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-secondary border border-border">
                          <span className="text-sm font-medium">{time}</span>
                          <button
                            onClick={() => handleRemoveGameTime(time)}
                            className="ml-1 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Remover horário"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Adicionar novo horário */}
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={newGameTime}
                    onChange={(e) => setNewGameTime(e.target.value)}
                    placeholder="Ex: 16:00"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddGameTime}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Adicione horários comuns para facilitar o preenchimento dos confrontos.</p>
              </div>
            </div>
          </Card>
          </motion.div>
        </div>
      </div>
    )
  }

  // Criar Rodada
  if (currentView === 'create-round') {
    return <CreateRound onSave={handleSaveRound} onCancel={() => setCurrentView('menu')} />
  }

  const renderAdminView = (title: string, subtitle: string, content: React.ReactNode, showRoundSelector: boolean = true, roundSelectorInLine: boolean = false) => (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
      <div className="w-full max-w-md space-y-6 p-4">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentView('menu')}
            className="rounded-full h-10 w-10 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold">{title}</h2>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>
              {showRoundSelector && roundSelectorInLine && (showRoundsLoading ? <Skeleton className="h-10 w-40 shrink-0" /> : <RoundSelector rounds={rounds} selectedRound={selectedRound} onRoundChange={setSelectedRound} onOpen={refreshRounds} />)}
            </div>
          </div>
        </div>
        {showRoundSelector && !roundSelectorInLine && (showRoundsLoading ? <Skeleton className="h-10 w-40" /> : <RoundSelector rounds={rounds} selectedRound={selectedRound} onRoundChange={setSelectedRound} onOpen={refreshRounds} />)}
        {showLoading ? <div className="space-y-4 pt-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}</div> : content}
      </div>
    </div>
  )

  // Gerenciar Rodadas (nova view consolidada)
  if (currentView === 'update-games') {
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

    // View de edição (separate_view)
    if (updateGamesView === 'edit' && selectedMatchId) {
      const currentMatch = updateGamesMatches.find(m => m.id === selectedMatchId)
      
      if (!currentMatch) {
        handleBackToList()
        return null
      }

      const predefinedTimes = config.getGameTimesSync().map(t => t.trim())
      const matchTime = currentMatch.time ? currentMatch.time.trim() : ''
      const timeWithoutSeconds = matchTime ? matchTime.split(':').slice(0, 2).join(':') : ''
      const isInPredefined = matchTime && (predefinedTimes.includes(matchTime) || predefinedTimes.includes(timeWithoutSeconds))
      const isCustom = customTimeMatches.has(currentMatch.id)
      const showTimeSelector = !matchTime || (isInPredefined && !isCustom)

      return (
        <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
          <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToList}
                className="rounded-full h-10 w-10 p-0 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold">Editar Jogo</h2>
                  {/* Switch "Incluído nos Palpites" alinhado à direita */}
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
            <div className="space-y-4 pt-4">
              {/* Card para Data/Hora e Confronto */}
              <Card className="p-4">
                {/* Data e Hora do jogo */}
                <div className="mb-4 pb-4 border-b border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative flex items-center h-10">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                      <Input
                        type="date"
                        value={currentMatch.date}
                        onChange={e => handleMatchChange(currentMatch.id, 'date', e.target.value)}
                        className="h-10 text-sm pl-9 pr-2 w-full"
                      />
                    </div>
                    <div className="relative flex items-center h-10">
                      <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
                      {showTimeSelector ? (
                        <select
                          value={currentMatch.time || ''}
                          onChange={(e) => {
                            const newTime = e.target.value
                            handleMatchChange(currentMatch.id, 'time', newTime)
                            setCustomTimeMatches(prev => {
                              const next = new Set(prev)
                              next.delete(currentMatch.id)
                              return next
                            })
                          }}
                          className="w-full h-10 text-sm pl-9 pr-2 rounded border border-border bg-background"
                        >
                          <option value="">Selecione</option>
                          {config.getGameTimesSync().map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type="time"
                          value={currentMatch.time}
                          onChange={e => handleMatchChange(currentMatch.id, 'time', e.target.value)}
                          className="h-10 text-sm pl-9 pr-2 w-full"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Confronto com placar - estilo Games.tsx */}
                <div className="mb-4 pb-4 border-b border-border/50">
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex items-center gap-2 w-full relative z-30 px-2">
                      <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-[40%]">
                        <span className="text-xs font-medium text-muted-foreground">Casa</span>
                        <TeamLogo teamName={currentMatch.homeTeam} logo={currentMatch.homeTeamLogo} size="xl" className="h-20 w-20" noCircle />
                        <span className="text-sm font-semibold text-center break-words leading-tight px-1">{getTeamDisplayName(currentMatch.homeTeam)}</span>
                      </div>
                      
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 px-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="text-4xl font-bold text-foreground w-12 text-center tabular-nums relative cursor-pointer hover:opacity-70 transition-opacity"
                            onClick={() => {
                              setShowScoreHint(prev => {
                                // Se já está ativo, para a animação
                                if (prev[currentMatch.id] === 'home') {
                                  const next = { ...prev }
                                  delete next[currentMatch.id]
                                  return next
                                }
                                // Caso contrário, inicia a animação
                                return { ...prev, [currentMatch.id]: 'home' }
                              })
                            }}
                          >
                            {currentMatch.homeScore ?? 0}
                          </div>
                          <span className="text-3xl font-bold text-muted-foreground">×</span>
                          <div 
                            className="text-4xl font-bold text-foreground w-12 text-center tabular-nums relative cursor-pointer hover:opacity-70 transition-opacity"
                            onClick={() => {
                              setShowScoreHint(prev => {
                                // Se já está ativo, para a animação
                                if (prev[currentMatch.id] === 'away') {
                                  const next = { ...prev }
                                  delete next[currentMatch.id]
                                  return next
                                }
                                // Caso contrário, inicia a animação
                                return { ...prev, [currentMatch.id]: 'away' }
                              })
                            }}
                          >
                            {currentMatch.awayScore ?? 0}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center gap-2 min-w-0 max-w-[40%]">
                        <span className="text-xs font-medium text-muted-foreground">Visitante</span>
                        <TeamLogo teamName={currentMatch.awayTeam} logo={currentMatch.awayTeamLogo} size="xl" className="h-20 w-20" noCircle />
                        <span className="text-sm font-semibold text-center break-words leading-tight px-1">{getTeamDisplayName(currentMatch.awayTeam)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status - Botões compactos */}
                <div>
                  <div className="text-xs font-semibold mb-1.5 text-muted-foreground">Status do Jogo</div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleStatusUpdate(currentMatch.id, 'scheduled')}
                      disabled={savingStatus[currentMatch.id]}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                        'border-2',
                        currentMatch.status === 'scheduled'
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                      )}
                    >
                      Agendado
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(currentMatch.id, 'live')}
                      disabled={savingStatus[currentMatch.id]}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                        'border-2',
                        currentMatch.status === 'live'
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                      )}
                    >
                      Em Andamento
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(currentMatch.id, 'finished')}
                      disabled={savingStatus[currentMatch.id]}
                      className={cn(
                        'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                        'border-2',
                        currentMatch.status === 'finished'
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                      )}
                    >
                      Finalizado
                    </button>
                  </div>
                </div>
              </Card>

              {/* Card de seleção de placar - isolado, estilo Games.tsx */}
              <Card className="p-0 relative overflow-hidden">
                <div className="px-4 pt-3 pb-2 border-b border-border/30">
                  <div className="flex items-center justify-center">
                    <span className="text-base font-semibold text-foreground">
                      Atualizar Placar
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 w-full p-4 overflow-x-auto" style={{ touchAction: 'none' }}>
                  {/* Controles Casa */}
                  <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground">Casa</span>
                    <div className="flex items-center gap-4 md:gap-6">
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
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Minus className="h-9 w-9" />
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
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Plus className="h-9 w-9" />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                  
                  {/* Separador visual vertical */}
                  <div className="h-24 w-px bg-border/60 flex-shrink-0" />

                  {/* Controles Visitante */}
                  <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
                    <span className="text-xs font-medium text-muted-foreground">Visitante</span>
                    <div className="flex items-center gap-4 md:gap-6">
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
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Minus className="h-9 w-9" />
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
                          className="h-20 w-20 rounded-full p-0 border-2 bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                        >
                          <Plus className="h-9 w-9" />
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Botão Excluir - isolado, sem card */}
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
      )
    }

    // View de lista (principal)
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentView('menu')}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold">Gerenciar Rodadas</h2>
                </div>
                {roundsSelectorLoading && !roundsSelectorInitialized ? (
                  <Skeleton className="h-10 w-40 shrink-0" />
                ) : (
                  <RoundSelector
                    rounds={allRoundsForSelector.length > 0 ? allRoundsForSelector : rounds}
                    selectedRound={selectedRound}
                    onRoundChange={setSelectedRound}
                    alwaysCallOnOpen={true}
                    onOpen={async () => {
                      // Carregar TODAS as rodadas (incluindo inativas) quando o usuário clicar no seletor
                      // Só mostrar loading na primeira vez (quando ainda não inicializou)
                      if (!roundsSelectorInitialized) {
                        setRoundsSelectorLoading(true)
                      }
                      try {
                        const roundsData = await matchService.getAllRounds()
                        const sortedRounds = [...roundsData].sort((a, b) => a - b)
                        // Atualizar o estado de forma síncrona para evitar flash
                        setAllRoundsForSelector(sortedRounds)
                        setRoundsSelectorInitialized(true)
                      } catch (error) {
                        console.error('Error loading all rounds:', error)
                      } finally {
                        setRoundsSelectorLoading(false)
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-4">

        {/* Switches de controle da rodada */}
        {selectedRound && (
          <>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Permitir Novos Palpites</h3>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const hasStartedMatches = updateGamesMatches.some(m => m.status === 'live' || m.status === 'finished')
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
                    disabled={savingAllowsNewBets || (updateGamesMatches.some(m => m.status === 'live' || m.status === 'finished') && !allowsNewBets)}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Rodada Ativa</h3>
                  <p className="text-xs text-muted-foreground">
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

            {/* Botão de reordenação */}
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
                        // Salvar ordem e sair do modo reordenação
                        saveNewOrder(updateGamesMatches).then(() => {
                          setIsReordering(false)
                          setReorderKey(prev => prev + 1) // Força re-renderização
                        })
                      } else {
                        // Entrar no modo reordenação
                        setIsReordering(true)
                        setReorderKey(prev => prev + 1) // Força re-renderização
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

        {/* Indicador visual do modo reordenação */}
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

        {/* Lista de jogos */}
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
            <DndContext
              key={`dnd-context-${reorderKey}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={updateGamesMatches.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
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
                        {/* Badge de status ou data/hora */}
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

                        {/* Separador vertical */}
                        <div className={cn(
                          "h-6 w-px flex-shrink-0",
                          displayInfo.isLive && "bg-yellow-400",
                          displayInfo.isFinished && "bg-green-400",
                          !displayInfo.isLive && !displayInfo.isFinished && "bg-border"
                        )} />

                        {/* Confronto compacto com placar */}
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

                        {/* Indicador de exclusão */}
                        {isExcluded && (
                          <XCircle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                        )}

                        {/* Ícone de status no canto direito */}
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

            {/* Botão Adicionar Confronto */}
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

        {/* Botões de ação destrutiva */}
        {selectedRound && (
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

        {/* Modais de confirmação */}
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

  // Gerenciar Rodadas (view antiga - manter por compatibilidade temporária)
  if (currentView === 'results') {
    return renderAdminView('Gerenciar Rodadas', '', (
      <div className="space-y-3 pt-4">
        {/* Mensagem quando não há rodadas ativas */}
        {!selectedRound && rounds.length === 0 && !roundsLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 text-center">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-2">
                Nenhuma rodada ativa no momento
              </p>
              <p className="text-xs text-muted-foreground">
                Não há rodadas disponíveis para atualização de jogos. Entre em contato com o administrador.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Lista de jogos - só mostrar se houver rodada selecionada */}
        {selectedRound && matches
          .filter(match => match.includeInRound !== false)
          .map((match, index) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
          <Card className="p-2">
            {/* Data e Hora do jogo */}
            <div className="mb-2 pb-2 border-b border-border/50 relative">
              <div className="flex items-center justify-center">
                <span className="text-sm font-semibold text-foreground">
                  {match.time
                    ? format(new Date(`${match.date}T${match.time}`), "EEE, dd/MM 'às' HH:mm", { locale: ptBR })
                    : format(new Date(match.date), "EEE, dd/MM", { locale: ptBR })
                  }
                </span>
              </div>
              {/* Loading no canto direito do header */}
              {(savingStatus[match.id] || savingScore[match.id]) && (
                <div className="absolute right-0 top-0">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
            </div>
            
            {/* Confronto com placar */}
            <div className="mb-2 pb-2 border-b border-border/50">
              <div className="flex items-center min-w-0">
                <div className="flex-1 flex justify-end pr-1.5 min-w-0">
                  <span className="text-sm font-semibold truncate text-right">{match.homeTeam}</span>
                </div>
                
                <div className="w-[80px] flex items-center gap-1 justify-center flex-shrink-0 px-1">
                  <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-5 w-5" noCircle />
                  <span 
                    className={cn(
                      "text-sm font-bold flex-shrink-0 min-w-[2rem] text-center cursor-pointer hover:opacity-70 transition-opacity",
                      (match.homeScore !== undefined && match.homeScore !== null) || (match.awayScore !== undefined && match.awayScore !== null)
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    )}
                    onClick={() => {
                      setShowScoreHint(prev => ({ ...prev, [match.id]: 'home' }))
                      setTimeout(() => {
                        setShowScoreHint(prev => {
                          const next = { ...prev }
                          delete next[match.id]
                          return next
                        })
                      }, 3000)
                    }}
                  >
                    {(match.homeScore !== undefined && match.homeScore !== null) && (match.awayScore !== undefined && match.awayScore !== null)
                      ? `${match.homeScore} × ${match.awayScore}`
                      : "0 × 0"}
                  </span>
                  <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-5 w-5" noCircle />
                </div>
                
                <div className="flex-1 flex justify-start pl-1.5 min-w-0">
                  <span className="text-sm font-semibold truncate text-left">{match.awayTeam}</span>
                </div>
              </div>
            </div>

            {/* Status - Botões com indicação visual de seleção */}
            <div className="mb-2">
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleStatusUpdate(match.id, 'scheduled')}
                  disabled={savingStatus[match.id]}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
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
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
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
                    'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all',
                    'border-2',
                    match.status === 'finished'
                      ? 'bg-primary text-primary-foreground border-primary font-semibold'
                      : 'bg-transparent border-border hover:border-primary/50 hover:bg-primary/10'
                  )}
                >
                  Finalizado
                </button>
              </div>
            </div>

            {/* Placar */}
            <div>
              {/* Texto informativo */}
              <div className="flex items-center justify-center mb-3">
                <span className="text-sm font-semibold text-foreground">Atualizar Placar</span>
              </div>
              
              <div className="flex items-center justify-center gap-3 relative">
                <div 
                  className="relative"
                  onClick={() => {
                    setShowScoreHint(prev => {
                      const next = { ...prev }
                      delete next[match.id]
                      return next
                    })
                  }}
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
                  <Stepper 
                    value={match.homeScore ?? 0} 
                    onChange={(value: number) => {
                      handleScoreUpdate(match.id, 'homeScore', value)
                      setShowScoreHint(prev => {
                        const next = { ...prev }
                        delete next[match.id]
                        return next
                      })
                    }}
                    disabled={savingScore[match.id]}
                    size="large"
                  />
                </div>
                <span className="font-bold text-muted-foreground text-2xl">×</span>
                <div 
                  className="relative"
                  onClick={() => {
                    setShowScoreHint(prev => {
                      const next = { ...prev }
                      delete next[match.id]
                      return next
                    })
                  }}
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
                  <Stepper 
                    value={match.awayScore ?? 0} 
                    onChange={(value: number) => {
                      handleScoreUpdate(match.id, 'awayScore', value)
                      setShowScoreHint(prev => {
                        const next = { ...prev }
                        delete next[match.id]
                        return next
                      })
                    }}
                    disabled={savingScore[match.id]}
                    size="large"
                  />
                </div>
              </div>
            </div>
          </Card>
          </motion.div>
        ))}

        {/* Mensagem quando não há jogos na rodada selecionada */}
        {selectedRound && !loading && matches.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 text-center">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum jogo encontrado para esta rodada
              </p>
            </Card>
          </motion.div>
        )}
      </div>
    ), true, true)
  }

  // Gerenciar Palpites
  if (currentView === 'manage-palpites') {
    // Filtrar tickets por rodada e status baseado na aba ativa
    const ticketsByRoundAndStatus = selectedRound 
      ? tickets.filter(t => t.status === palpitesTab && t.round === selectedRound)
      : [];
    
    // Filtrar por termo de busca (número do ticket, nome ou apelido) - ignorando acentuação
    const filteredTickets = searchTerm.trim() 
      ? ticketsByRoundAndStatus.filter(ticket => {
          const searchNormalized = normalizeText(searchTerm.trim())
          const ticketId = ticket.id.slice(-6).toLowerCase()
          const userName = normalizeText(ticket.userName || '')
          const userNickname = normalizeText((ticket as any).userNickname || (ticket as any).nickname || '')
          
          return ticketId.includes(searchNormalized) || 
                 userName.includes(searchNormalized) || 
                 userNickname.includes(searchNormalized)
        })
      : ticketsByRoundAndStatus;
    
    return renderAdminView('Gerenciar Palpites', '', (
      <div className="space-y-4 pt-4">
        {/* Mensagem quando não há rodadas ativas */}
        {!selectedRound && rounds.length === 0 && !roundsLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-6 text-center">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-2">
                Nenhuma rodada ativa no momento
              </p>
              <p className="text-xs text-muted-foreground">
                Não há rodadas disponíveis para gerenciamento de palpites. Entre em contato com o administrador.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Abas Pendentes/Aprovados - só mostrar se houver rodada selecionada */}
        {selectedRound && (
          <div className="flex gap-2">
            <Button
              variant={palpitesTab === 'pending' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setPalpitesTab('pending')
                setSearchTerm('')
              }}
              className="flex-1"
            >
              <Clock className="h-4 w-4 mr-1.5" />
              Pendentes
              <span className={`ml-2 text-xs bg-background/50 px-1.5 py-0.5 rounded min-w-[20px] text-center inline-block ${loading ? 'opacity-40' : ''}`}>
                {selectedRound ? tickets.filter(t => t.status === 'pending' && t.round === selectedRound).length : 0}
              </span>
            </Button>
            <Button
              variant={palpitesTab === 'confirmed' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setPalpitesTab('confirmed')
                setSearchTerm('')
              }}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Aprovados
              <span className={`ml-2 text-xs bg-background/50 px-1.5 py-0.5 rounded min-w-[20px] text-center inline-block ${loading ? 'opacity-40' : ''}`}>
                {selectedRound ? tickets.filter(t => t.status === 'confirmed' && t.round === selectedRound).length : 0}
              </span>
            </Button>
          </div>
        )}

        {/* Campo de busca - só mostrar se houver rodada selecionada */}
        {selectedRound && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, nome ou apelido..."
                className="pl-9"
              />
            </div>
          </motion.div>
        )}

        {/* Lista de palpites - só mostrar se houver rodada selecionada */}
        {selectedRound && filteredTickets.length === 0 && !loading ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <p className="text-muted-foreground text-center py-8">
                {searchTerm.trim() 
                  ? `Nenhum palpite encontrado para "${searchTerm}"`
                  : palpitesTab === 'pending'
                    ? 'Nenhum palpite pendente para esta rodada'
                    : 'Nenhum palpite aprovado para esta rodada'
                }
              </p>
            </Card>
          </motion.div>
        ) : selectedRound && filteredTickets.map((ticket: any, index: number) => {
          const ticketUser = ticket.userName || 'Usuário'
          const ticketNickname = (ticket as any).userNickname || (ticket as any).nickname
          const ticketCity = (ticket as any).userCity || (ticket as any).city
          
          return (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="cursor-pointer transition-colors hover:bg-secondary/30"
                onClick={() => navigate(`/tickets/${ticket.id}?from=admin&round=${selectedRound}`)}
              >
                {/* Resumo do ticket - sempre visível */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {ticket.status === 'pending' ? (
                      <Clock className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    ) : ticket.status === 'confirmed' ? (
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">#{ticket.id.slice(-6)}</span>
                        {ticket.status === 'pending' ? (
                          <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full text-xs font-medium">Pendente</span>
                        ) : ticket.status === 'confirmed' ? (
                          <span className="bg-primary/20 text-primary px-2 py-1 rounded-full text-xs font-medium">Aprovado</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{ticketUser}</span>
                        {ticketNickname && (
                          <span className="text-xs text-muted-foreground">({ticketNickname})</span>
                        )}
                        {ticketCity && (
                          <span className="text-xs text-muted-foreground">• {ticketCity}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground flex-shrink-0 ml-2">
                    {(() => {
                      try {
                        const date = new Date(ticket.createdAt);
                        return !isNaN(date.getTime())
                          ? format(date, "dd/MM HH:mm")
                          : "Data inválida";
                      } catch {
                        return "Data inválida";
                      }
                    })()}
                  </span>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
    ), true, true)
  }

  // Gerenciar Usuários
  if (currentView === 'manage-users') {
    // Se estiver editando, mostrar apenas o formulário de edição
    if (editingUser) {
      const user = editingUser
      return (
        <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
          <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingUser(null)
                  setOriginalUser(null)
                  setNewPassword('')
                }}
                className="rounded-full h-10 w-10 p-0 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold">Editar Usuário</h2>
                <p className="text-sm text-muted-foreground">{editingUser.name}</p>
              </div>
            </div>
            
            <div className="space-y-4 pt-4">
              <Card>
                <div className="space-y-4">
                  {/* Foto do usuário */}
                  <div className="flex justify-center pt-2">
                    {editingUser.avatar ? (
                      <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-primary shadow-sm" style={{ padding: '2px' }}>
                        <div className="h-full w-full rounded-full overflow-hidden border-2 border-background">
                          <img src={editingUser.avatar} alt={editingUser.name} className="h-full w-full object-cover rounded-full" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/20 border-2 border-primary/50 shadow-sm" style={{ padding: '2px' }}>
                        <div className="h-full w-full rounded-full border-2 border-background flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/20">
                          <span className="font-bold text-2xl text-primary">
                            {editingUser.name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || editingUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                <div>
                  <Input
                    placeholder="Nome"
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    disabled={savingStatus[`update-${user.id}`]}
                  />
                </div>
                
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    disabled={savingStatus[`update-${user.id}`]}
                  />
                </div>
                
                <div>
                  <Input
                    type="tel"
                    placeholder="Telefone (opcional)"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    disabled={savingStatus[`update-${user.id}`]}
                  />
                </div>
                
                <div>
                  <Input
                    type="text"
                    placeholder="Cidade (opcional)"
                    value={editingUser.city || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, city: e.target.value })}
                    disabled={savingStatus[`update-${user.id}`]}
                  />
                </div>
                
                <div>
                  <Input
                    type="text"
                    placeholder="Apelido (opcional)"
                    value={editingUser.nickname || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, nickname: e.target.value })}
                    disabled={savingStatus[`update-${user.id}`]}
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Administrador</span>
                  <Switch
                    checked={editingUser.isAdmin === true}
                    onCheckedChange={(checked) => setEditingUser({ ...editingUser, isAdmin: checked })}
                    disabled={savingStatus[`update-${user.id}`]}
                  />
                </div>

                {/* Campo Super Admin - apenas para super admins */}
                {currentUser?.superAdmin && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground text-red-600">Super Administrador</span>
                    <Switch
                      checked={editingUser.superAdmin === true}
                      onCheckedChange={(checked) => setEditingUser({ ...editingUser, superAdmin: checked })}
                      disabled={savingStatus[`update-${user.id}`]}
                    />
                  </div>
                )}
                
                <div className="pt-2 border-t border-border">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nova Senha (deixe em branco para não alterar)</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={savingStatus[`reset-password-${user.id}`]}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                
                <div className="pt-2">
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      onClick={() => {
                        const updates: Partial<User> = {
                          name: editingUser.name,
                          email: editingUser.email,
                          phone: editingUser.phone || undefined,
                          city: editingUser.city || undefined,
                          nickname: editingUser.nickname || undefined
                        }

                        // Só enviar isAdmin se foi alterado
                        if (originalUser && editingUser.isAdmin !== originalUser.isAdmin) {
                          updates.isAdmin = Boolean(editingUser.isAdmin)
                        }

                        // Só enviar superAdmin se foi alterado (apenas para super admins)
                        if (originalUser && editingUser.superAdmin !== originalUser.superAdmin && currentUser?.superAdmin) {
                          updates.superAdmin = Boolean(editingUser.superAdmin)
                        }

                        // Validar senha se preenchida
                        if (newPassword && newPassword.length > 0 && newPassword.length < 6) {
                          toast.warning('A senha deve ter no mínimo 6 caracteres')
                          return
                        }

                        handleUpdateUser(user.id, updates, newPassword || undefined)
                      }}
                      disabled={savingStatus[`update-${user.id}`]}
                      className="flex-1"
                    >
                      {savingStatus[`update-${user.id}`]
                        ? 'Salvando...'
                        : 'Salvar'
                      }
                    </Button>

                    {/* Botão de excluir usuário */}
                    {userId && user.id !== userId && !user.superAdmin && (
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteUser(user)}
                        disabled={savingStatus[`delete-${user.id}`]}
                        className="flex-1"
                      >
                        {savingStatus[`delete-${user.id}`] ? 'Excluindo...' : 'Excluir'}
                      </Button>
                    )}
                  </div>
                </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )
    }
    
    // Lista de usuários
    return renderAdminView('Gerenciar Usuários', 'Atualizar dados e permissões dos usuários', (
      <div className="space-y-4 pt-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <p className="text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>
            </Card>
          </motion.div>
        ) : (
          users.map((user, index) => {
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className="cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => {
                    setEditingUser({ ...user })
                    setOriginalUser({ ...user })
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary shadow-sm overflow-hidden">
                            <img src={user.avatar} alt={user.name} className="h-full w-full object-cover rounded-full" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/20 border-2 border-primary/50 shadow-sm">
                            <span className="font-bold text-sm text-primary">{user.name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || user.name.charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {user.superAdmin && (
                          <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-600 text-xs font-medium">
                            Super Admin
                          </span>
                        )}
                        {user.isAdmin && !user.superAdmin && (
                          <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>
    ), false)
  }

  return null
}