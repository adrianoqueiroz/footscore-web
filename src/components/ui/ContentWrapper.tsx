import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ContentWrapperProps {
  children: ReactNode
  className?: string
}

export default function ContentWrapper({ children, className }: ContentWrapperProps) {
  return (
    <div className={cn(
      'flex justify-center bg-background/95 bg-grid-small-white/[0.07]',
      className
    )}>
      <div className={cn(
        'w-full max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 p-4 md:p-6 lg:p-8',
        className
      )}>
        {children}
      </div>
    </div>
  )
}

