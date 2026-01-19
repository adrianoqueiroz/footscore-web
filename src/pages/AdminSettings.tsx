import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Phone, ArrowLeft, Save, Plus, X, Bell, Users, CheckCircle2, XCircle } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import PageHeader from '@/components/ui/PageHeader'
import { config } from '@/config'
import { useToastContext } from '@/contexts/ToastContext'
import { configService } from '@/services/config.service'
import { apiService } from '@/services/api.service'
import { User } from '@/types'
import UserAvatar from '@/components/ui/UserAvatar'

export default function AdminSettings() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [gameTimes, setGameTimes] = useState<string[]>([])
  const [newGameTime, setNewGameTime] = useState('')
  const [rankingTopN, setRankingTopN] = useState(3)
  const [notificationTestMode, setNotificationTestMode] = useState(false)
  const [notificationTestUsers, setNotificationTestUsers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchUserTerm, setSearchUserTerm] = useState('')

  useEffect(() => {
    config.getAdminWhatsApp().then(value => {
      setWhatsAppNumber(value)
    }).catch(() => {
      setWhatsAppNumber(config.getAdminWhatsAppSync())
    })
    
    config.getGameTimes().then(times => {
      setGameTimes(times)
    }).catch(() => {
      setGameTimes(config.getGameTimesSync())
    })

    configService.getRankingNotificationTopN().then(value => {
      setRankingTopN(value)
    }).catch(() => {
      setRankingTopN(3)
    })

    configService.getNotificationTestMode().then(enabled => {
      setNotificationTestMode(enabled)
    }).catch(() => {
      setNotificationTestMode(false)
    })

    configService.getNotificationTestUsers().then(userIds => {
      setNotificationTestUsers(userIds)
    }).catch(() => {
      setNotificationTestUsers([])
    })

    loadAllUsers()
  }, [])

  const loadAllUsers = async () => {
    setLoadingUsers(true)
    try {
      const users = await apiService.get<User[]>('/users')
      setAllUsers(users)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleToggleNotificationTestMode = async (enabled: boolean) => {
    try {
      await configService.setNotificationTestMode(enabled)
      setNotificationTestMode(enabled)
      toast.success(enabled ? 'Modo de teste de notificações ativado' : 'Modo de teste de notificações desativado')
    } catch (error: any) {
      console.error('Error setting notification test mode:', error)
      toast.error(error?.message || 'Erro ao atualizar modo de teste')
    }
  }

  const handleToggleTestUser = async (userId: string) => {
    const isSelected = notificationTestUsers.includes(userId)
    const newList = isSelected
      ? notificationTestUsers.filter(id => id !== userId)
      : [...notificationTestUsers, userId]

    try {
      await configService.setNotificationTestUsers(newList)
      setNotificationTestUsers(newList)
      toast.success(isSelected ? 'Usuário removido da lista de teste' : 'Usuário adicionado à lista de teste')
    } catch (error: any) {
      console.error('Error updating test users:', error)
      toast.error(error?.message || 'Erro ao atualizar lista de usuários')
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
      const saved = await config.getAdminWhatsApp()
      if (saved !== trimmedNumber) {
        console.error('[Admin] ERRO: WhatsApp não foi salvo corretamente!', { expected: trimmedNumber, got: saved })
        toast.error('Erro ao salvar WhatsApp. Verifique o console.')
        return
      }
      setWhatsAppNumber(trimmedNumber)
      toast.success('WhatsApp de confirmação atualizado com sucesso!')
    } catch (error) {
      console.error('[Admin] Erro ao salvar WhatsApp:', error)
      toast.error('Erro ao salvar WhatsApp. Tente novamente.')
    }
  }

  const handleAddGameTime = () => {
    if (!newGameTime || newGameTime.trim() === '') {
      toast.warning('Por favor, informe um horário')
      return
    }
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

  const handleSaveRankingTopN = async () => {
    if (rankingTopN < 1 || rankingTopN > 100) {
      toast.warning('O valor deve estar entre 1 e 100')
      return
    }
    
    try {
      await configService.setRankingNotificationTopN(rankingTopN)
      toast.success('Configuração de notificações de ranking atualizada com sucesso!')
    } catch (error) {
      console.error('[Admin] Erro ao salvar top N:', error)
      toast.error('Erro ao salvar configuração. Tente novamente.')
    }
  }

  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader
          title="Configurações"
          description="Gerencie as configurações do aplicativo"
          backPath="/admin"
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="whatsapp-number">WhatsApp de Confirmação</label>
                <div className='flex items-center gap-2'>
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <Input 
                    id="whatsapp-number" 
                    type="text" 
                    value={whatsAppNumber} 
                    onChange={(e) => setWhatsAppNumber(e.target.value)} 
                    placeholder="Ex: 5511999999999" 
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Número para onde serão enviadas as mensagens quando usuários solicitarem confirmação de palpites. 
                  Formato: código do país + DDD + número (sem espaços ou caracteres especiais).
                </p>
              </div>
              <Button onClick={handleSaveWhatsAppNumber} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
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
                <p className="text-xs text-muted-foreground mb-3">
                  Lista de horários comuns para facilitar o preenchimento ao criar ou editar rodadas. 
                  Estes horários aparecerão como opções nos formulários.
                </p>
                
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
                <p className="text-xs text-muted-foreground mt-2">
                  Adicione horários comuns para facilitar o preenchimento dos confrontos.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" htmlFor="ranking-top-n">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Top N para Notificações de Ranking
                  </div>
                </label>
                <Input 
                  id="ranking-top-n" 
                  type="number" 
                  min="1"
                  max="100"
                  value={rankingTopN} 
                  onChange={(e) => setRankingTopN(parseInt(e.target.value) || 3)} 
                  placeholder="Ex: 3" 
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Define quantas posições no topo do ranking devem gerar notificações. 
                  Usuários serão notificados quando seus tickets entrarem entre os top N colocados. 
                  Valor padrão: 3 (top 3).
                </p>
              </div>
              <Button onClick={handleSaveRankingTopN} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Configuração de Notificações de Teste */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Modo de Teste de Notificações</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativado, apenas os usuários selecionados receberão notificações push. 
                Útil para testes sem notificar todos os usuários.
              </p>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-sm font-medium">Ativar Modo de Teste</p>
                  <p className="text-xs text-muted-foreground">
                    {notificationTestMode 
                      ? `${notificationTestUsers.length} usuário(s) selecionado(s)`
                      : 'Todas as notificações serão enviadas normalmente'
                    }
                  </p>
                </div>
                <Switch
                  checked={notificationTestMode}
                  onCheckedChange={handleToggleNotificationTestMode}
                />
              </div>

              {notificationTestMode && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Selecionar Usuários para Teste</label>
                    <div className="relative mb-3">
                      <Input
                        type="text"
                        value={searchUserTerm}
                        onChange={(e) => setSearchUserTerm(e.target.value)}
                        placeholder="Buscar usuário por nome ou email..."
                        className="pl-9"
                      />
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {loadingUsers ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Carregando usuários...</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {allUsers
                        .filter(user => {
                          if (!searchUserTerm.trim()) return true
                          const search = searchUserTerm.toLowerCase()
                          return user.name.toLowerCase().includes(search) ||
                                 user.email.toLowerCase().includes(search)
                        })
                        .map(user => {
                          const isSelected = notificationTestUsers.includes(user.id)
                          return (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                              onClick={() => handleToggleTestUser(user.id)}
                            >
                              <UserAvatar user={user} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                              {isSelected ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              )}
                            </motion.div>
                          )
                        })}
                      {allUsers.filter(user => {
                        if (!searchUserTerm.trim()) return true
                        const search = searchUserTerm.toLowerCase()
                        return user.name.toLowerCase().includes(search) ||
                               user.email.toLowerCase().includes(search)
                      }).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum usuário encontrado
                        </p>
                      )}
                    </div>
                  )}

                  {notificationTestUsers.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">
                        {notificationTestUsers.length} usuário(s) selecionado(s) para receber notificações durante os testes
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
