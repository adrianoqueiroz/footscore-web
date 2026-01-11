import { Match } from '@/types'
import { apiService } from './api.service'
import { parseMatchDateTime } from '@/lib/utils'

export const matchService = {
  async getRounds(): Promise<number[]> {
    try {
      return await apiService.get<number[]>('/matches/rounds')
    } catch (error) {
      console.error('Error fetching rounds:', error)
      throw error
    }
  },

  async getAllRounds(): Promise<number[]> {
    try {
      return await apiService.get<number[]>('/matches/rounds/all')
    } catch (error) {
      console.error('Error fetching all rounds:', error)
      throw error
    }
  },

  async getAllMatches(): Promise<Match[]> {
    try {
      return await apiService.get<Match[]>('/matches')
    } catch (error) {
      console.error('Error fetching matches:', error)
      throw error
    }
  },

  async getMatchesByRound(round: number, forBetting: boolean = false): Promise<Match[]> {
    try {
      // Se for para palpites, adicionar parâmetro forBetting=true para o backend filtrar
      const url = forBetting 
        ? `/matches?round=${round}&forBetting=true`
        : `/matches?round=${round}`
      
      const response = await apiService.get<Match[] | { matches: Match[]; round: number; allowsNewBets: boolean; isBlocked: boolean }>(url)
      
      // Verificar se a resposta inclui informações da rodada (nova API)
      if (response && typeof response === 'object' && 'matches' in response) {
        return response.matches
      }
      
      // Resposta antiga (apenas array of matches)
      return response as Match[]
    } catch (error) {
      console.error('Error fetching matches by round:', error)
      throw error
    }
  },

  async getRoundStatus(round: number): Promise<{ allowsNewBets: boolean; isBlocked: boolean } | null> {
    try {
      const response = await apiService.get<Match[] | { matches: Match[]; round: number; allowsNewBets: boolean; isBlocked: boolean }>(`/matches?round=${round}`)
      
      // Verificar se a resposta inclui informações da rodada (nova API)
      if (response && typeof response === 'object' && 'allowsNewBets' in response) {
        return {
          allowsNewBets: response.allowsNewBets,
          isBlocked: response.isBlocked
        }
      }
      
      return null
    } catch (error) {
      console.error('Error fetching round status:', error)
      return null
    }
  },

  async getMatchesByRoundWithStatus(round: number): Promise<{ matches: Match[]; allowsNewBets: boolean; isBlocked: boolean; isActive?: boolean }> {
    try {
      const response = await apiService.get<Match[] | { matches: Match[]; round: number; allowsNewBets: boolean; isBlocked: boolean; isActive?: boolean }>(`/matches?round=${round}`)
      
      // Verificar se a resposta inclui informações da rodada (nova API)
      if (response && typeof response === 'object' && 'matches' in response) {
        return {
          matches: response.matches,
          allowsNewBets: response.allowsNewBets,
          isBlocked: response.isBlocked,
          isActive: response.isActive
        }
      }
      
      // Resposta antiga (apenas array de matches) - assumir que permite
      return {
        matches: response as Match[],
        allowsNewBets: true,
        isBlocked: false,
        isActive: true
      }
    } catch (error) {
      console.error('Error fetching matches by round with status:', error)
      throw error
    }
  },

  async getMatchById(id: string): Promise<Match | null> {
    try {
      return await apiService.get<Match>(`/matches/${id}`)
    } catch (error) {
      console.error('Error fetching match:', error)
      return null
    }
  },

  async updateMatchResult(id: string, homeScore: number, awayScore: number): Promise<Match> {
    try {
      return await apiService.put<Match>(`/matches/${id}/result`, {
        homeScore,
        awayScore,
      })
    } catch (error) {
      console.error('Error updating match result:', error)
      throw error
    }
  },

  async updateMatchStatus(id: string, status: 'scheduled' | 'live' | 'finished'): Promise<Match> {
    try {
      return await apiService.put<Match>(`/matches/${id}/status`, { status })
    } catch (error) {
      console.error('Error updating match status:', error)
      throw error
    }
  },

  async updateMatch(id: string, data: Partial<Omit<Match, 'id'>>): Promise<Match> {
    try {
      return await apiService.patch<Match>(`/matches/${id}`, data)
    } catch (error) {
      console.error('Error updating match:', error)
      throw error
    }
  },

  isMatchLocked(match: Match): boolean {
    const matchDateTime = parseMatchDateTime(match)
    if (!matchDateTime) {
      return true // Consider locked if date is invalid
    }

    const now = new Date()
    const lockTime = new Date(matchDateTime.getTime() - 30 * 60 * 1000) // 30 minutos antes
    
    return now >= lockTime
  },


  async createRound(matches: Match[]): Promise<Match[]> {
    try {
      return await apiService.post<Match[]>('/matches/round', { matches })
    } catch (error) {
      console.error('Error creating round:', error)
      throw error
    }
  },

  async updateRound(round: number, data: { matches: Array<{ id: string; date: string; time: string; includeInRound?: boolean }> }): Promise<void> {
    try {
      await apiService.put(`/matches/round/${round}`, data)
    } catch (error) {
      console.error('Error updating round:', error)
      throw error
    }
  },

  async updateRoundAllowsNewBets(round: number, allowsNewBets: boolean): Promise<void> {
    try {
      await apiService.patch(`/matches/round/${round}/allows-new-bets`, { allowsNewBets })
    } catch (error) {
      console.error('Error updating round allowsNewBets:', error)
      throw error
    }
  },

  async updateRoundIsActive(round: number, isActive: boolean): Promise<void> {
    try {
      await apiService.patch(`/matches/round/${round}/is-active`, { isActive })
    } catch (error) {
      console.error('Error updating round isActive:', error)
      throw error
    }
  },

  async createMatch(match: { homeTeam: string; awayTeam: string; date: string; time: string; round: number; homeTeamLogo?: string; awayTeamLogo?: string }): Promise<Match> {
    try {
      return await apiService.post<Match>('/matches', match)
    } catch (error) {
      console.error('Error creating match:', error)
      throw error
    }
  },

  async deleteMatch(matchId: string): Promise<void> {
    try {
      await apiService.delete(`/matches/${matchId}`)
    } catch (error) {
      console.error('Error deleting match:', error)
      throw error
    }
  },

  async deleteRound(round: number, password: string): Promise<{ deletedMatches: number; deletedTickets: number }> {
    try {
      return await apiService.delete<{ deletedMatches: number; deletedTickets: number }>(`/matches/round/${round}`, { password })
    } catch (error) {
      console.error('Error deleting round:', error)
      throw error
    }
  },

  async updateMatchOrder(round: number, matchOrders: Array<{ matchId: string; order: number }>): Promise<void> {
    try {
      await apiService.patch(`/matches/round/${round}/order`, { matchOrders })
    } catch (error) {
      console.error('Error updating match order:', error)
      throw error
    }
  },
}
