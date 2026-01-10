import TeamLogo from './ui/TeamLogo'
import { Match } from '@/types'
import { getTeamDisplayName } from '@/lib/teamNames'

interface MatchHeaderProps {
  match: Match
  showDate?: boolean
  showTime?: boolean
  compact?: boolean
}

export default function MatchHeader({ match, showDate = false, showTime = false, compact = false }: MatchHeaderProps) {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'mb-3' : 'mb-4'}`}>
      {/* Nome time 1 */}
      <div className="flex-1 flex justify-end pr-2 min-w-0">
        <span className={`font-semibold truncate text-foreground text-right ${compact ? 'text-xs' : 'text-sm'}`}>
          {getTeamDisplayName(match.homeTeam)}
        </span>
      </div>
      
      {/* Escudos alinhados fixamente no centro */}
      <div className={`flex items-center gap-1 justify-center flex-shrink-0 ${compact ? 'w-[88px]' : 'w-[100px]'}`}>
        <TeamLogo teamName={match.homeTeam} logo={match.homeTeamLogo} size="sm" className="h-7 w-7" noCircle />
        <span className={`text-muted-foreground/60 flex-shrink-0 font-medium ${compact ? 'text-xs' : 'text-sm'}`}>×</span>
        <TeamLogo teamName={match.awayTeam} logo={match.awayTeamLogo} size="sm" className="h-7 w-7" noCircle />
      </div>
      
      {/* Nome time 2 */}
      <div className="flex-1 flex justify-start pl-2 min-w-0">
        <span className={`font-semibold truncate text-foreground text-left ${compact ? 'text-xs' : 'text-sm'}`}>
          {getTeamDisplayName(match.awayTeam)}
        </span>
      </div>
      
      {(showDate || showTime) && (
        <div className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
          {showDate && new Date(`${match.date}T${match.time}`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          {showDate && showTime && ' • '}
          {showTime && match.time}
        </div>
      )}
    </div>
  )
}

