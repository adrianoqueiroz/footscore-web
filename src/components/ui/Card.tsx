import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-border bg-secondary/50 p-4 shadow-lg',
          'md:hover:shadow-xl md:transition-shadow md:duration-200',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export default Card




