import { useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import Button from './ui/Button'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from './ui/Toast'

export default function ConnectionErrorScreen() {
  const [isReloading, setIsReloading] = useState(false)
  const toast = useToast()

  const handleReload = async () => {
    // Prevenir múltiplos cliques
    if (isReloading) return
    
    setIsReloading(true)
    
    // Tempo mínimo de animação para dar sensação de que realmente tentou
    const minAnimationTime = 1500 // 1.5 segundos
    const startTime = Date.now()
    
    try {
      // Fazer um "ping" rápido para verificar se o servidor está acessível
      const { API_BASE_URL } = await import('@/config/api')
      const baseURL = API_BASE_URL.replace(/\/api$/, '')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 segundos de timeout
      
      const response = await fetch(`${baseURL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      clearTimeout(timeoutId)
      
      // Calcular quanto tempo passou e aguardar o mínimo necessário
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, minAnimationTime - elapsedTime)
      
      // Se chegou aqui, o servidor está acessível
      if (response.ok) {
        // Aguardar o tempo mínimo antes de recarregar
        await new Promise(resolve => setTimeout(resolve, remainingTime))
        // Limpar qualquer toast existente antes de recarregar
        toast.toasts.forEach(t => toast.removeToast(t.id))
        // Pequeno delay para garantir que os toasts foram removidos
        setTimeout(() => {
          window.location.reload()
        }, 300)
      } else {
        // Servidor respondeu mas com erro
        await new Promise(resolve => setTimeout(resolve, remainingTime))
        setIsReloading(false)
        toast.showToast('Servidor indisponível. Tente novamente em alguns instantes.', 'error')
      }
    } catch (error) {
      // Calcular quanto tempo passou e aguardar o mínimo necessário
      const elapsedTime = Date.now() - startTime
      const remainingTime = Math.max(0, minAnimationTime - elapsedTime)
      
      // Erro de conexão - aguardar tempo mínimo antes de mostrar erro
      await new Promise(resolve => setTimeout(resolve, remainingTime))
      setIsReloading(false)
      toast.showToast('Servidor indisponível. Tente novamente em alguns instantes.', 'error')
    }
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-6">
              <WifiOff className="h-12 w-12 text-destructive" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Sem conexão
            </h1>
            <p className="text-muted-foreground">
              Não foi possível conectar ao servidor. Verifique sua conexão com a internet.
            </p>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleReload}
              disabled={isReloading}
              className="w-full"
            >
              {isReloading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recarregando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar página
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </>
  )
}

