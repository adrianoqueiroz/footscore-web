/**
 * Configuração centralizada da API
 * 
 * Esta função resolve a URL da API baseada em:
 * 1. Variável de ambiente VITE_API_BASE_URL (se definida)
 * 2. Detecção automática do ambiente
 * 3. Fallback para localhost
 */

// IP da rede local - pode ser sobrescrito via variável de ambiente
const LOCAL_NETWORK_IP = import.meta.env.VITE_LOCAL_NETWORK_IP || '192.168.0.16'
const BACKEND_PORT = import.meta.env.VITE_BACKEND_PORT || '3000'

/**
 * Detecta se está rodando em desenvolvimento local
 */
function isLocalDevelopment(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE === 'development'
}

/**
 * Detecta se está acessando via IP da rede local (celular, outro dispositivo)
 */
function isAccessingViaNetworkIP(): boolean {
  if (typeof window === 'undefined') return false
  
  const hostname = window.location.hostname
  // Se o hostname é um IP (não localhost), está acessando via rede
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
}

/**
 * Obtém a URL base da API
 */
export function getApiBaseUrl(): string {
  // 1. Se VITE_API_BASE_URL está definida, usar ela (prioridade máxima)
  const envApiUrl = import.meta.env.VITE_API_BASE_URL
  if (envApiUrl && envApiUrl.trim() !== '') {
    console.log('[API Config] Usando VITE_API_BASE_URL da variável de ambiente:', envApiUrl)
    return envApiUrl.trim()
  }

  // 2. Se está em desenvolvimento local
  if (isLocalDevelopment()) {
    // Se está acessando via IP da rede (ex: celular), usar IP da rede
    if (typeof window !== 'undefined' && isAccessingViaNetworkIP()) {
      const currentHost = window.location.hostname
      const autoUrl = `http://${currentHost}:${BACKEND_PORT}/api`
      console.log('[API Config] Detecção automática via IP da rede:', autoUrl)
      return autoUrl
    }
    
    // Caso contrário, usar localhost
    const localhostUrl = `http://localhost:${BACKEND_PORT}/api`
    console.log('[API Config] Usando localhost:', localhostUrl)
    return localhostUrl
  }

  // 3. Fallback padrão
  const fallbackUrl = `http://localhost:${BACKEND_PORT}/api`
  console.log('[API Config] Usando fallback:', fallbackUrl)
  return fallbackUrl
}

/**
 * URL base da API (valor resolvido)
 */
export const API_BASE_URL = getApiBaseUrl()

// Log para debug (apenas em desenvolvimento)
if (isLocalDevelopment()) {
  console.log(`🔗 API Base URL configurada: ${API_BASE_URL}`)
  if (typeof window !== 'undefined') {
    console.log(`📍 Hostname atual: ${window.location.hostname}`)
    console.log(`🌐 URL completa: ${window.location.href}`)
    if (isAccessingViaNetworkIP()) {
      console.log(`📱 Acessando via rede local (IP detectado)`)
    } else {
      console.log(`💻 Acessando via localhost`)
    }
  }
  console.log(`🔧 Variáveis de ambiente:`)
  console.log(`   - VITE_API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL || '(não definida)'}`)
  console.log(`   - VITE_LOCAL_NETWORK_IP: ${import.meta.env.VITE_LOCAL_NETWORK_IP || '(não definida)'}`)
  console.log(`   - VITE_BACKEND_PORT: ${import.meta.env.VITE_BACKEND_PORT || '(não definida)'}`)
}
