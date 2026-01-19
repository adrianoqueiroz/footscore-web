import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import { authService } from '@/services/auth.service'
import { useNavigate, Link } from 'react-router-dom'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Logo from '@/components/ui/Logo'
import { useToastContext } from '@/contexts/ToastContext'

export default function Login() {
  const [googleLoading, setGoogleLoading] = useState(false) // Renamed for clarity
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToastContext()

  // Verificar se usuário já está logado e redirecionar
  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate('/rounds', { replace: true })
    }
  }, [navigate])

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      console.error('No credential received')
      toast.error('Erro ao fazer login. Tente novamente.')
      return
    }

    setGoogleLoading(true)
    try {
      await authService.loginWithGoogle(credentialResponse.credential)
      navigate('/')
    } catch (error: any) {
      console.error('Google login error:', error)
      
      // Verificar se é erro de conexão/timeout
      const isConnectionError = 
        error?.status === 0 ||
        error?.isConnectionError === true ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('Connection terminated') ||
        error?.name === 'TypeError' ||
        error?.name === 'AbortError'
      
      if (isConnectionError) {
        const { API_BASE_URL } = await import('@/config/api')
        toast.error(
          `Erro de conexão com o servidor.\n\n` +
          `Verifique se:\n` +
          `- O backend está rodando\n` +
          `- A URL está correta: ${API_BASE_URL}\n` +
          `- Você está na mesma rede Wi-Fi\n\n` +
          `Tente novamente.`,
          8000
        )
      } else {
        const errorMessage = error?.message || 'Erro ao fazer login com Google. Tente novamente.'
        toast.error(errorMessage)
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleGoogleError = () => {
    console.error('Google login failed')
    toast.error('Erro ao fazer login com Google. Tente novamente.')
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      console.log('[Login] Iniciando login para:', email);
      const response = await authService.login({ email, password });
      console.log('[Login] Login bem-sucedido:', response);
      
      // Verificar se o usuário foi salvo corretamente
      const savedUser = authService.getCurrentUser();
      if (!savedUser) {
        console.error('[Login] ERRO: Usuário não foi salvo após login bem-sucedido');
        toast.error('Erro ao salvar dados do usuário. Tente novamente.');
        return;
      }
      
      console.log('[Login] Usuário salvo:', savedUser);
      console.log('[Login] needsOnboarding:', savedUser.needsOnboarding);
      
      // Forçar atualização do router
      window.dispatchEvent(new Event('user-login'));
      
      // Pequeno delay para garantir que o router atualizou
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 100);
    } catch (error: any) {
      console.error('[Login] Erro completo:', error);
      console.error('[Login] Status:', error?.status);
      console.error('[Login] Message:', error?.message);
      console.error('[Login] Error name:', error?.name);
      
      // Verificar se é erro de conexão/timeout
      const isConnectionError = 
        error?.status === 0 ||
        error?.isConnectionError === true ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('Connection terminated') ||
        error?.name === 'TypeError' ||
        error?.name === 'AbortError'
      
      // Verificar se é erro de banco de dados
      if (error?.status === 503 && error?.isDatabaseError === true) {
        if (error?.isAzure === true) {
          toast.error(
            `🔥 Firewall do Azure bloqueando conexão.\n\n` +
            `Seu IP atual não está nas regras de firewall do Azure PostgreSQL.\n\n` +
            `Solução:\n` +
            `1. Execute no backend: npm run get-my-ip\n` +
            `2. Acesse portal.azure.com\n` +
            `3. Vá em PostgreSQL > Networking\n` +
            `4. Adicione seu IP nas regras de firewall\n\n` +
            `Consulte TROUBLESHOOTING_AZURE_FIREWALL.md`,
            12000
          )
        } else {
          toast.error(
            `⚠️ Banco de dados não está acessível.\n\n` +
            `O servidor não consegue se conectar ao PostgreSQL.\n\n` +
            `Verifique se:\n` +
            `- O PostgreSQL está rodando\n` +
            `- A configuração do banco está correta\n` +
            `- Execute: npm run test:db-connection (no backend)\n\n` +
            `Consulte TROUBLESHOOTING_DB.md para mais detalhes.`,
            10000
          )
        }
      } else if (isConnectionError) {
        const { API_BASE_URL } = await import('@/config/api')
        toast.error(
          `Erro de conexão com o servidor.\n\n` +
          `Verifique se:\n` +
          `- O backend está rodando\n` +
          `- A URL está correta: ${API_BASE_URL}\n` +
          `- Você está na mesma rede Wi-Fi\n\n` +
          `Tente novamente.`,
          8000
        )
      } else {
        // Mostrar mensagem de erro mais detalhada
        let errorMessage = error?.message || 'Erro ao fazer login. Verifique suas credenciais.';
        
        // Se for erro 401, é credencial inválida
        if (error?.status === 401) {
          errorMessage = 'Email ou senha incorretos. Verifique suas credenciais.';
        } else if (error?.status === 400) {
          errorMessage = error?.message || 'Dados inválidos. Verifique o formulário.';
        }
        
        toast.error(errorMessage);
      }
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center px-4" style={{ overflow: 'hidden' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md md:max-w-2xl py-4"
        style={{ 
          overflowY: 'auto',
          overflowX: 'hidden',
          maxHeight: '100vh',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-3"
          >
            <Logo size="lg" animateStars={true} />
          </motion.div>
          <p className="text-sm text-muted-foreground px-2 leading-relaxed">
            Faça seus palpites e dispute pelo topo do ranking com seus amigos!
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex justify-center mb-4"> {/* Added margin-bottom */}
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="filled_black"
              size="large"
              text="signin_with"
              shape="rectangular"
              locale="pt-BR"
            />
          </div>
          {googleLoading && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Entrando com Google...
            </p>
          )}

          <div className="relative my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="mx-4 flex-shrink text-gray-400">ou</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={formLoading}
            />
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={formLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={formLoading}>
              {formLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-primary hover:underline">
              Registre-se
            </Link>
          </p>

        </motion.div>
      </motion.div>
    </div>
  )
}

