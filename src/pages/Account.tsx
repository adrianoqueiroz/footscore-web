import { motion } from 'framer-motion'
import { ArrowLeft, User, Bell, LogOut, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
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
            <h1 className="text-2xl font-bold">Conta</h1>
            <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências</p>
          </div>
        </div>

        {/* Informações do Usuário */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </Card>

        {/* Menu de Opções */}
        <div className="space-y-3">
          {menuItems.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4">
                  <button
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-4 p-0 hover:bg-secondary/50 rounded-lg transition-colors ${
                      item.danger ? 'text-red-400 hover:bg-red-500/10' : ''
                    }`}
                  >
                    <div className={`p-3 rounded-lg ${item.danger ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                      <Icon className={`w-6 h-6 ${item.danger ? 'text-red-400' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-base">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </ContentWrapper>
  )
}