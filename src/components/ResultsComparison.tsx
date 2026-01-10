import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import TeamLogo from '@/components/ui/TeamLogo'
import { Match } from '@/types'
import { getTeamDisplayName } from '@/lib/teamNames'

interface Prediction {
  matchId: string
  homeScore: number
  awayScore: number
}

interface ResultsComparisonProps {
  predictions: Prediction[]
  matches: Match[]
  pointsByMatch?: Array<{ matchId: string; points: number }> // Pontos calculados pelo backend
}

export default function ResultsComparison({ predictions, matches, pointsByMatch = [] }: ResultsComparisonProps) {
  // Usar apenas pontos calculados pelo backend - não calcular no frontend

  const getPointColor = (points: number) => {
    if (points === 3) return 'text-green-400'
    if (points === 1) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getResultIcon = (points: number) => {
    if (points === 3) return <Check className="h-5 w-5 text-green-400" />
    if (points === 1) return <Check className="h-5 w-5 text-yellow-400" />
    return <X className="h-5 w-5 text-red-400" />
  }

  return (
    <div className="space-y-3">
      {predictions.map((pred, idx) => {
        const match = matches.find(m => m.id === pred.matchId)
        if (!match) return null

        // Buscar pontos do backend - não calcular no frontend
        const points = pointsByMatch.find(p => p.matchId === pred.matchId)?.points ?? 0

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="rounded-lg bg-secondary/40 p-3"
          >
            {/* Resultado Real */}
            <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Resultado Real
            </div>
            <div className="flex items-center justify-center gap-2 mb-3">
              {/* Time Casa */}
              <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                <span className="font-semibold text-right truncate text-sm">{getTeamDisplayName(match.homeTeam)}</span>
                <div className="flex-shrink-0">
                  <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" />
                </div>
              </div>
              
              {/* Placar Real */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-bold text-base text-center w-6">
                  {match.homeScore ?? '-'}
                </span>
                <span className="text-muted-foreground">x</span>
                <span className="font-bold text-base text-center w-6">
                  {match.awayScore ?? '-'}
                </span>
              </div>
              
              {/* Time Visitante */}
              <div className="flex-1 flex items-center justify-start gap-1.5 min-w-0">
                <div className="flex-shrink-0">
                  <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" />
                </div>
                <span className="font-semibold text-left truncate text-sm">{getTeamDisplayName(match.awayTeam)}</span>
              </div>
            </div>

            {/* Seu Palpite */}
            <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Seu Palpite
            </div>
            <div className="flex items-center justify-center gap-2 mb-3">
              {/* Time Casa */}
              <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                <span className="font-semibold text-right truncate text-sm text-primary/80">{match.homeTeam}</span>
                <div className="flex-shrink-0">
                  <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" />
                </div>
              </div>
              
              {/* Placar Palpite */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-bold text-base text-center w-6 text-primary/80">
                  {pred.homeScore}
                </span>
                <span className="text-muted-foreground">x</span>
                <span className="font-bold text-base text-center w-6 text-primary/80">
                  {pred.awayScore}
                </span>
              </div>
              
              {/* Time Visitante */}
              <div className="flex-1 flex items-center justify-start gap-1.5 min-w-0">
                <div className="flex-shrink-0">
                  <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" />
                </div>
                <span className="font-semibold text-left truncate text-sm text-primary/80">{match.awayTeam}</span>
              </div>
            </div>

            {/* Pontos */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-primary/20">
              {getResultIcon(points)}
              <span className={`font-semibold ${getPointColor(points)}`}>
                {points === 3 && 'Placar Exato! +3 pontos'}
                {points === 1 && 'Vencedor Correto +1 ponto'}
                {points === 0 && 'Não acertou'}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
