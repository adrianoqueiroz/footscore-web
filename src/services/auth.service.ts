import { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types'
import { apiService } from './api.service'

const STORAGE_KEY = 'bolao_user'
const STORAGE_PHONE_KEY = 'bolao_phone'

export const authService = {
  async loginWithGoogle(googleToken: string): Promise<User> {
    try {
      const response = await apiService.post<{ user: User; token?: string }>('/auth/google', {
        token: googleToken,
      })
      
      // Salvar token se fornecido
      if (response.token) {
        localStorage.setItem('auth_token', response.token)
      }
      
      const user = response.user
      // Converter isAdmin de 1/0 para boolean se necessário
      user.isAdmin = Boolean(user.isAdmin === 1 || user.isAdmin === true)
      
      // Verifica se já tem telefone salvo
      const savedPhone = localStorage.getItem(STORAGE_PHONE_KEY)
      if (savedPhone) {
        user.phone = savedPhone
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      return user
    } catch (error) {
      console.error('Error logging in:', error)
      throw error
    }
  },

  // New login function
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>('/auth/login', credentials);
      // Converter isAdmin de 1/0 para boolean se necessário
      response.user.isAdmin = Boolean(response.user.isAdmin === 1 || response.user.isAdmin === true)
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user));
      return response;
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  },

  // New registration function
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiService.post<AuthResponse>('/auth/register', userData);
      // Converter isAdmin de 1/0 para boolean se necessário
      response.user.isAdmin = Boolean(response.user.isAdmin === 1 || response.user.isAdmin === true)
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user));
      return response;
    } catch (error) {
      console.error('Error registering:', error);
      throw error;
    }
  },

  async savePhone(phone: string): Promise<void> {
    try {
      await apiService.put('/auth/phone', { phone })
      localStorage.setItem(STORAGE_PHONE_KEY, phone)
      const userStr = localStorage.getItem(STORAGE_KEY)
      if (userStr) {
        const user: User = JSON.parse(userStr)
        user.phone = phone
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      }
    } catch (error) {
      console.error('Error saving phone:', error)
      throw error
    }
  },

  async updateProfile(updates: { name?: string; phone?: string; city?: string; nickname?: string; favoriteTeam?: string | null }): Promise<User> {
    try {
      const response = await apiService.put<{ user: User }>('/auth/profile', updates)
      const updatedUser = response.user
      // Converter isAdmin de 1/0 para boolean se necessário
      updatedUser.isAdmin = Boolean(updatedUser.isAdmin === 1 || updatedUser.isAdmin === true)
      
      // Atualizar localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser))
      
      // Atualizar telefone no storage separado se fornecido
      if (updates.phone) {
        localStorage.setItem(STORAGE_PHONE_KEY, updates.phone)
      }
      
      return updatedUser
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  },

  async getNotificationPreferences(): Promise<{
    notifyGoals: boolean
    notifyGoalsAllTeams: boolean
    notifyGoalsFavoriteTeam: boolean
    notifyRoundBets: boolean
    notifyRanking: boolean
    notifyBell: boolean
    notifyToast: boolean
    bellRanking: boolean
    bellFavoriteTeamMatch: boolean
    bellGoalsAllTeams: boolean
    bellGoalsFavoriteTeam: boolean
  }> {
    try {
      const response = await apiService.get<{ preferences: any }>('/auth/notification-preferences')
      return {
        notifyGoals: response.preferences.notifyGoals ?? true,
        notifyGoalsAllTeams: response.preferences.notifyGoalsAllTeams ?? true,
        notifyGoalsFavoriteTeam: response.preferences.notifyGoalsFavoriteTeam ?? true,
        notifyRoundBets: response.preferences.notifyRoundBets ?? true,
        notifyRanking: response.preferences.notifyRanking ?? true,
        notifyBell: response.preferences.notifyBell ?? true,
        notifyToast: response.preferences.notifyToast ?? true,
        bellRanking: response.preferences.bellRanking ?? true,
        bellFavoriteTeamMatch: response.preferences.bellFavoriteTeamMatch ?? true,
        bellGoalsAllTeams: response.preferences.bellGoalsAllTeams ?? true,
        bellGoalsFavoriteTeam: response.preferences.bellGoalsFavoriteTeam ?? true
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
      // Retornar padrões se erro
      return {
        notifyGoals: true,
        notifyGoalsAllTeams: true,
        notifyGoalsFavoriteTeam: true,
        notifyRoundBets: true,
        notifyRanking: true,
        notifyBell: true,
        notifyToast: true,
        bellRanking: true,
        bellFavoriteTeamMatch: true,
        bellGoalsAllTeams: true,
        bellGoalsFavoriteTeam: true
      }
    }
  },

  async updateNotificationPreferences(preferences: {
    notifyGoals?: boolean
    notifyGoalsAllTeams?: boolean
    notifyGoalsFavoriteTeam?: boolean
    notifyRoundBets?: boolean
    notifyRanking?: boolean
    notifyBell?: boolean
    notifyToast?: boolean
    bellRanking?: boolean
    bellFavoriteTeamMatch?: boolean
    bellGoalsAllTeams?: boolean
    bellGoalsFavoriteTeam?: boolean
  }): Promise<void> {
    try {
      await apiService.put('/auth/notification-preferences', preferences)
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      throw error
    }
  },

  async refreshUser(): Promise<User | null> {
    try {
      const response = await apiService.get<{ user: User }>('/auth/me')
      const user = response.user
      // Converter isAdmin de 1/0 para boolean se necessário
      user.isAdmin = Boolean(user.isAdmin === 1 || user.isAdmin === true)
      
      // Atualizar localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
      
      return user
    } catch (error) {
      console.error('Error refreshing user data:', error)
      return null
    }
  },

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEY)
    if (!userStr) return null

    try {
      const user = JSON.parse(userStr) as User
      // Converter isAdmin de 1/0 para boolean se necessário (pode estar salvo como número)
      user.isAdmin = Boolean(user.isAdmin === 1 || user.isAdmin === true)
      return user
    } catch (error) {
      console.error("Error parsing user data from localStorage:", error)
      // Optionally, clear the invalid data to prevent repeated errors
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem('auth_token') // Also clear the token if user data is corrupted
      return null
    }
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_PHONE_KEY)
    localStorage.removeItem('auth_token')
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem(STORAGE_KEY)
  },
}



