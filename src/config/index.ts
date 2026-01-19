import { configService } from '@/services/config.service'

const defaultAdminWhatsApp = '5511999999999'
const defaultGameTimes = ['16:00', '18:30', '20:00', '21:30']

// Cache para evitar múltiplas chamadas
let whatsappCache: string | null = null
let gameTimesCache: string[] | null = null

const getAdminWhatsApp = async (): Promise<string> => {
  // Se já temos cache, retornar imediatamente
  if (whatsappCache) return whatsappCache
  
  try {
    const value = await configService.getAdminWhatsApp()
    whatsappCache = value
    return value
  } catch (error) {
    console.error('Error getting admin WhatsApp:', error)
    // Fallback para localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('footScore_admin_whatsapp')
      if (stored) {
        whatsappCache = stored
        return stored
      }
    }
    return defaultAdminWhatsApp
  }
}

// Versão síncrona para compatibilidade (usa cache ou localStorage)
const getAdminWhatsAppSync = (): string => {
  if (whatsappCache) return whatsappCache
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('footScore_admin_whatsapp')
    if (stored) {
      whatsappCache = stored
      return stored
    }
  }
  return defaultAdminWhatsApp
}

const setAdminWhatsApp = async (value: string) => {
  try {
    await configService.setAdminWhatsApp(value)
    whatsappCache = value // Atualizar cache
  } catch (error) {
    console.error('Error setting admin WhatsApp:', error)
    // Fallback para localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('footScore_admin_whatsapp', value)
      whatsappCache = value
    }
    throw error
  }
}

const getGameTimes = async (): Promise<string[]> => {
  // Se já temos cache, retornar imediatamente
  if (gameTimesCache) return gameTimesCache
  
  try {
    const value = await configService.getGameTimes()
    gameTimesCache = value
    return value
  } catch (error) {
    console.error('Error getting game times:', error)
    // Fallback para localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('footScore_game_times')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          gameTimesCache = parsed
          return parsed
        } catch {
          return defaultGameTimes
        }
      }
    }
    return defaultGameTimes
  }
}

// Versão síncrona para compatibilidade (usa cache ou localStorage)
const getGameTimesSync = (): string[] => {
  if (gameTimesCache) return gameTimesCache
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('footScore_game_times')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        gameTimesCache = parsed
        return parsed
      } catch {
        return defaultGameTimes
      }
    }
  }
  return defaultGameTimes
}

const setGameTimes = async (times: string[]) => {
  try {
    await configService.setGameTimes(times)
    gameTimesCache = times // Atualizar cache
  } catch (error) {
    console.error('Error setting game times:', error)
    // Fallback para localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('footScore_game_times', JSON.stringify(times))
      gameTimesCache = times
    }
    throw error
  }
}

// Configurações do app
export const config = {
  appName: 'FootScore',

  storageKeys: {
    user: 'footScore_user',
    phone: 'footScore_phone',
    tickets: 'footScore_tickets',
    matches: 'footScore_matches',
    adminWhatsApp: 'footScore_admin_whatsapp',
    gameTimes: 'footScore_game_times',
  },

  // Número do WhatsApp do Admin (formato: 5511999999999 - sem caracteres especiais)
  // Versão síncrona para compatibilidade (usa cache)
  get adminWhatsApp() {
    return getAdminWhatsAppSync()
  },
  
  // Tempo de delay para simular chamadas de API (ms)
  apiDelay: 800,
  
  // Tempo de lock antes do jogo (minutos)
  lockTimeBeforeMatch: 30,
  
  // Rodada atual
  currentRound: 1,

  // Funções para gerenciar o WhatsApp do admin
  setAdminWhatsApp,
  getAdminWhatsApp, // Versão assíncrona (recomendada)
  getAdminWhatsAppSync, // Versão síncrona (compatibilidade)

  // Funções para gerenciar horários pré-definidos de jogos
  getGameTimes, // Versão assíncrona (recomendada)
  getGameTimesSync, // Versão síncrona (compatibilidade)
  setGameTimes,

  // URL base da API
  get apiBaseUrl() {
    // Importar dinamicamente para evitar dependência circular
    try {
      // @ts-ignore - import dinâmico
      const { API_BASE_URL } = require('./api')
      return API_BASE_URL
    } catch {
      return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
    }
  },
}



