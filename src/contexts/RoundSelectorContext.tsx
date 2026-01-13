import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { matchService } from '@/services/match.service'

interface RoundSelectorContextType {
  rounds: number[]
  selectedRound: number | undefined
  setSelectedRound: (round: number | undefined) => void
  loading: boolean
  refreshRounds: () => Promise<void>
  validateSelection: () => void
}

const RoundSelectorContext = createContext<RoundSelectorContextType | null>(null)

export function RoundSelectorProvider({ children }: { children: ReactNode }) {
  const [rounds, setRounds] = useState<number[]>([])
  const [selectedRound, setSelectedRound] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)

  const loadRounds = async (preserveSelection: boolean = false) => {
    setLoading(true)
    try {
      const roundsData = await matchService.getRounds()

      // Verificar se roundsData é um array válido
      if (!Array.isArray(roundsData)) {
        console.error('Error loading rounds: Invalid response format', roundsData)
        setRounds([])
        setLoading(false)
        return
      }

      setRounds(roundsData)

      // Usar função de atualização para acessar o estado atual
      setSelectedRound(currentSelected => {
        // Sempre verificar se a rodada selecionada está disponível nas rodadas ativas
        // Não preservar seleção de rodadas inativas
        if (currentSelected && roundsData.includes(currentSelected)) {
          return currentSelected
        }

        // Se não há rodada selecionada ou a selecionada não está mais disponível
        if (roundsData.length > 0) {
          // Selecionar a última rodada disponível
          return roundsData[roundsData.length - 1]
        } else {
          // Se não há rodadas ativas, limpar seleção
          return undefined
        }
      })
    } catch (error: any) {
      console.error('Error loading rounds:', error)
      // Em caso de erro, garantir que não fique em loading infinito
      setRounds([])
      // Não limpar selectedRound em caso de erro para manter a UI funcional
    } finally {
      setLoading(false)
    }
  }

  // Carregar rodadas ao montar o provider
  useEffect(() => {
    let isMounted = true

    const load = async () => {
      try {
        await loadRounds(false) // Primeira carga: pode selecionar automaticamente
      } catch (error) {
        console.error('Erro ao carregar rodadas no useEffect:', error)
        // Garantir que não fique em loading infinito
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Delay maior para priorizar navegação sobre carregamento inicial
    const timeoutId = setTimeout(load, 200)

    return () => {
      clearTimeout(timeoutId)
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Função para forçar refresh das rodadas (útil quando uma nova rodada é criada)
  const refreshRounds = async () => {
    await loadRounds(false) // Refresh manual: pode mudar seleção se necessário
  }

  // Função para validar seleção atual contra rodadas disponíveis
  const validateSelection = () => {
    setSelectedRound(currentSelected => {
      if (currentSelected && rounds.includes(currentSelected)) {
        return currentSelected
      }

      if (rounds.length > 0) {
        return rounds[rounds.length - 1]
      } else {
        return undefined
      }
    })
  }

  return (
    <RoundSelectorContext.Provider
      value={{
        rounds,
        selectedRound,
        setSelectedRound,
        loading,
        refreshRounds,
        validateSelection,
      }}
    >
      {children}
    </RoundSelectorContext.Provider>
  )
}

export function useRoundSelectorContext() {
  const context = useContext(RoundSelectorContext)
  if (!context) {
    throw new Error('useRoundSelectorContext must be used within RoundSelectorProvider')
  }
  return context
}

