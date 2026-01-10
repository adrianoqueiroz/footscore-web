import { apiService } from './api.service'

export const configService = {
  async getAdminWhatsApp(): Promise<string> {
    try {
      const response = await apiService.get<{ key: string; value: string }>('/config/admin_whatsapp')
      return response.value || '5511999999999' // Fallback para padrão
    } catch (error) {
      console.error('Error fetching admin WhatsApp:', error)
      // Fallback para localStorage se backend falhar
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('footScore_admin_whatsapp')
        if (stored) return stored
      }
      return '5511999999999' // Padrão
    }
  },

  async setAdminWhatsApp(value: string): Promise<void> {
    try {
      await apiService.put('/config/admin_whatsapp', { value })
      // Também salvar no localStorage como cache/fallback
      if (typeof window !== 'undefined') {
        localStorage.setItem('footScore_admin_whatsapp', value)
      }
    } catch (error) {
      console.error('Error saving admin WhatsApp:', error)
      // Fallback para localStorage se backend falhar
      if (typeof window !== 'undefined') {
        localStorage.setItem('footScore_admin_whatsapp', value)
      }
      throw error
    }
  },

  async getGameTimes(): Promise<string[]> {
    try {
      const response = await apiService.get<{ key: string; value: string }>('/config/game_times')
      if (response.value) {
        try {
          return JSON.parse(response.value)
        } catch {
          return ['16:00', '18:30', '20:00', '21:30']
        }
      }
      return ['16:00', '18:30', '20:00', '21:30']
    } catch (error) {
      console.error('Error fetching game times:', error)
      // Fallback para localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('footScore_game_times')
        if (stored) {
          try {
            return JSON.parse(stored)
          } catch {
            return ['16:00', '18:30', '20:00', '21:30']
          }
        }
      }
      return ['16:00', '18:30', '20:00', '21:30']
    }
  },

  async setGameTimes(times: string[]): Promise<void> {
    try {
      await apiService.put('/config/game_times', { value: JSON.stringify(times) })
      // Também salvar no localStorage como cache/fallback
      if (typeof window !== 'undefined') {
        localStorage.setItem('footScore_game_times', JSON.stringify(times))
      }
    } catch (error) {
      console.error('Error saving game times:', error)
      // Fallback para localStorage se backend falhar
      if (typeof window !== 'undefined') {
        localStorage.setItem('footScore_game_times', JSON.stringify(times))
      }
      throw error
    }
  },
}

