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
import { getTeamDisplayName } from '@/lib/teamNames'

// Lista de times (Série A)
const TEAMS = [
  'Flamengo', 'Palmeiras', 'Corinthians', 'Sao Paulo', 'Fluminense',
  'Vasco', 'Atletico-MG', 'Cruzeiro', 'Internacional', 'Gremio',
  'Santos', 'Botafogo', 'Athletico-PR', 'Bahia', 'Fortaleza',
  'Ceara', 'Sport', 'Goias', 'Coritiba', 'America-MG',
  'Bragantino', 'Cuiaba', 'Juventude', 'Vitoria'
].sort()

export default function Profile() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const [user, setUser] = useState(authService.getCurrentUser())
  const [isSaving, setIsSaving] = useState(false)

  // Usar cache de avatar
  const { avatarUrl: cachedAvatar, isLoading: avatarLoading } = useAvatarCache(user?.avatar)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [location, setLocation] = useState('')
  const [showOtherLocation, setShowOtherLocation] = useState(false)
  const [nickname, setNickname] = useState('')
  const [favoriteTeam, setFavoriteTeam] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

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

  useEffect(() => {
    if (user && !isEditing && !isSaving) {
      // Só atualizar quando não estiver editando e não estiver salvando para não sobrescrever mudanças do usuário
      setName(user.name || '')
      setPhone(user.phone || '')
      
      // Separar cidade e localidade
      const { city: parsedCity, location: parsedLocation } = parseCityAndLocation(user.city || '')
      setCity(parsedCity)
      
      // Verificar se a localidade é "Sede" ou outra
      if (parsedLocation.toLowerCase() === 'sede') {
        setLocation('Sede')
        setShowOtherLocation(false)
      } else if (parsedLocation) {
        setLocation(parsedLocation)
        setShowOtherLocation(true)
      } else {
        setLocation('')
        setShowOtherLocation(false)
      }
      
      setNickname(user.nickname || '')
      const teamValue = user.favoriteTeam || ''
      console.log('[Profile] useEffect - carregando favoriteTeam do user:', teamValue, 'isEditing:', isEditing, 'isSaving:', isSaving)
      setFavoriteTeam(teamValue)
    }
  }, [user, isEditing, isSaving])
  
  // Debug: monitorar mudanças no favoriteTeam
  useEffect(() => {
    console.log('[Profile] favoriteTeam state mudou para:', favoriteTeam, 'tipo:', typeof favoriteTeam)
  }, [favoriteTeam])
  

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(\d{4})-(\d)(\d{4})/, '$1$2-$3')
      .replace(/(-\d{4})\d+?$/, '$1')
  }

  const handleLocationSelect = (value: string) => {
    if (value === 'Sede') {
      setLocation('Sede')
      setShowOtherLocation(false)
    } else {
      // "Outra" foi selecionada
      setLocation('')
      setShowOtherLocation(true)
      // Focar no input após um pequeno delay
      setTimeout(() => {
        const input = document.getElementById('location-input')
        input?.focus()
      }, 100)
    }
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

    // Localidade é sempre obrigatória
    if (!location.trim()) {
      toast.error('Por favor, selecione "Sede" ou informe outra localidade')
      return
    }
    // Se selecionou "Outra", precisa preencher o nome
    if (showOtherLocation && location.trim().length < 2) {
      toast.error('Por favor, informe o nome da localidade')
      return
    }

    setLoading(true)
    setIsSaving(true) // Marcar que está salvando para evitar que useEffect resete
    try {
      // Combinar cidade e localidade no formato "Cidade - Localidade"
      let cityWithLocation: string
      if (location.trim().toLowerCase() === 'sede') {
        cityWithLocation = `${city.trim()} - Sede`
      } else {
        cityWithLocation = `${city.trim()} - ${location.trim()}`
      }

      console.log('[Profile] Salvando perfil - favoriteTeam antes de enviar:', favoriteTeam, 'tipo:', typeof favoriteTeam)
      const profileData = {
        name: name.trim(),
        phone: phoneNumbers || undefined,
        city: cityWithLocation,
        nickname: nickname.trim() || undefined,
        favoriteTeam: favoriteTeam && favoriteTeam.trim() !== '' ? favoriteTeam.trim() : null, // Enviar null se vazio
      }
      console.log('[Profile] Dados sendo enviados:', profileData)
      const updatedUser = await authService.updateProfile(profileData)
      console.log('[Profile] Usuário atualizado recebido:', updatedUser)
      console.log('[Profile] favoriteTeam retornado:', updatedUser?.favoriteTeam, 'tipo:', typeof updatedUser?.favoriteTeam)
      // Atualizar estado local com o usuário atualizado
      if (updatedUser) {
        // Atualizar os campos individuais primeiro
        setName(updatedUser.name)
        setPhone(updatedUser.phone || '')
        
        // Separar cidade e localidade
        const { city: parsedCity, location: parsedLocation } = parseCityAndLocation(updatedUser.city || '')
        setCity(parsedCity)
        if (parsedLocation.toLowerCase() === 'sede') {
          setLocation('Sede')
          setShowOtherLocation(false)
        } else if (parsedLocation) {
          setLocation(parsedLocation)
          setShowOtherLocation(true)
        } else {
          setLocation('')
          setShowOtherLocation(false)
        }
        
        setNickname(updatedUser.nickname || '')
        const teamValue = updatedUser.favoriteTeam || ''
        console.log('[Profile] Setando favoriteTeam no estado:', teamValue)
        setFavoriteTeam(teamValue) // Manter como string vazia, não null
        // Atualizar o estado do usuário por último
        setUser(updatedUser)
      }
      toast.success('Perfil atualizado com sucesso!')
      // Desativar edição
      setIsEditing(false)
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao atualizar perfil. Tente novamente.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      // Aguardar um pouco antes de desmarcar isSaving para garantir que useEffect não resete
      setTimeout(() => {
        setIsSaving(false)
      }, 100)
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
              <div className="relative h-24 w-24 rounded-full border-[3px] border-primary shadow-lg p-0.5 bg-background">
                <div className="h-full w-full rounded-full overflow-hidden">
                  <img
                    src={cachedAvatar}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/20 border-[3px] border-primary shadow-lg flex items-center justify-center p-0.5 bg-background">
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
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
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
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-base font-semibold">{user.email}</p>
              </div>
            </div>

            {/* Telefone */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
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
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mt-1">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {isEditing ? (
                  <>
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium mb-2 text-left">
                        Cidade *
                      </label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex: Brotas de Macaubas"
                        className="w-full"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium mb-2 text-left">
                        Localidade *
                      </label>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={location === 'Sede' ? 'primary' : 'outline'}
                            onClick={() => handleLocationSelect('Sede')}
                            className="w-full"
                          >
                            Sede
                          </Button>
                          <Button
                            type="button"
                            variant={showOtherLocation ? 'primary' : 'outline'}
                            onClick={() => handleLocationSelect('Outra')}
                            className="w-full"
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
                              id="location-input"
                              type="text"
                              placeholder="Digite o distrito ou localidade"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              className="w-full"
                              required
                              minLength={2}
                            />
                          </motion.div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 text-left">
                        Selecione "Sede" ou informe outra localidade do município
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Cidade</p>
                    <p className="text-base font-semibold">{city}{location ? ` - ${location}` : ''}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Apelido */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
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

            {/* Time do Coração */}
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-lg">⚽</span>
              </div>
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <select
                    value={favoriteTeam || ''}
                    onChange={(e) => {
                      const newValue = e.target.value
                      console.log('[Profile] Select onChange - novo valor:', newValue)
                      setFavoriteTeam(newValue)
                    }}
                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Selecione um time (opcional)</option>
                    {TEAMS.map(team => (
                      <option key={team} value={team}>
                        {getTeamDisplayName(team)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">Time do Coração</p>
                    <p className="text-base font-semibold">{favoriteTeam && favoriteTeam !== '' ? getTeamDisplayName(favoriteTeam) : 'Não informado'}</p>
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
                    const { city: parsedCity, location: parsedLocation } = parseCityAndLocation(user.city || '')
                    setCity(parsedCity)
                    if (parsedLocation.toLowerCase() === 'sede') {
                      setLocation('Sede')
                      setShowOtherLocation(false)
                    } else if (parsedLocation) {
                      setLocation(parsedLocation)
                      setShowOtherLocation(true)
                    } else {
                      setLocation('')
                      setShowOtherLocation(false)
                    }
                    setNickname(user.nickname || '')
                    setFavoriteTeam(user.favoriteTeam || '')
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