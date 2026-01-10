import { motion } from 'framer-motion'
import Card from '@/components/ui/Card'
import Logo from '@/components/ui/Logo'
import { Heart, Users, Lock, Zap } from 'lucide-react'
import { useState } from 'react'
import { useMatchEvents } from '@/hooks/useMatchEvents'
import PulsingBall from '@/components/ui/PulsingBall'
import ContentWrapper from '@/components/ui/ContentWrapper'

export default function About() {
  const [showPulsingBall, setShowPulsingBall] = useState(false)
  const [lastScoreUpdate, setLastScoreUpdate] = useState<{ homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; goalScorer?: 'home' | 'away' | null; isGoalCancelled?: boolean; homeTeamLogo?: string | null; awayTeamLogo?: string | null } | null>(null)

  // Conectar ao SSE para receber atualizações de placar
  useMatchEvents((event) => {
    if (event.type === 'score_update' && event.data.scoreChanged) {
      // Atualizar matchInfo e mostrar bola pulsando
      const matchInfo = {
        homeTeam: event.data.homeTeam,
        awayTeam: event.data.awayTeam,
        homeScore: event.data.homeScore,
        awayScore: event.data.awayScore,
        goalScorer: event.data.goalScorer,
        isGoalCancelled: event.data.isGoalCancelled || false,
        homeTeamLogo: event.data.homeTeamLogo || null,
        awayTeamLogo: event.data.awayTeamLogo || null,
      }
      
      // Atualizar matchInfo primeiro
      setLastScoreUpdate(matchInfo)
      
      // Aguardar um pouco para garantir que o estado foi atualizado, depois mostrar
      // Usar requestAnimationFrame para garantir que o estado foi atualizado
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowPulsingBall(false)
          setTimeout(() => {
            setShowPulsingBall(true)
          }, 20)
        })
      })
    }
  })

  const features = [
    {
      icon: <Users className="h-6 w-6 text-primary" />,
      title: 'Para Grupos de Amigos',
      description: 'Gerencia os palpites de futebol do seu grupo de forma simples e organizada'
    },
    {
      icon: <Lock className="h-6 w-6 text-primary" />,
      title: 'Completamente Gratuito',
      description: 'O FootScore não cobra nada pelos palpites. É 100% grátis para você e seus amigos'
    },
    {
      icon: <Zap className="h-6 w-6 text-primary" />,
      title: 'Rápido e Simples',
      description: 'Interface intuitiva para criar palpites, visualizar resultados e acompanhar pontuações'
    },
    {
      icon: <Heart className="h-6 w-6 text-primary" />,
      title: 'Feito com Paixão',
      description: 'Desenvolvido por apaixonados por futebol para apaixonados por futebol'
    }
  ]

  return (
    <ContentWrapper>
      <PulsingBall
        show={showPulsingBall}
        matchInfo={lastScoreUpdate || undefined}
        onClick={() => setShowPulsingBall(false)}
      />
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <div className="mb-2">
            <Logo size="lg" animateStars={true} />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            O gerenciador de palpites para seu grupo de futebol
          </p>
          <p className="text-xs text-muted-foreground/80 mt-1">
            Dispute pelo topo do ranking e mostre quem entende mais de futebol!
          </p>
        </motion.div>

        {/* About Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <div className="space-y-3">
              <h2 className="text-lg font-bold">O que é FootScore?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                FootScore é uma plataforma gratuita e simples para gerenciar palpites de futebol com seus amigos. 
                Crie rodadas, faça seus palpites, acompanhe os resultados em tempo real e dispute pelo topo do ranking!
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Features */}
        <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.05 }}
            >
              <Card>
                <div className="flex gap-3">
                  <div className="flex-shrink-0">{feature.icon}</div>
                  <div>
                    <h3 className="font-semibold text-sm">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Pricing Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-green-500/50 bg-green-500/10">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-green-400">Sem Custos</h2>
              <p className="text-sm text-green-400/80">
                O FootScore é completamente gratuito. Não há cobranças, não há limite de palpites, não há pegadinhas. 
                Apenas um sistema honesto para você e seus amigos se divertirem.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* How it Works */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card>
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Como Funciona?</h2>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li><strong className="text-foreground">1.</strong> Um admin cria uma nova rodada com os jogos</li>
                <li><strong className="text-foreground">2.</strong> Você faz seus palpites nos jogos que desejar</li>
                <li><strong className="text-foreground">3.</strong> Admin atualiza os resultados dos jogos</li>
                <li><strong className="text-foreground">4.</strong> Seus pontos são calculados automaticamente</li>
                <li><strong className="text-foreground">5.</strong> Dispute pelo topo do ranking e mostre quem é o melhor!</li>
              </ol>
            </div>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground pt-4"
        >
          <p>Feito com ⚽ e ❤️ por apaixonados por futebol</p>
        </motion.div>
      </div>
    </ContentWrapper>
  )
}
