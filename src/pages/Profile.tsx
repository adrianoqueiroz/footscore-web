import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, User, Mail, Phone, MapPin, UserCircle, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { authService } from '@/services/auth.service'
import { useToastContext } from '@/contexts/ToastContext'
import { useAvatarCache } from '@/hooks/useAvatarCache'
import ContentWrapper from '@/components/ui/ContentWrapper'

export default function Profile() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const user = authService.getCurrentUser()

  // Usar cache de avatar
  const { avatarUrl: cachedAvatar, isLoading: avatarLoading } = useAvatarCache(user?.avatar)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
      setCity(user.city || '')
      setNickname(user.nickname || '')
    }
  }, [user])

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(\d{4})-(\d)(\d{4})/, '$1$2-$3')
      .replace(/(-\d{4})\d+?$/, '$1')
  }

  const handleSave = async () => {
    if (!user) return

    if (!name.trim() || name.trim().length < 2) {
      toast.error('Nome deve ter no mínimo 2 caracteres')
      return
    }

    const phoneNumbers = phone.replace(/\D/g, '')
    if (phone && (phoneNumbers.length < 10 || phoneNumbers.length > 11)) {
      toast.error('Por favor, insira um telefone válido com DDD')
      return
    }

    if (!city.trim()) {
      toast.error('Cidade é obrigatória')
      return
    }

    setLoading(true)
    try {
      const updatedUser = await authService.updateProfile({
        name: name.trim(),
        phone: phoneNumbers || undefined,
        city: city.trim(),
        nickname: nickname.trim() || undefined,
      })
      // Atualizar estado local com o usuário atualizado
      if (updatedUser) {
        setName(updatedUser.name)
        setPhone(updatedUser.phone || '')
        setCity(updatedUser.city)
        setNickname(updatedUser.nickname || '')
      }
      toast.success('Perfil atualizado com sucesso!')
      setIsEditing(false)
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao atualizar perfil. Tente novamente.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <ContentWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full h-10 w-10 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Editar Perfil</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas informações pessoais</p>
          </div>
        </div>

        {/* Avatar/Foto do Usuário */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {cachedAvatar ? (
              <div className="relative h-24 w-24 rounded-full border-2 border-primary shadow-lg p-0.5 bg-background">
                <div className="h-full w-full rounded-full overflow-hidden">
                  <img
                    src={cachedAvatar}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/20 border-2 border-primary shadow-lg flex items-center justify-center p-0.5 bg-background">
                <div className="h-full w-full rounded-full bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">
                    {user.name
                      .split(' ')
                      .slice(0, 2)
                      .map(part => part.charAt(0).toUpperCase())
                      .join('') || 'U'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações do Usuário */}
        <Card className="p-4 space-y-4">
          {/* Campos editáveis */}
          <div className="space-y-4">
            {/* Nome */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full"
                  />
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="text-base font-semibold">{name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Email (somente leitura) */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base font-semibold">{user.email}</p>
              </div>
            </div>

            {/* Telefone */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full"
                  />
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="text-base font-semibold">{phone || 'Não informado'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Cidade */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Sua cidade"
                    className="w-full"
                    required
                  />
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Cidade</p>
                    <p className="text-base font-semibold">{city}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Apelido */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Seu apelido (opcional)"
                    className="w-full"
                  />
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Apelido</p>
                    <p className="text-base font-semibold">{nickname || 'Não informado'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Botões de Ação */}
        <div className="space-y-2">
          {isEditing ? (
            <>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSave}
                disabled={loading}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setIsEditing(false)
                  // Restaurar valores originais
                  if (user) {
                    setName(user.name || '')
                    setPhone(user.phone || '')
                    setCity(user.city || '')
                    setNickname(user.nickname || '')
                  }
                }}
                disabled={loading}
                className="w-full"
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setIsEditing(true)}
              className="w-full"
            >
              Editar Perfil
            </Button>
          )}
        </div>
      </div>
    </ContentWrapper>
  )
}