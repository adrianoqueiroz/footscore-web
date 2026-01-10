/**
 * Mapeamento de nomes normalizados (sem acentos) para nomes com acentos para exibição
 */
const TEAM_DISPLAY_NAMES: Record<string, string> = {
  'Sao Paulo': 'São Paulo',
  'Gremio': 'Grêmio',
  'Atletico-MG': 'Atlético-MG',
  'Athletico-PR': 'Athletico-PR',
  'Vitoria': 'Vitória',
  'Atletico Paranaense': 'Atlético Paranaense',
  'Atletico Mineiro': 'Atlético Mineiro',
  'Atletico MG': 'Atlético-MG',
  'Atletico PR': 'Athletico-PR',
}

/**
 * Retorna o nome do time com acentos para exibição
 * @param teamName - Nome do time normalizado (sem acentos)
 * @returns Nome do time com acentos para exibição
 */
export function getTeamDisplayName(teamName: string): string {
  if (!teamName) return teamName
  
  // Se há mapeamento direto, retorna o nome com acentos
  if (TEAM_DISPLAY_NAMES[teamName]) {
    return TEAM_DISPLAY_NAMES[teamName]
  }
  
  // Caso contrário, retorna o nome original
  return teamName
}

