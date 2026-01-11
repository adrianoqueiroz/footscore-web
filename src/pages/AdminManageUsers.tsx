import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Users } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Skeleton from '@/components/ui/Skeleton'
import Switch from '@/components/ui/Switch'
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

  useEffect(() => {
    loadUsers()
  }, [])

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

  const filteredUsers = searchTerm.trim() 
    ? users.filter(user => {
        const searchLower = searchTerm.toLowerCase()
        return (
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          (user.phone && user.phone.includes(searchTerm)) ||
          (user.nickname && user.nickname.toLowerCase().includes(searchLower))
        )
      })
    : users

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
                          const updates: Partial<User> = {
                            name: editingUser.name,
                            email: editingUser.email,
                            phone: editingUser.phone || undefined,
                            city: editingUser.city || undefined,
                            nickname: editingUser.nickname || undefined
                          }

                          if (originalUser && editingUser.isAdmin !== originalUser.isAdmin) {
                            updates.isAdmin = Boolean(editingUser.isAdmin)
                          }

                          if (originalUser && editingUser.superAdmin !== originalUser.superAdmin && currentUser?.superAdmin) {
                            updates.superAdmin = Boolean(editingUser.superAdmin)
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
            <h2 className="text-2xl font-bold">Gerenciar Usuários</h2>
            <p className="text-sm text-muted-foreground">Atualizar dados e permissões dos usuários</p>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="relative">
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar usuários por nome, email ou telefone..."
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
                          {user.avatar ? (
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary shadow-sm overflow-hidden">
                              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover rounded-full" />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/20 border-2 border-primary/50 shadow-sm">
                              <span className="font-bold text-sm text-primary">
                                {user.name.split(' ').slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || user.name.charAt(0).toUpperCase()}
                              </span>
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
      </div>
    </div>
  )
}
