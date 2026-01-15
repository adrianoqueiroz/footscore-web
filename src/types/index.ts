export type NavigationItem = 'games' | 'tickets' | 'ranking' | 'admin'

export interface Prediction {
  matchId: string
  homeScore: number
  awayScore: number
}

export interface User {
  id: string
  name: string
  email: string
  avatar: string
  phone: string
  city: string
  nickname?: string
  favoriteTeam?: string | null
  isAdmin: boolean
  superAdmin?: boolean
}

// New interfaces for authentication
export interface LoginRequest {
  emailOrPhone: string; // Can be email or phone
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone?: string; // Optional as per backend prompt
  city: string;
  nickname?: string;
  password: string;
}

export interface AuthResponse { // Unified response for login and register
  message: string;
  user: User;
  token: string;
}

export interface Match {
  id: string
  round: number
  date: string
  time: string
  homeTeam: string
  homeTeamLogo?: string
  awayTeam: string
  awayTeamLogo?: string
  homeScore?: number
  awayScore?: number
  status?: 'scheduled' | 'live' | 'finished'
  includeInRound?: boolean // Indica se o jogo deve ser incluído na rodada (útil quando um jogo muda de data)
  order?: number // Ordem de exibição dos jogos (baseada na criação ou reordenação manual)
}

export interface Ticket {
  id: string
  userId: string
  userName: string
  userNickname?: string
  nickname?: string
  round: number
  predictions: Prediction[]
  points?: number // Total de pontos calculado pelo backend
  pointsByMatch?: Array<{ matchId: string; points: number }> // Pontos por jogo calculado pelo backend
  status: 'pending' | 'confirmed' | 'cancelled'
  createdAt: string
  confirmedAt?: string
}

export interface TicketRankingEntry {
  userId: string
  userName: string
  ticketId: string
  points: number
  position: number
  round: number
  createdAt: string
  confirmedAt?: string
}
