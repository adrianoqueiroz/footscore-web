import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
import PageHeader from '@/components/ui/PageHeader'
import UserAvatar from '@/components/ui/UserAvatar'
import { apiService } from '@/services/api.service'
import { authService } from '@/services/auth.service'
import { User } from '@/types'
import { useToastContext } from '@/contexts/ToastContext'
import { useConfirmContext } from '@/contexts/ConfirmContext'

export default function AdminManageUsers() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const confirm = useConfirmContext()
  const currentUser = authService.getCurrentUser()
  const userId = currentUser?.id

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [originalUser, setOriginalUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({})
  const [editingCity, setEditingCity] = useState('')
  const [editingLocation, setEditingLocation] = useState('')
  const [showOtherLocation, setShowOtherLocation] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  // Função para separar cidade e localidade do formato "Cidade - Localidade"
  const parseCityAndLocation = (cityString: string) => {
    if (!cityString) return { city: '', location: '' }
    
    const parts = cityString.split(' - ')
    if (parts.length === 2) {
      return { city: parts[0].trim(), location: parts[1].trim() }
    }
    // Se não tiver o formato esperado, assume que é só a cidade
    return { city: cityString.trim(), location: '' }
  }

  // Separar cidade e localidade quando começar a editar
  useEffect(() => {
    if (editingUser) {
      const { city: parsedCity, location: parsedLocation } = parseCityAndLocation(editingUser.city || '')
      setEditingCity(parsedCity)
      
      // Verificar se a localidade é "Sede" ou outra
      if (parsedLocation.toLowerCase() === 'sede') {
        setEditingLocation('Sede')
        setShowOtherLocation(false)
      } else if (parsedLocation) {
        setEditingLocation(parsedLocation)
        setShowOtherLocation(true)
      } else {
        setEditingLocation('')
        setShowOtherLocation(false)
      }
    } else {
      setEditingCity('')
      setEditingLocation('')
      setShowOtherLocation(false)
    }
  }, [editingUser])

  const handleLocationSelect = (value: string) => {
    if (value === 'Sede') {
      setEditingLocation('Sede')
      setShowOtherLocation(false)
    } else {
      // "Outra" foi selecionada
      setEditingLocation('')
      setShowOtherLocation(true)
      // Focar no input após um pequeno delay
      setTimeout(() => {
        const input = document.getElementById('admin-location-input')
        input?.focus()
      }, 100)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
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
      await apiService.put(`/users/${userId}`, updates)
      
      if (password && password.length >= 6) {
        await apiService.put(`/users/${userId}/password`, { password })
      }
      
      await loadUsers()
      setEditingUser(null)
      setNewPassword('')
      
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

  // Ordenar usuários alfabeticamente por nome
  const sortedUsers = [...users].sort((a, b) => {
    const nameA = a.name.toLowerCase().trim()
    const nameB = b.name.toLowerCase().trim()
    return nameA.localeCompare(nameB, 'pt-BR')
  })

  const filteredUsers = searchTerm.trim() 
    ? sortedUsers.filter(user => {
        const searchLower = searchTerm.toLowerCase()
        return (
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
        )
      })
    : sortedUsers

  // Se estiver editando, mostrar apenas o formulário de edição
  if (editingUser) {
    const user = editingUser
    return (
      <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
          <PageHeader
            title="Editar Usuário"
            description={editingUser.name}
            onBack={() => {
              setEditingUser(null)
              setOriginalUser(null)
              setNewPassword('')
              setEditingCity('')
              setEditingLocation('')
              setShowOtherLocation(false)
            }}
          />
          
          <div className="space-y-4 pt-4">
            <Card>
              <div className="space-y-4">
                <div className="flex justify-center pt-2">
                  <UserAvatar user={editingUser} size="xl" />
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
                    <label className="block text-sm font-medium mb-2 text-left">
                      Cidade
                    </label>
                    <Input
                      type="text"
                      placeholder="Ex: Brotas de Macaubas"
                      value={editingCity}
                      onChange={(e) => setEditingCity(e.target.value)}
                      disabled={savingStatus[`update-${user.id}`]}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-left">
                      Localidade
                    </label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={editingLocation === 'Sede' ? 'primary' : 'outline'}
                          onClick={() => handleLocationSelect('Sede')}
                          className="w-full"
                          disabled={savingStatus[`update-${user.id}`]}
                        >
                          Sede
                        </Button>
                        <Button
                          type="button"
                          variant={showOtherLocation ? 'primary' : 'outline'}
                          onClick={() => handleLocationSelect('Outra')}
                          className="w-full"
                          disabled={savingStatus[`update-${user.id}`]}
                        >
                          Outra
                        </Button>
                      </div>
                      {showOtherLocation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full mt-3"
                        >
                          <Input
                            id="admin-location-input"
                            type="text"
                            placeholder="Digite o distrito ou localidade"
                            value={editingLocation}
                            onChange={(e) => setEditingLocation(e.target.value)}
                            className="w-full"
                            disabled={savingStatus[`update-${user.id}`]}
                            minLength={2}
                          />
                        </motion.div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-left">
                      Selecione "Sede" ou informe outra localidade do município
                    </p>
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
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Precisa fazer onboarding</span>
                    <Switch
                      checked={editingUser.needsOnboarding === true}
                      onCheckedChange={(checked) => setEditingUser({ ...editingUser, needsOnboarding: checked })}
                      disabled={savingStatus[`update-${user.id}`]}
                    />
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Nova Senha (deixe em branco para não alterar)
                    </label>
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
                          // Combinar cidade e localidade no formato "Cidade - Localidade"
                          let cityWithLocation: string | undefined
                          if (editingCity.trim()) {
                            if (editingLocation.trim().toLowerCase() === 'sede') {
                              cityWithLocation = `${editingCity.trim()} - Sede`
                            } else if (editingLocation.trim()) {
                              cityWithLocation = `${editingCity.trim()} - ${editingLocation.trim()}`
                            } else {
                              cityWithLocation = editingCity.trim()
                            }
                          }

                          const updates: Partial<User> = {
                            name: editingUser.name,
                            email: editingUser.email,
                            phone: editingUser.phone || undefined,
                            city: cityWithLocation || undefined,
                            nickname: editingUser.nickname || undefined
                          }

                          if (originalUser && editingUser.isAdmin !== originalUser.isAdmin) {
                            updates.isAdmin = Boolean(editingUser.isAdmin)
                          }

                          if (originalUser && editingUser.superAdmin !== originalUser.superAdmin && currentUser?.superAdmin) {
                            updates.superAdmin = Boolean(editingUser.superAdmin)
                          }

                          if (originalUser && editingUser.needsOnboarding !== originalUser.needsOnboarding) {
                            updates.needsOnboarding = Boolean(editingUser.needsOnboarding)
                          }

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
  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0 overflow-x-hidden">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-6 p-4 md:p-6 lg:p-8">
        <PageHeader
          title="Gerenciar Usuários"
          description="Atualizar dados e permissões dos usuários"
          backPath="/admin"
        />

        <div className="space-y-4 pt-4">
          <div className="relative">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="pl-9"
            />
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <p className="text-muted-foreground text-center py-8">
                  {searchTerm.trim() 
                    ? `Nenhum usuário encontrado para "${searchTerm}"`
                    : 'Nenhum usuário encontrado'
                  }
                </p>
              </Card>
            </motion.div>
          ) : (
            filteredUsers.map((user, index) => {
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
                          <UserAvatar user={user} size="sm" />
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
      </div>
    </div>
  )
}
