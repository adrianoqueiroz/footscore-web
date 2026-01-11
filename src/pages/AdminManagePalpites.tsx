import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, CheckCircle, ArrowLeft, Info, Search } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import RoundSelector from '@/components/ui/RoundSelector'
import Skeleton from '@/components/ui/Skeleton'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { useDelayedLoading } from '@/hooks/useDelayedLoading'
import { ticketService } from '@/services/ticket.service'
import { Ticket } from '@/types'
import { format } from 'date-fns'

const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function AdminManagePalpites() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { rounds, selectedRound, setSelectedRound, loading: roundsLoading } = useRoundSelector()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [palpitesTab, setPalpitesTab] = useState<'pending' | 'confirmed'>('pending')
  const showRoundsLoading = useDelayedLoading(roundsLoading)
  const showLoading = useDelayedLoading(loading)

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

  useEffect(() => {
    if (selectedRound) {
      loadData()
      setSearchTerm('')
      setPalpitesTab('pending')
    } else {
      setTickets([])
      setLoading(false)
      setSearchTerm('')
      setPalpitesTab('pending')
    }
  }, [selectedRound])

  const loadData = async () => {
    if (!selectedRound) return
    setLoading(true)
    try {
      const ticketsData = await ticketService.getAllTickets()
      setTickets(ticketsData)
    } catch (error) {
      console.error('Error loading admin data:', error)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const ticketsByRoundAndStatus = selectedRound 
    ? tickets.filter(t => t.status === palpitesTab && t.round === selectedRound)
    : []
  
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
    : ticketsByRoundAndStatus

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
                <h2 className="text-2xl font-bold">Gerenciar Palpites</h2>
                <p className="text-sm text-muted-foreground">Aprovar, cancelar e visualizar palpites</p>
              </div>
              {showRoundsLoading ? (
                <Skeleton className="h-10 w-40 shrink-0" />
              ) : (
                <RoundSelector 
                  rounds={rounds} 
                  selectedRound={selectedRound} 
                  onRoundChange={setSelectedRound}
                />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
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
                          const date = new Date(ticket.createdAt)
                          return !isNaN(date.getTime())
                            ? format(date, "dd/MM HH:mm")
                            : "Data inválida"
                        } catch {
                          return "Data inválida"
                        }
                      })()}
                    </span>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
