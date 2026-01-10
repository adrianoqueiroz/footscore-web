import { useState } from 'react'
import { motion } from 'framer-motion'
import { authService } from '@/services/auth.service'
import { useNavigate, Link } from 'react-router-dom'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Logo from '@/components/ui/Logo'
import { useToastContext } from '@/contexts/ToastContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const toast = useToastContext()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authService.register({ name, email, phone: phone || undefined, city, nickname: nickname || undefined, password })
      navigate('/') // Redirect to home or login page after successful registration
    } catch (error: any) {
      console.error('Registration error:', error)
      const errorMessage = error?.message || 'Erro ao registrar. Tente novamente.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center px-4" style={{ overflow: 'hidden' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md md:max-w-2xl"
        style={{ 
          overflowY: 'auto',
          overflowX: 'hidden',
          maxHeight: '100vh',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="text-center mb-8 pt-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <Logo size="lg" animateStars={true} />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Criar Conta</h1>
          <p className="text-sm text-muted-foreground">
            Crie sua conta para começar a palpitar!
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="name"
              type="text"
              placeholder="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              id="phone"
              type="tel" // Use type="tel" for phone numbers
              placeholder="Telefone (opcional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
            <Input
              id="city"
              type="text"
              placeholder="Cidade *"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              id="nickname"
              type="text"
              placeholder="Apelido (opcional)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
            />
            <Input
              id="password"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Faça Login
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
