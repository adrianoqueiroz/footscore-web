import { useNavigate } from 'react-router-dom'
import CreateRound from './CreateRound'
import { matchService } from '@/services/match.service'
import { useRoundSelector } from '@/hooks/useRoundSelector'
import { useToastContext } from '@/contexts/ToastContext'
import { Match } from '@/types'

export default function AdminCreateRound() {
  const navigate = useNavigate()
  const { refreshRounds, setSelectedRound } = useRoundSelector()
  const toast = useToastContext()

  const handleSaveRound = async (newMatches: Match[], round: number) => {
    try {
      await matchService.createRound(newMatches)
      await refreshRounds()
      if (setSelectedRound) {
        setSelectedRound(round)
      }
      navigate('/admin/update-games')
      toast.success(`Rodada ${round} criada com sucesso!`)
    } catch (error: any) {
      console.error('Error creating round:', error)
      const errorMessage = error?.message || 'Erro ao criar rodada. Tente novamente.'
      toast.error(errorMessage)
    }
  }

  const handleCancel = () => {
    navigate('/admin')
  }

  return <CreateRound onSave={handleSaveRound} onCancel={handleCancel} />
}
