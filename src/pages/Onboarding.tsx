import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone as PhoneIcon, MapPin, UserCircle, ArrowRight, ArrowLeft, Check, Bell, BellOff } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Logo from '@/components/ui/Logo'
import { authService } from '@/services/auth.service'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface OnboardingProps {
  onComplete: () => void
}

type Step = 1 | 2 | 3 | 4

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [city, setCity] = useState('')
  const [location, setLocation] = useState('')
  const [showOtherLocation, setShowOtherLocation] = useState(false)
  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notificationActivated, setNotificationActivated] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)

  // Push notifications hook
  const {
    subscribe: subscribePush,
    isSubscribed: isPushSubscribed,
    isSupported: pushSupported,
    permission: pushPermission,
    isLoading: pushLoading,
    requestPermission: requestPushPermission
  } = usePushNotifications()

  // Detectar ambiente
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as any).standalone === true
  const isIOSPWA = isIOS && isPWA
  const effectivePushSupported = pushSupported || isIOSPWA

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(\d{4})-(\d)(\d{4})/, '$1$2-$3')
      .replace(/(-\d{4})\d+?$/, '$1')
  }

  const handleLocationSelect = (value: string) => {
    if (value === 'Sede') {
      setLocation('Sede')
      setShowOtherLocation(false)
    } else {
      // "Outra" foi selecionada
      setLocation('')
      setShowOtherLocation(true)
      // Focar no input após um pequeno delay
      setTimeout(() => {
        const input = document.getElementById('location-input')
        input?.focus()
      }, 100)
    }
  }

  const handleNext = () => {
    setError('')
    
    if (currentStep === 1) {
      if (!city.trim() || city.trim().length < 2) {
        setError('Por favor, insira sua cidade (mínimo 2 caracteres)')
        return
      }
      // Localidade é sempre obrigatória
      if (!location.trim()) {
        setError('Por favor, selecione "Sede" ou informe outra localidade')
        return
      }
      // Se selecionou "Outra", precisa preencher o nome
      if (showOtherLocation && location.trim().length < 2) {
        setError('Por favor, informe o nome da localidade')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      const phoneNumbers = phone.replace(/\D/g, '')
      if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
        setError('Por favor, insira um telefone válido com DDD')
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      // Apelido é opcional, pode continuar
      setCurrentStep(4)
    }
  }

  const handleBack = () => {
    setError('')
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const handleActivateNotifications = async () => {
    setNotificationLoading(true)
    setError('')
    
    try {
      if (isPushSubscribed) {
        setNotificationActivated(true)
        setNotificationLoading(false)
        return
      }

      // Verificar permissão atual
      const currentPermission = 'Notification' in window ? Notification.permission : 'denied'
      
      if (currentPermission === 'denied' && !isIOSPWA) {
        setError('Permissão negada. Você pode ativar depois nas configurações.')
        setNotificationActivated(false)
        setNotificationLoading(false)
        return
      }

      // Fazer subscribe
      const success = await subscribePush()
      
      if (success) {
        setNotificationActivated(true)
        // Ativar todas as preferências de notificação por padrão
        try {
          await authService.updateNotificationPreferences({
            notifyGoals: true,
            notifyGoalsAllTeams: true,
            notifyGoalsFavoriteTeam: true,
            notifyRoundBets: true,
            notifyRanking: true,
            notifyBell: true,
            notifyToast: true,
            bellRanking: true,
            bellFavoriteTeamMatch: true,
            bellGoalsAllTeams: true,
            bellGoalsFavoriteTeam: true,
            bellRoundBets: true,
            bellMatchStatusAllTeams: true,
            bellMatchStatusFavoriteTeam: true,
            notifyMatchStatusAllTeams: true,
            notifyMatchStatusFavoriteTeam: true
          })
        } catch (prefError) {
          console.error('Erro ao salvar preferências padrão:', prefError)
          // Não bloquear o onboarding se falhar
        }
      } else {
        setError('Não foi possível ativar as notificações. Você pode ativar depois nas configurações.')
        setNotificationActivated(false)
      }
    } catch (error: any) {
      console.error('Erro ao ativar notificações:', error)
      setError('Erro ao ativar notificações. Você pode ativar depois nas configurações.')
      setNotificationActivated(false)
    } finally {
      setNotificationLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (currentStep === 4) {
      setLoading(true)
      try {
        // Combinar cidade e localidade no formato "Cidade - Localidade"
        // Localidade é sempre obrigatória
        let cityWithLocation: string
        
        if (location.trim().toLowerCase() === 'sede') {
          cityWithLocation = `${city.trim()} - Sede`
        } else {
          cityWithLocation = `${city.trim()} - ${location.trim()}`
        }

        const phoneNumbers = phone.replace(/\D/g, '')
        
        // Atualizar perfil com telefone, cidade+localidade e apelido, e definir needsOnboarding = false
        await authService.updateProfile({
          phone: phoneNumbers,
          city: cityWithLocation,
          nickname: nickname.trim() || undefined,
          needsOnboarding: false
        })
        onComplete()
      } catch (error: any) {
        setError(error?.message || 'Erro ao salvar informações. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
  }

  const steps = [
    { number: 1, title: 'Localização', icon: MapPin },
    { number: 2, title: 'Contato', icon: PhoneIcon },
    { number: 3, title: 'Apelido', icon: UserCircle },
    { number: 4, title: 'Notificações', icon: Bell }
  ]

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'De onde você é?'
      case 2:
        return 'Qual seu WhatsApp?'
      case 3:
        return 'Como prefere ser chamado?'
      case 4:
        return 'Ativar Notificações'
      default:
        return 'Complete seu perfil'
    }
  }

  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return 'Precisamos saber sua cidade e localidade'
      case 2:
        return 'Vamos te avisar quando você ficar em primeiro lugar!'
      case 3:
        return 'Este campo é opcional, pode pular se quiser'
      case 4:
        return 'Receba notificações sobre ranking, resultados e muito mais!'
      default:
        return ''
    }
  }

  return (
    <div 
      className="flex flex-col px-4 py-4" 
      style={{ 
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md md:max-w-2xl mx-auto flex flex-col items-center py-4"
        style={{ flex: '1 1 auto', minHeight: 0 }}
      >
        {/* Header com Logo e Bem-vindo */}
        <div className="text-center mb-6 md:mb-8 flex-shrink-0">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="mb-3 md:mb-4"
          >
            <Logo size="md" showStars={true} animateStars={true} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-xl font-semibold text-foreground mb-1 md:mb-2"
          >
            Bem-vindo!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xs md:text-sm text-muted-foreground"
          >
            Vamos configurar seu perfil em alguns passos
          </motion.p>
        </div>

        {/* Indicador de progresso */}
        <div className="mb-6 md:mb-8 w-full flex-shrink-0">
          <div className="flex items-center justify-center mb-4 gap-1 md:gap-2 overflow-x-auto pb-2 pt-2 -mx-2 px-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon
              const isActive = currentStep === step.number
              const isCompleted = currentStep > step.number
              
              return (
                <div key={step.number} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center min-w-[60px] md:min-w-[70px] max-w-[80px]">
                    <motion.div
                      className={`flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'border-primary bg-primary/20 text-primary'
                          : 'border-muted-foreground/30 bg-secondary text-muted-foreground'
                      }`}
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {isCompleted ? (
                        <Check className="h-4 w-4 md:h-5 md:w-5" />
                      ) : (
                        <StepIcon className="h-4 w-4 md:h-5 md:w-5" />
                      )}
                    </motion.div>
                    <span className={`text-[10px] md:text-xs mt-1.5 md:mt-2 text-center whitespace-nowrap px-0.5 ${
                      isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-6 md:w-8 lg:w-12 h-0.5 mx-1 md:mx-2 flex-shrink-0 ${
                      isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Barra de progresso */}
          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${(currentStep / steps.length) * 100}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Conteúdo do formulário */}
        <div className="text-center mb-6 md:mb-8 flex-shrink-0">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="text-lg md:text-xl font-bold mb-2 md:mb-3">{getStepTitle()}</h1>
            <p className="text-muted-foreground text-xs md:text-sm">{getStepDescription()}</p>
          </motion.div>
        </div>

        <form onSubmit={currentStep === 4 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-4 md:space-y-6 w-full" style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {/* Etapa 1: Cidade e Localidade */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="city" className="block text-sm font-medium mb-2.5 text-left">
                    Cidade *
                  </label>
                  <div className="relative w-full">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                    <Input
                      id="city"
                      type="text"
                      placeholder="Ex: Brotas de Macaubas"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="pl-10 w-full"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Campo de localidade - sempre obrigatório */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium mb-2.5 text-left">
                    Localidade *
                  </label>
                  <div className="space-y-2 w-full">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button
                        type="button"
                        variant={location === 'Sede' ? 'primary' : 'outline'}
                        onClick={() => handleLocationSelect('Sede')}
                        className="w-full"
                      >
                        Sede
                      </Button>
                      <Button
                        type="button"
                        variant={showOtherLocation ? 'primary' : 'outline'}
                        onClick={() => handleLocationSelect('Outra')}
                        className="w-full"
                      >
                        Outra
                      </Button>
                    </div>
                    {showOtherLocation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="w-full mt-3"
                      >
                        <Input
                          id="location-input"
                          type="text"
                          placeholder="Digite o distrito ou localidade"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full"
                          autoFocus
                          required
                          minLength={2}
                        />
                      </motion.div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-left">
                    Selecione "Sede" ou informe outra localidade do município
                  </p>
                </div>
              </motion.div>
            )}

            {/* Etapa 2: Telefone */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2.5 text-left">
                    WhatsApp *
                  </label>
                  <div className="relative w-full">
                    <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 98765-4321"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="pl-10 w-full"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-left">
                    Te avisaremos quando você ficar em primeiro lugar no ranking!
                  </p>
                </div>
              </motion.div>
            )}

            {/* Etapa 3: Apelido */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <label htmlFor="nickname" className="block text-sm font-medium mb-2.5 text-left">
                    Apelido <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <div className="relative w-full">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                    <Input
                      id="nickname"
                      type="text"
                      placeholder="Como prefere ser chamado?"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="pl-10 w-full"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-left">
                    Este campo é opcional, pode deixar em branco
                  </p>
                </div>
              </motion.div>
            )}

            {/* Etapa 4: Notificações */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {effectivePushSupported ? (
                  <>
                    <div className="text-center space-y-4">
                      <div className="flex justify-center">
                        {notificationActivated || isPushSubscribed ? (
                          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                            <Bell className="h-10 w-10 text-primary" />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <BellOff className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {notificationActivated || isPushSubscribed ? (
                        <p className="text-base text-foreground">
                          ✅ Notificações ativadas!
                        </p>
                      ) : null}
                    </div>
                    {!(notificationActivated || isPushSubscribed) && (
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        onClick={handleActivateNotifications}
                        disabled={notificationLoading || pushLoading}
                        className="w-full"
                      >
                        {notificationLoading || pushLoading ? (
                          <>
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                            Ativando...
                          </>
                        ) : (
                          <>
                            <Bell className="h-4 w-4 mr-2" />
                            Ativar Notificações
                          </>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                        <BellOff className="h-10 w-10 text-muted-foreground" />
                      </div>
                    </div>
                    <div>
                      <p className="text-base text-foreground mb-2">
                        Notificações não estão disponíveis no seu navegador
                      </p>
                      {isMobile && !isPWA && (
                        <div className="text-sm text-muted-foreground space-y-3 text-left max-w-sm mx-auto bg-secondary/50 p-4 rounded-lg">
                          <p className="font-medium mb-3">💡 Instale como app para receber notificações:</p>
                          <div className="space-y-4">
                            <div>
                              <p className="font-medium mb-1">📱 <strong>iPhone/iPad:</strong></p>
                              <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                                <li>Toque no botão de compartilhar <span className="font-mono">□↑</span></li>
                                <li>Selecione "Adicionar à Tela de Início"</li>
                                <li>Abra o app da tela inicial</li>
                              </ol>
                            </div>
                            <div>
                              <p className="font-medium mb-1">🤖 <strong>Android:</strong></p>
                              <ol className="list-decimal list-inside space-y-1 ml-2 text-xs">
                                <li>Toque no menu <span className="font-mono">⋮</span> (três pontos)</li>
                                <li>Selecione "Adicionar à tela inicial" ou "Instalar app"</li>
                                <li>Confirme a instalação</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}
                      {!isMobile && (
                        <p className="text-sm text-muted-foreground">
                          Use um navegador moderno ou instale como app no mobile para receber notificações
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={handleSubmit}
                      className="w-full"
                    >
                      Continuar sem ativar
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2"
            >
              <p className="text-sm text-red-400 text-center">{error}</p>
            </motion.div>
          )}

          {/* Botões de navegação */}
          <div className="flex gap-3 pt-6 md:pt-8 flex-shrink-0 mt-auto">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleBack}
                disabled={loading}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                loading || 
                (currentStep === 1 && (
                  !city.trim() || 
                  !location.trim() ||
                  (showOtherLocation && location.trim().length < 2)
                )) || 
                (currentStep === 2 && !phone.replace(/\D/g, ''))
              }
              size="lg"
              className="flex-1"
            >
              {loading ? 'Salvando...' : currentStep === 4 ? 'Finalizar' : 'Continuar'}
              {currentStep < 4 && <ArrowRight className="ml-2 h-5 w-5" />}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
