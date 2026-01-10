import { useRoundSelectorContext } from '@/contexts/RoundSelectorContext'

/**
 * Hook que fornece acesso ao seletor de rodadas compartilhado entre todas as páginas.
 * O estado é mantido globalmente, evitando recarregamentos desnecessários ao navegar.
 */
export function useRoundSelector() {
  const context = useRoundSelectorContext()
  return {
    rounds: context.rounds,
    selectedRound: context.selectedRound,
    setSelectedRound: context.setSelectedRound,
    loading: context.loading,
    refreshRounds: context.refreshRounds,
  }
}
