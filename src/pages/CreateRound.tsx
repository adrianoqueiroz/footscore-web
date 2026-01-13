import { useState } from 'react'
import { Plus, Calendar, Clock, XCircle, Loader2, Trash2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import TeamLogo from '@/components/ui/TeamLogo'
import { Match } from '@/types'
import { useToastContext } from '@/contexts/ToastContext'
import { config } from '@/config'

interface CreateRoundProps {
  onSave: (matches: Match[], round: number) => void
  onCancel: () => void
}

// Times da Série A (2024)
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

export default function CreateRound({ onSave, onCancel }: CreateRoundProps) {
  const [round, setRound] = useState('1')
  const [matches, setMatches] = useState<Omit<Match, 'id' | 'round'>[]>([])
  const [selectedLeague, setSelectedLeague] = useState<'serie-a' | 'serie-b'>('serie-a')
  const [showAddMatch, setShowAddMatch] = useState(false)
  const [newMatch, setNewMatch] = useState({
    homeTeam: '',
    awayTeam: '',
    date: '',
    time: '',
  })
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [addingMatch, setAddingMatch] = useState(false)
  const toast = useToastContext()

  const handleRoundChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Permitir campo vazio temporariamente e apenas números
    if (value === '' || /^\d+$/.test(value)) {
      setRound(value)
    }
  }

  const getRoundNumber = (): number => {
    const num = parseInt(round, 10)
    return isNaN(num) || num < 1 ? 1 : num
  }

  const availableTeams = selectedLeague === 'serie-a' ? SERIE_A_TEAMS : SERIE_B_TEAMS

  const handleAddMatch = () => {
    if (!newMatch.homeTeam || !newMatch.awayTeam || !newMatch.date || !newMatch.time) {
      toast.warning('Preencha todos os campos do confronto')
      return
    }

    if (newMatch.homeTeam === newMatch.awayTeam) {
      toast.warning('Os times não podem ser iguais')
      return
    }

    setAddingMatch(true)
    
    const getLogoPath = (teamName: string) => {
      const normalized = teamName.toLowerCase()
        .replace(/\s+/g, '-')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '')
      return `/assets/teams/${selectedLeague}/${normalized}.svg`
    }

    setMatches([...matches, {
      ...newMatch,
      homeTeamLogo: getLogoPath(newMatch.homeTeam),
      awayTeamLogo: getLogoPath(newMatch.awayTeam),
      status: 'scheduled',
    }])

    setNewMatch({ homeTeam: '', awayTeam: '', date: '', time: '' })
    setShowAddMatch(false)
    setShowCustomTime(false)
    setAddingMatch(false)
  }

  const handleRemoveMatch = (index: number) => {
    setMatches(matches.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    if (matches.length === 0) {
      toast.warning('Adicione pelo menos um confronto')
      return
    }

    const roundNumber = getRoundNumber()
    if (roundNumber < 1) {
      toast.warning('O número da rodada deve ser maior que zero')
      return
    }

    const matchesWithIds: Match[] = matches.map((match, index) => ({
      ...match,
      id: Date.now().toString() + index,
      round: roundNumber,
    }))

    onSave(matchesWithIds, roundNumber)
  }

  return (
    <div className="flex justify-center min-h-screen bg-background/95 bg-grid-small-white/[0.07]">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8 pb-24">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-6">Criar Nova Rodada</h2>
          
          <div className="space-y-4">
            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Número da Rodada</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={round}
                    onChange={handleRoundChange}
                    placeholder="Ex: 1"
                    className="w-full"
                    minLength={1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Digite o número da rodada (ex: 1, 2, 3...)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Campeonato</label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedLeague === 'serie-a' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedLeague('serie-a')}
                      className="flex-1"
                    >
                      Série A
                    </Button>
                    <Button
                      variant={selectedLeague === 'serie-b' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedLeague('serie-b')}
                      className="flex-1"
                    >
                      Série B
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Lista de Confrontos */}
        {matches.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Confrontos da Rodada</h3>
            </div>

            <div className="space-y-3">
              {matches.map((match, index) => (
                <Card key={index} className="p-3 bg-secondary/30 border border-border/50">
                  {/* Linha 1: Times - apenas visualização */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 flex items-center min-w-0">
                      {/* Nome time 1 */}
                      <div className="flex-1 flex justify-end pr-2 min-w-0">
                        <span className="text-xs font-semibold truncate text-foreground text-right">{match.homeTeam}</span>
                      </div>
                      
                      {/* Escudos alinhados fixamente no centro */}
                      <div className="w-[88px] flex items-center gap-1 justify-center flex-shrink-0">
                        <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" />
                        <span className="text-xs text-muted-foreground/60 flex-shrink-0 font-medium">×</span>
                        <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" />
                      </div>
                      
                      {/* Nome time 2 */}
                      <div className="flex-1 flex justify-start pl-2 min-w-0">
                        <span className="text-xs font-semibold truncate text-foreground text-left">{match.awayTeam}</span>
                      </div>
                    </div>
                  </div>

                  {/* Linha 2: Data e Hora */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
                      <div className="text-xs text-muted-foreground pl-9">
                        {match.date ? new Date(match.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '--/--'}
                      </div>
                    </div>
                    <div className="relative flex items-center">
                      <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
                      <div className="text-xs text-foreground pl-9">
                        {match.time || '??:??'}
                      </div>
                    </div>
                  </div>

                  {/* Linha 3: Botão Remover */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center justify-center gap-1.5 h-8 text-xs text-red-500 hover:text-red-600 hover:border-red-500 w-full"
                    onClick={() => handleRemoveMatch(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                </Card>
              ))}
            </div>

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
                            onChange={e => {
                              if (e.target.value === '__custom__') {
                                setShowCustomTime(true)
                                setNewMatch({ ...newMatch, time: '' })
                              } else {
                                setNewMatch({ ...newMatch, time: e.target.value })
                              }
                            }}
                            className="w-full h-8 text-xs px-2 rounded border border-border bg-background"
                            style={{ height: '32px', lineHeight: '32px', paddingTop: '0', paddingBottom: '0', boxSizing: 'border-box' }}
                          >
                            <option value="">Selecione</option>
                            {config.getGameTimesSync().map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                            <option value="__custom__">Outro horário...</option>
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
        )}

        {/* Adicionar Confronto (quando não há confrontos ainda) */}
        {matches.length === 0 && !showAddMatch && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddMatch(true)}
            className="w-full flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        )}

        {matches.length === 0 && showAddMatch && (
          <Card className="p-3 bg-secondary/50 border-2 border-dashed border-primary/30">
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
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setShowCustomTime(true)
                            setNewMatch({ ...newMatch, time: '' })
                          } else {
                            setNewMatch({ ...newMatch, time: e.target.value })
                          }
                        }}
                        className="w-full h-8 text-xs px-2 rounded border border-border bg-background"
                        style={{ height: '32px', lineHeight: '32px', paddingTop: '0', paddingBottom: '0', boxSizing: 'border-box' }}
                      >
                        <option value="">Selecione</option>
                        {config.getGameTimesSync().map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                        <option value="__custom__">Outro horário...</option>
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

        {/* Botões de Ação */}
        <div className="flex gap-3 sticky bottom-4 z-10 bg-background/95 backdrop-blur-sm pt-4 pb-2">
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSave}
            disabled={matches.length === 0 || !round || round === ''}
            className="flex-1"
          >
            Salvar Rodada
          </Button>
        </div>
      </div>
    </div>
  )
}

