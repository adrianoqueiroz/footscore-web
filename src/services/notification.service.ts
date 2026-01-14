import { toast } from 'sonner'

export interface NotificationData {
  title: string
  body: string
  data?: Record<string, any>
}

export interface PushNotificationData extends NotificationData {
  showInBell?: boolean // Se deve aparecer no sininho
  userId?: string // Para notificações específicas de usuário
  notificationType?: 'goal' | 'round_bets' | 'ranking' // Tipo para verificação de preferências
}

export interface NotificationPreferences {
  notifyGoals?: boolean
  notifyGoalsAllTeams?: boolean
  favoriteTeam?: string | null
  notifyRoundBets?: boolean
  notifyRanking?: boolean
}

class NotificationService {
  private static instance: NotificationService

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * Envia uma notificação push para um usuário específico
   */
  async sendPushToUser(userId: string, notification: PushNotificationData): Promise<void> {
    try {
      const response = await fetch('/api/notifications/send-to-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...notification
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error('[NotificationService] Erro ao enviar push para usuário:', error)
      throw error
    }
  }

  /**
   * Envia uma notificação push para todos os usuários
   */
  async sendPushToAll(notification: PushNotificationData): Promise<void> {
    try {
      const response = await fetch('/api/notifications/send-to-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error('[NotificationService] Erro ao enviar push para todos:', error)
      throw error
    }
  }

  /**
   * Mostra uma notificação toast local
   */
  showToast(type: 'success' | 'error' | 'info' | 'warning', message: string, description?: string): void {
    switch (type) {
      case 'success':
        toast.success(message, description ? { description } : undefined)
        break
      case 'error':
        toast.error(message, description ? { description } : undefined)
        break
      case 'info':
        toast.info(message, description ? { description } : undefined)
        break
      case 'warning':
        toast.warning(message, description ? { description } : undefined)
        break
    }
  }

  /**
   * Notificação combinada: toast + push (opcional)
   */
  async notify(
    type: 'success' | 'error' | 'info' | 'warning',
    message: string,
    options?: {
      description?: string
      pushToUser?: string
      pushData?: PushNotificationData
    }
  ): Promise<void> {
    // Sempre mostrar toast local
    this.showToast(type, message, options?.description)

    // Enviar push se solicitado
    if (options?.pushToUser && options?.pushData) {
      try {
        await this.sendPushToUser(options.pushToUser, options.pushData)
      } catch (error) {
        console.error('[NotificationService] Erro ao enviar push notification:', error)
      }
    }
  }

  /**
   * Envia notificação de gol (só push, não vai para sininho)
   */
  async notifyGoal(
    userId: string,
    goalData: {
      homeTeam: string
      awayTeam: string
      homeScore: number
      awayScore: number
      goalScorer: 'home' | 'away'
      isGoalCancelled?: boolean
      round: number
      matchId: string
    }
  ): Promise<void> {
    const title = goalData.isGoalCancelled
      ? `❌ Gol ${goalData.goalScorer === 'home' ? 'do ' + goalData.homeTeam : 'do ' + goalData.awayTeam} anulado!`
      : `⚽ Gol ${goalData.goalScorer === 'home' ? 'do ' + goalData.homeTeam : 'do ' + goalData.awayTeam}!`

    const body = `${goalData.homeTeam} ${goalData.homeScore} x ${goalData.awayScore} ${goalData.awayTeam}`

    await this.sendPushToUser(userId, {
      title,
      body,
      notificationType: 'goal',
      data: goalData,
      showInBell: false // Gols não aparecem no sininho
    })
  }

  /**
   * Envia notificação de status da rodada (só sininho)
   */
  async notifyRoundStatus(
    userId: string,
    roundData: {
      round: number
      allowsNewBets: boolean
      isBlocked: boolean
    }
  ): Promise<void> {
    // Esta notificação vai para o sininho via SSE, não push
    // O backend já envia o SSE, o frontend processa via useNotificationListener
  }

  /**
   * Envia notificação de ranking (vai para ambos: sininho + push)
   */
  async notifyRanking(
    userId: string,
    rankingData: {
      round: number
      ticketId: string
      position: number
      points: number
      isWinner: boolean
    }
  ): Promise<void> {
    const title = rankingData.isWinner ? '🏆 Você é o Vencedor!' : '👑 Você é o Líder!'
    const body = rankingData.isWinner
      ? `Parabéns! Seu ticket está em 1º lugar na rodada ${rankingData.round} com ${rankingData.points} pontos!`
      : `Você está em 1º lugar na rodada ${rankingData.round} com ${rankingData.points} pontos!`

    // Enviar push notification
    await this.sendPushToUser(userId, {
      title,
      body,
      notificationType: 'ranking',
      data: rankingData,
      showInBell: true // Ranking aparece no sininho
    })

    // O sininho será atualizado via SSE no useNotificationListener
  }

  /**
   * Método centralizado para enviar qualquer tipo de notificação
   * Decide automaticamente se vai para sininho, push ou ambos
   */
  async sendNotification(
    type: 'goal' | 'round_status' | 'ranking',
    userId: string,
    data: any,
    preferences: NotificationPreferences
  ): Promise<void> {
    // Verificar se deve enviar baseado nas preferências
    if (!this.shouldSendNotification(type, preferences, data)) {
      return
    }

    switch (type) {
      case 'goal':
        await this.notifyGoal(userId, data)
        break
      case 'round_status':
        await this.notifyRoundStatus(userId, data)
        break
      case 'ranking':
        await this.notifyRanking(userId, data)
        break
    }
  }

  /**
   * Verifica se deve enviar notificação baseada nas preferências do usuário
   */
  shouldSendNotification(
    notificationType: 'goal' | 'round_bets' | 'ranking',
    preferences: NotificationPreferences,
    additionalData?: {
      isUserFavoriteTeam?: boolean
      favoriteTeam?: string | null
    }
  ): boolean {
    switch (notificationType) {
      case 'goal':
        // Verificar preferências de gol
        if (!preferences.notifyGoals) return false
        if (!preferences.notifyGoalsAllTeams && additionalData?.isUserFavoriteTeam === false) {
          return false
        }
        return true

      case 'round_bets':
        return preferences.notifyRoundBets ?? true

      case 'ranking':
        return preferences.notifyRanking ?? true

      default:
        return false
    }
  }
}

export const notificationService = NotificationService.getInstance()
export default notificationService