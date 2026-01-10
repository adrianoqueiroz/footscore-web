import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Phone as PhoneIcon, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
import { authService } from '@/services/auth.service'
import { useToastContext } from '@/contexts/ToastContext'

export default function EditPhone() {
  const navigate = useNavigate()
  const toast = useToastContext()
  const user = authService.getCurrentUser()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.phone) {
      setPhone(formatPhone(user.phone))
    }
  }, [user])

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
      await authService.updateProfile({ phone: phoneNumbers })
      toast.success('Telefone atualizado com sucesso!')
      navigate(-1)
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao salvar telefone. Tente novamente.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center bg-background/95 bg-grid-small-white/[0.07] min-h-0">
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="rounded-full h-10 w-10 p-0 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold flex-1">Editar Telefone</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6">
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center"
              >
                <PhoneIcon className="h-8 w-8 text-primary-foreground" />
              </motion.div>
              <p className="text-muted-foreground text-sm">
                Atualize seu número de WhatsApp
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="tel"
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="text-center text-lg"
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-400 text-center">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading || !phone}
                size="lg"
                className="w-full"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

