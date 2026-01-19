import { User, Bell, LogOut, HelpCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import MenuItemCard from '@/components/ui/MenuItemCard'
import UserAvatar from '@/components/ui/UserAvatar'
import { authService } from '@/services/auth.service'
import ContentWrapper from '@/components/ui/ContentWrapper'

export default function Account() {
  const navigate = useNavigate()
  const user = authService.getCurrentUser()

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  const menuItems = [
    {
      icon: User,
      title: 'Editar Perfil',
      description: 'Gerencie suas informações pessoais',
      onClick: () => navigate('/profile'),
    },
    {
      icon: Bell,
      title: 'Preferências de Notificação',
      description: 'Configure suas notificações',
      onClick: () => navigate('/notifications'),
    },
    {
      icon: HelpCircle,
      title: 'Sobre o App',
      description: 'Conheça mais sobre o FootScore',
      onClick: () => navigate('/about'),
    },
    {
      icon: LogOut,
      title: 'Sair da Conta',
      description: 'Fazer logout da aplicação',
      onClick: handleLogout,
      danger: true,
    },
  ]

  if (!user) {
    return null
  }

  return (
    <ContentWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-4">
        </div>

        {/* Avatar/Foto do Usuário */}
        <div className="flex flex-col items-center mb-2">
          <UserAvatar user={user} size="lg" />
          <p className="mt-3 text-lg font-semibold">{user.name}</p>
        </div>

        {/* Menu de Opções */}
        <div className="space-y-3">
          {menuItems.map((item, index) => (
            <MenuItemCard
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
              onClick={item.onClick}
              danger={item.danger}
              index={index}
            />
          ))}
        </div>
      </div>
    </ContentWrapper>
  )
}