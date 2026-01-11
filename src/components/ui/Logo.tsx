import { Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showStars?: boolean
  animateStars?: boolean
}

export default function Logo({ size = 'md', className, showStars = true, animateStars = false }: LogoProps) {
  const sizeClasses = {
    sm: {
      text: 'text-2xl',
      stars: 'h-2 w-2',
      starsGap: 'gap-1.5'
    },
    md: {
      text: 'text-3xl',
      stars: 'h-2.5 w-2.5',
      starsGap: 'gap-2'
    },
    lg: {
      text: 'text-5xl',
      stars: 'h-3 w-3',
      starsGap: 'gap-2.5'
    }
  }

  const classes = sizeClasses[size]

  const stars = [
    { key: 'star1', translateY: 0 },
    { key: 'star2', translateY: size === 'sm' ? -4 : size === 'md' ? -5 : -6 },
    { key: 'star3', translateY: 0 }
  ]

  return (
    <div 
      className={cn('inline-flex items-baseline italic relative', className)}
      style={{ 
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: 'visible'
      }}
    >
      <span className={cn('text-primary', classes.text)} style={{ fontStyle: 'italic', fontWeight: 900 }}>
        Foo
      </span>
      <span className="relative inline-block">
        {/* Estrelas acima centralizadas sobre "tSc" (t de Foot + Sc de Score) - estrela do meio acima do S */}
        {showStars && (
          <div className={cn('absolute flex items-center justify-center', classes.starsGap)} style={{
            top: size === 'sm' ? '-0.375rem' : size === 'md' ? '-0.5rem' : '-0.625rem',
            left: size === 'sm' ? 'calc(50% + 0.15em)' : size === 'md' ? 'calc(50% + 0.2em)' : 'calc(50% + 0.25em)',
            transform: 'translateX(-50%)',
            zIndex: 50,
            overflow: 'visible',
            pointerEvents: 'none'
          }}>
            {stars.map((star, index) => {
              if (animateStars) {
                return (
                  <motion.div
                    key={star.key}
                    initial={{ 
                      opacity: 0, 
                      scale: 0,
                    }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1,
                    }}
                    transition={{
                      delay: index * 0.2,
                      duration: 0.5,
                      ease: 'easeOut'
                    }}
                  >
                    <Star 
                      className={cn(classes.stars)} 
                      style={{ 
                        transform: star.translateY !== 0 ? `translateY(${star.translateY}px)` : undefined,
                        fill: 'rgba(250, 204, 21, 0.9)',
                        color: 'rgba(250, 204, 21, 0.9)',
                        filter: 'drop-shadow(0 0 2px rgba(250, 204, 21, 0.5))'
                      }}
                    />
                  </motion.div>
                )
              }

              return (
                <Star 
                  key={star.key}
                  className={cn(classes.stars)} 
                  style={{ 
                    transform: star.translateY !== 0 ? `translateY(${star.translateY}px)` : undefined,
                    fill: 'rgba(250, 204, 21, 0.9)',
                    color: 'rgba(250, 204, 21, 0.9)',
                    filter: 'drop-shadow(0 0 2px rgba(250, 204, 21, 0.5))'
                  }}
                />
              )
            })}
          </div>
        )}
        <span className={cn('text-primary', classes.text)} style={{ fontStyle: 'italic', fontWeight: 900 }}>
          t
        </span>
        <span className={cn('text-foreground', classes.text)} style={{ fontStyle: 'italic', fontWeight: 700 }}>
          Sc
        </span>
      </span>
      <span className={cn('text-foreground', classes.text)} style={{ fontStyle: 'italic', fontWeight: 700 }}>
        ore
      </span>
    </div>
  )
}

