import { Ticket, TicketRankingEntry } from '@/types'
import { apiService } from './api.service'

export const ticketService = {
  async createTicket(
    userId: string,
    userName: string,
    round: number,
    predictions: { matchId: string; homeScore: number; awayScore: number }[]
  ): Promise<Ticket> {
    try {
      return await apiService.post<Ticket>('/tickets', {
        userId,
        userName,
        round,
        predictions,
      })
    } catch (error) {
      console.error('Error creating ticket:', error)
      throw error
    }
  },

  async getTicketsByUser(userId: string): Promise<Ticket[]> {
    try {
      return await apiService.get<Ticket[]>(`/tickets?userId=${userId}`)
    } catch (error) {
      console.error('Error fetching user tickets:', error)
      throw error
    }
  },

  async getAllTickets(): Promise<Ticket[]> {
    try {
      return await apiService.get<Ticket[]>('/tickets')
    } catch (error) {
      console.error('Error fetching all tickets:', error)
      throw error
    }
  },

  async getTicketById(id: string): Promise<Ticket | null> {
    try {
      return await apiService.get<Ticket>(`/tickets/${id}`)
    } catch (error) {
      console.error('Error fetching ticket:', error)
      return null
    }
  },

  async confirmTicket(ticketId: string): Promise<Ticket> {
    try {
      return await apiService.put<Ticket>(`/tickets/${ticketId}/confirm`)
    } catch (error) {
      console.error('Error confirming ticket:', error)
      throw error
    }
  },

  async cancelTicket(ticketId: string): Promise<Ticket> {
    try {
      return await apiService.put<Ticket>(`/tickets/${ticketId}/cancel`)
    } catch (error) {
      console.error('Error canceling ticket:', error)
      throw error
    }
  },

  async deleteTicket(ticketId: string): Promise<void> {
    try {
      return await apiService.delete<void>(`/tickets/${ticketId}`)
    } catch (error) {
      console.error('Error deleting ticket:', error)
      throw error
    }
  },

  async updateTicket(
    ticketId: string,
    predictions: { matchId: string; homeScore: number; awayScore: number }[]
  ): Promise<Ticket> {
    try {
      return await apiService.put<Ticket>(`/tickets/${ticketId}`, {
        predictions,
      })
    } catch (error) {
      console.error('Error updating ticket:', error)
      throw error
    }
  },

  // REMOVIDO: calculatePoints - cálculo de pontos deve ser feito exclusivamente no backend
  // O backend retorna os pontos calculados em ticket.points e ticket.pointsByMatch

  async getRanking(round: number, hideNames: boolean = false): Promise<TicketRankingEntry[]> {
    try {
      const params = new URLSearchParams()
      params.append('round', round.toString())
      if (hideNames) {
        params.append('hideNames', 'true')
      }
      const url = `/ranking?${params.toString()}`
      return await apiService.get<TicketRankingEntry[]>(url)
    } catch (error) {
      console.error('Error fetching ranking:', error)
      throw error
    }
  },

  async getConfirmedTicketsByRound(round: number): Promise<Ticket[]> {
    try {
      return await apiService.get<Ticket[]>(`/tickets?round=${round}&status=confirmed`)
    } catch (error) {
      console.error('Error fetching confirmed tickets by round:', error)
      throw error
    }
  },

  async deleteTicketsByRound(round: number, password: string): Promise<{ deletedTickets: number }> {
    try {
      return await apiService.delete<{ deletedTickets: number }>(`/tickets/round/${round}`, { password })
    } catch (error) {
      console.error('Error deleting tickets by round:', error)
      throw error
    }
  },
}

