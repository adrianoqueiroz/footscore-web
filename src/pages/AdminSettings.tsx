import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Phone, ArrowLeft, Save, Plus, X, Bell } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { config } from '@/config'
import { useToastContext } from '@/contexts/ToastContext'
import { configService } from '@/services/config.service'

export default function AdminSettings() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [gameTimes, setGameTimes] = useState<string[]>([])
  const [newGameTime, setNewGameTime] = useState('')
  const [rankingTopN, setRankingTopN] = useState(3)

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
  }, [])

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
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin')}
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
      </div>
    </div>
  )
}
