import { useAvatarCache } from '@/hooks/useAvatarCache'

export interface UserAvatarProps {
  user: {
    name: string
    avatar?: string | null
  }
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-16 w-16 text-lg',
  lg: 'h-24 w-24 text-3xl',
  xl: 'h-28 w-28 text-2xl',
}

export default function UserAvatar({ user, size = 'md', className = '' }: UserAvatarProps) {
  const { avatarUrl: cachedAvatar } = useAvatarCache(user?.avatar)

  const sizeClass = sizeClasses[size]

  if (cachedAvatar) {
    return (
      <div className={`relative ${sizeClass} rounded-full border-[3px] border-primary shadow-lg p-0.5 bg-background ${className}`}>
        <div className="h-full w-full rounded-full overflow-hidden">
          <img
            src={cachedAvatar}
            alt={user.name}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    )
  }

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'U'

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary/30 to-primary/20 border-[3px] border-primary shadow-lg flex items-center justify-center p-0.5 bg-background ${className}`}>
      <div className="h-full w-full rounded-full bg-gradient-to-br from-primary/30 to-primary/20 flex items-center justify-center">
        <span className={`font-bold text-primary ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>
          {initials}
        </span>
      </div>
    </div>
  )
}
