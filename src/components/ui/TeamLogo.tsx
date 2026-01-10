import { useState, useEffect } from 'react'

interface TeamLogoProps {
  teamName: string
  logo?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  noCircle?: boolean
}

export default function TeamLogo({ teamName, logo, size = 'md', className, noCircle = false }: TeamLogoProps) {
  const [imageError, setImageError] = useState(false)
  
  // Validar se teamName é válido
  if (!teamName || typeof teamName !== 'string') {
    console.warn('TeamLogo: teamName inválido:', teamName)
    teamName = 'Unknown'
  }
  
  const sizeClasses = {
    sm: { container: 'h-8 w-8', text: 'text-xs' },
    md: { container: 'h-12 w-12', text: 'text-sm' },
    lg: { container: 'h-16 w-16', text: 'text-base' },
    xl: { container: 'h-20 w-20', text: 'text-lg' },
  }

  const currentSize = sizeClasses[size]

  /**
   * Gera o caminho do logo baseado no nome do time.
   * 
   * REGRA: O backend deve retornar nomes padronizados (sem acentos, espaços mantidos, hífens mantidos).
   * O frontend apenas faz normalização técnica: lowercase, espaços → hífens, remove caracteres especiais.
   * 
   * Exemplo:
   * - Backend retorna: "Sao Paulo" → Frontend gera: "sao-paulo.svg"
   * - Backend retorna: "Atletico-MG" → Frontend gera: "atletico-mg.svg"
   * - Backend retorna: "EC Vitoria" → Frontend gera: "ec-vitoria.svg"
   */
  const getLogoPath = (team: string, league: 'serie-a' | 'serie-b' = 'serie-a') => {
    // Validar se team é válido
    if (!team || typeof team !== 'string') {
      console.warn('TeamLogo: team inválido no getLogoPath:', team)
      return `/assets/teams/${league}/unknown.svg`
    }
    
    // Normalização técnica apenas:
    // 1. Lowercase
    // 2. Remover acentos
    // 3. Espaços → hífens
    // 4. Remover caracteres especiais (exceto hífens)
    const normalized = team
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/\s+/g, '-') // Espaços → hífens
      .replace(/[^a-z0-9-]/g, '') // Remove caracteres especiais (exceto hífens)
    
    return `/assets/teams/${league}/${normalized}.svg`
  }

  // Se o backend forneceu um logo diretamente, usa ele
  // Caso contrário, gera o caminho baseado no nome
  const [logoPath, setLogoPath] = useState<string | null>(logo || getLogoPath(teamName, 'serie-a'))
  const [triedSerieB, setTriedSerieB] = useState(false)

  const handleImageError = () => {
    // Se falhou e ainda não tentou série-b, tenta série-b
    if (!triedSerieB && !logo) {
      setTriedSerieB(true)
      setLogoPath(getLogoPath(teamName, 'serie-b'))
      setImageError(false)
    } else {
      setImageError(true)
    }
  }

  if (logoPath && !imageError) {
    if (noCircle) {
      return (
        <img
          src={logoPath}
          alt={teamName}
          className={`${className || currentSize.container} object-contain flex-shrink-0`}
          onError={handleImageError}
        />
      )
    }
    return (
      <div className={`${className || currentSize.container} rounded-full border-2 border-border overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 aspect-square ${size === 'md' ? 'p-1' : size === 'sm' ? 'p-1.5' : 'p-2'}`}>
        <img
          src={logoPath}
          alt={teamName}
          className="w-full h-full object-contain"
          onError={handleImageError}
        />
      </div>
    )
  }

  // Fallback: círculo com inicial do time
  if (noCircle) {
    return (
      <div className={`${className || currentSize.container} flex items-center justify-center flex-shrink-0 aspect-square`}>
        <span className={`text-primary font-bold ${currentSize.text}`}>
          {teamName.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }
  return (
    <div className={`${className || currentSize.container} rounded-full bg-primary/20 flex items-center justify-center border-2 border-border flex-shrink-0 aspect-square`}>
      <span className={`text-primary font-bold ${currentSize.text}`}>
        {teamName.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}
