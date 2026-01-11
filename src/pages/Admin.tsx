import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Trophy, CheckCircle, Users, Settings } from 'lucide-react'
import Card from '@/components/ui/Card'

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
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 * 0.05 }}
            whileTap={{ scale: 0.98 }} 
            onClick={() => navigate('/admin/create-round')}
          >
            <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Plus className="h-6 w-6 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-lg">Criar Nova Rodada</h3><p className="text-sm text-muted-foreground">Criar uma nova rodada com confrontos e horários</p></div>
              </div>
            </Card>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 * 0.05 }}
            whileTap={{ scale: 0.98 }} 
            onClick={() => navigate('/admin/update-games')}
          >
            <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Trophy className="h-6 w-6 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-lg">Gerenciar Rodadas</h3><p className="text-sm text-muted-foreground">Atualizar placares e status dos jogos</p></div>
              </div>
            </Card>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3 * 0.05 }}
            whileTap={{ scale: 0.98 }} 
            onClick={() => navigate('/admin/manage-palpites')}
          >
            <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><CheckCircle className="h-6 w-6 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-lg">Gerenciar Palpites</h3><p className="text-sm text-muted-foreground">Aprovar, cancelar e visualizar palpites</p></div>
              </div>
            </Card>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 4 * 0.05 }}
            whileTap={{ scale: 0.98 }} 
            onClick={() => navigate('/admin/manage-users')}
          >
            <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Users className="h-6 w-6 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-lg">Gerenciar Usuários</h3><p className="text-sm text-muted-foreground">Atualizar dados e permissões dos usuários</p></div>
              </div>
            </Card>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 5 * 0.05 }}
            whileTap={{ scale: 0.98 }} 
            onClick={() => navigate('/admin/settings')}
          >
            <Card className="cursor-pointer hover:bg-secondary/80 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20"><Settings className="h-6 w-6 text-primary" /></div>
                <div className="flex-1"><h3 className="font-semibold text-lg">Configurações</h3><p className="text-sm text-muted-foreground">Configurar informações gerais do app</p></div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
