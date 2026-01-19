import { motion } from 'framer-motion'
import { Radio, CheckCircle2, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Match } from '@/types'
import { cn, parseMatchDateTime } from '@/lib/utils'
import { getTeamDisplayName } from '@/lib/teamNames'
import TeamLogo from './TeamLogo'
import Card from './Card'

interface MatchCardProps {
  match: Match
  onClick?: () => void
  index?: number
  className?: string
  showFullDate?: boolean // Se false, mostra apenas hora quando há agrupamento por data
}

export default function MatchCard({ match, onClick, index = 0, className, showFullDate = true }: MatchCardProps) {
  const statusType = match.status || 'scheduled'
  const isLive = statusType === 'live'
  const isFinished = statusType === 'finished'
  const isScheduled = statusType === 'scheduled' || !statusType

  const hasScore = match.homeScore !== undefined && match.awayScore !== undefined
  const scoreDisplay = hasScore ? `${match.homeScore} × ${match.awayScore}` : null
  const showScore = hasScore && (isLive || isFinished)

  const matchDate = parseMatchDateTime(match)
  const dateDisplay = matchDate
    ? {
        dayOfWeek: format(matchDate, 'EEE', { locale: ptBR }),
        date: format(matchDate, 'dd/MM'),
        time: format(matchDate, 'HH:mm', { locale: ptBR }),
        fullDate: format(matchDate, 'dd/MM HH:mm', { locale: ptBR }),
      }
    : null

  // Determinar classes CSS baseadas no status do jogo
  const cardClasses = isLive
    ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-lg'
    : isFinished
    ? 'border-2 border-green-400 bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-lg'
    : ''

  const isClickable = !!onClick

  return (
    <Card
      className={cn(
        'p-4 transition-all duration-200',
        cardClasses,
        isClickable && 'cursor-pointer hover:shadow-xl active:scale-[0.98]',
        className
      )}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: Math.min(index * 0.01, 0.1),
          duration: 0.2,
          ease: 'easeOut',
        }}
      >
        {/* Header com data/hora centralizada e status à direita */}
        <div className="flex items-center justify-between mb-3">
          {/* Espaçador à esquerda para balancear */}
          <div className="flex-1" />
          
          {/* Data/hora centralizada */}
          {dateDisplay && (
            <div className="flex items-center justify-center flex-1">
              {showFullDate ? (
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'text-[11px] font-semibold uppercase tracking-wide',
                      isLive && 'text-yellow-300',
                      isFinished && 'text-green-300',
                      isScheduled && 'text-muted-foreground'
                    )}
                  >
                    {dateDisplay.dayOfWeek}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isLive && 'text-yellow-300',
                      isFinished && 'text-green-300',
                      isScheduled && 'text-foreground'
                    )}
                  >
                    {dateDisplay.fullDate}
                  </span>
                </div>
              ) : (
                <span
                  className={cn(
                    'text-sm font-medium',
                    isLive && 'text-yellow-300',
                    isFinished && 'text-green-300',
                    isScheduled && 'text-foreground'
                  )}
                >
                  {dateDisplay.time}
                </span>
              )}
            </div>
          )}

          {/* Badge de status à direita */}
          <div className="flex items-center flex-1 justify-end">
            {isLive && (
              <span className="px-2 py-0.5 rounded-full bg-yellow-500/30 border border-yellow-400/50 text-yellow-300 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                <Radio className="h-2.5 w-2.5 animate-pulse" />
                AO VIVO
              </span>
            )}
            {isFinished && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/30 border border-green-400/50 text-green-300 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                FINALIZADO
              </span>
            )}
            {isScheduled && (
              <span className="px-2 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground text-[10px] font-medium uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                AGENDADO
              </span>
            )}
          </div>
        </div>

        {/* Conteúdo principal: Times e placar */}
        <div className="flex items-center justify-between gap-3">
          {/* Time casa */}
          <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            <TeamLogo
              teamName={match.homeTeam}
              logo={match.homeTeamLogo}
              size="md"
              className="h-10 w-10 mb-1.5"
              noCircle
            />
            <span
              className={cn(
                'text-sm font-semibold truncate text-center leading-tight max-w-[6rem]',
                isLive && 'text-yellow-300',
                isFinished && 'text-green-300',
                isScheduled && 'text-foreground'
              )}
            >
              {getTeamDisplayName(match.homeTeam)}
            </span>
          </div>

          {/* Placar centralizado - mais destacado */}
          <div className="flex-shrink-0 min-w-[70px] flex items-center justify-center">
            <span
              className={cn(
                'text-2xl font-bold text-center',
                showScore && scoreDisplay
                  ? isLive
                    ? 'text-yellow-300'
                    : isFinished
                    ? 'text-green-300'
                    : 'text-foreground'
                  : 'text-muted-foreground/40'
              )}
            >
              {showScore && scoreDisplay ? scoreDisplay : '0 × 0'}
            </span>
          </div>

          {/* Time visitante */}
          <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            <TeamLogo
              teamName={match.awayTeam}
              logo={match.awayTeamLogo}
              size="md"
              className="h-10 w-10 mb-1.5"
              noCircle
            />
            <span
              className={cn(
                'text-sm font-semibold truncate text-center leading-tight max-w-[6rem]',
                isLive && 'text-yellow-300',
                isFinished && 'text-green-300',
                isScheduled && 'text-foreground'
              )}
            >
              {getTeamDisplayName(match.awayTeam)}
            </span>
          </div>
        </div>
      </motion.div>
    </Card>
  )
}
