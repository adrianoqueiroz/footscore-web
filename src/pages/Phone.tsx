import { useState } from 'react'
import { motion } from 'framer-motion'
import { Phone as PhoneIcon, ArrowRight } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { authService } from '@/services/auth.service'

interface PhoneProps {
  onComplete: () => void
}

export default function Phone({ onComplete }: PhoneProps) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(\d{4})-(\d)(\d{4})/, '$1$2-$3')
      .replace(/(-\d{4})\d+?$/, '$1')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const phoneNumbers = phone.replace(/\D/g, '')
    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      setError('Por favor, insira um telefone válido com DDD')
      return
    }

    setLoading(true)
    try {
      await authService.savePhone(phoneNumbers)
      onComplete()
    } catch (error) {
      setError('Erro ao salvar telefone. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md md:max-w-2xl"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center"
          >
            <PhoneIcon className="h-10 w-10 text-primary-foreground" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Cadastre seu WhatsApp</h1>
          <p className="text-muted-foreground">
            Precisamos do seu número para enviar os palpites
          </p>
          <p className="text-xs text-muted-foreground/50 mt-2">
            (você poderá editar esta informação depois)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Input
              type="tel"
              placeholder="(11) 98765-4321"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="text-center text-lg"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              type="submit"
              disabled={loading || !phone}
              size="lg"
              className="w-full"
            >
              {loading ? 'Salvando...' : 'Continuar'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </div>
  )
}

