import { useNavigate } from 'react-router-dom'
import { Plus, Trophy, CheckCircle, Users, Settings } from 'lucide-react'
import MenuItemCard from '@/components/ui/MenuItemCard'

export default function Admin() {
  const navigate = useNavigate()

  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Painel Administrativo</h1>
          <div className="w-40 h-10"></div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <MenuItemCard
            icon={Plus}
            title="Criar Nova Rodada"
            description="Criar uma nova rodada com confrontos e horários"
            onClick={() => navigate('/admin/create-round')}
            index={0}
          />
          <MenuItemCard
            icon={Trophy}
            title="Gerenciar Rodadas"
            description="Atualizar placares e status dos jogos"
            onClick={() => navigate('/admin/update-games')}
            index={1}
          />
          <MenuItemCard
            icon={CheckCircle}
            title="Gerenciar Palpites"
            description="Aprovar, cancelar e visualizar palpites"
            onClick={() => navigate('/admin/manage-palpites')}
            index={2}
          />
          <MenuItemCard
            icon={Users}
            title="Gerenciar Usuários"
            description="Atualizar dados e permissões dos usuários"
            onClick={() => navigate('/admin/manage-users')}
            index={3}
          />
          <MenuItemCard
            icon={Settings}
            title="Configurações"
            description="Configurar informações gerais do app"
            onClick={() => navigate('/admin/settings')}
            index={4}
          />
        </div>
      </div>
    </div>
  )
}
