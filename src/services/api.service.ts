import { authService } from './auth.service'
import { API_BASE_URL } from '@/config/api'

interface ApiError {
  message: string
  status: number
  error?: string
  errors?: Array<{ msg?: string; message?: string; param?: string; location?: string }>
  isConnectionError?: boolean
  isDatabaseError?: boolean
  isAzure?: boolean
  details?: string
  originalError?: any
}

class ApiService {
  private baseURL: string

  constructor() {
    this.baseURL = API_BASE_URL
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const user = authService.getCurrentUser()
    const token = user ? await this.getAuthToken() : null

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = `${this.baseURL}${endpoint}`
    
    // Criar AbortController para timeout
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout | null = null
    
    try {
      timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos de timeout
      
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      })
      
      if (timeoutId) clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }))
        
        // Tratar erros de validação do express-validator (formato { errors: [...] })
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          // Extrair mensagens de erro do array de validação
          const errorMessages = errorData.errors.map((err: any) => err.msg || err.message || 'Erro de validação')
          const error: ApiError = {
            message: errorMessages.join('. '),
            status: response.status,
            errors: errorData.errors, // Incluir array completo para tratamento específico
          }
          console.error(`[API ERROR] ${response.status}: ${error.message}`, errorData)
          throw error
        }
        
        // Verificar se é erro de banco de dados (503)
        if (response.status === 503 && errorData.error === 'DATABASE_CONNECTION_ERROR') {
          const isAzure = errorData.isAzure === true
          const message = isAzure
            ? 'Não foi possível conectar ao PostgreSQL no Azure. Verifique as regras de firewall do Azure.'
            : (errorData.message || 'Banco de dados não está acessível. O servidor não consegue se conectar ao PostgreSQL.')
          
          const error: ApiError = {
            message,
            status: 503,
            error: 'DATABASE_CONNECTION_ERROR',
            isDatabaseError: true,
            isAzure,
            details: errorData.details
          }
          console.error(`[API ERROR] ${response.status}: ${error.message}`, errorData)
          throw error
        }
        
        const error: ApiError = {
          message: errorData.message || errorData.error || `HTTP ${response.status}`,
          status: response.status,
          ...(errorData.error && { error: errorData.error }),
        }
        console.error(`[API ERROR] ${response.status}: ${error.message}`, errorData)
        throw error
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json()
        return data
      }
      
      return {} as T
    } catch (error: any) {
      // Limpar timeout em caso de erro
      if (timeoutId) clearTimeout(timeoutId)
      console.error(`[API CATCH] ${endpoint}:`, error)
      
      // Se for erro de rede (não conseguiu conectar), manter erro específico para tratamento no componente
      if (
        error?.message?.includes('Failed to fetch') || 
        error?.message?.includes('NetworkError') || 
        error?.message?.includes('timeout') ||
        error?.message?.includes('Connection terminated') ||
        error?.name === 'TypeError' ||
        error?.name === 'AbortError'
      ) {
        const errorMessage = error?.name === 'AbortError' || error?.message?.includes('timeout')
          ? 'Timeout na conexão. Verifique se o servidor está acessível e tente novamente.'
          : 'Erro de conexão. Verifique se o servidor está rodando e acessível.'
        
        throw {
          message: errorMessage,
          status: 0,
          isConnectionError: true,
          originalError: error
        }
      }
      
      // Se já é um objeto de erro do nosso formato
      if (error?.status !== undefined) {
        throw error
      }
      
      // Erro genérico
      if (error instanceof Error) {
        throw { message: error.message, status: 0 }
      }
      
      throw { message: 'Erro desconhecido', status: 0 }
    }
  }

  private async getAuthToken(): Promise<string | null> {
    // Se o backend usar JWT, você pode armazenar o token após login
    // Por enquanto, retorna null ou implementa lógica de token
    const token = localStorage.getItem('auth_token')
    return token
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    })
  }
}

export const apiService = new ApiService()

