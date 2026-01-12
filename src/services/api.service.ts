import { authService } from './auth.service'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

interface ApiError {
  message: string
  status: number
  error?: string
  errors?: Array<{ msg?: string; message?: string; param?: string; location?: string }>
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
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

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
      console.error(`[API CATCH] ${endpoint}:`, error)
      
      // Se for erro de rede (não conseguiu conectar), manter erro específico para tratamento no componente
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError') || error?.name === 'TypeError') {
        throw {
          message: 'Erro de conexão. Verifique se o servidor está rodando.',
          status: 0,
          isConnectionError: true
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

