import { Minus, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import Button from './Button'
import { cn } from '@/lib/utils'

interface StepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  size?: 'default' | 'large'
}

export default function Stepper({ value, onChange, min = 0, max = 10, disabled, className, size = 'default' }: StepperProps) {
  const handleDecrement = () => {
    if (value > min && !disabled) {
      onChange(value - 1)
    }
  }

  const handleIncrement = () => {
    if (value < max && !disabled) {
      onChange(value + 1)
    }
  }

  const isLarge = size === 'large'

  return (
    <div className={cn('flex items-center gap-2', isLarge && 'gap-3', className)}>
      <motion.div whileTap={{ scale: 0.9 }}>
        <Button
          variant="outline"
          size={isLarge ? 'md' : 'sm'}
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className={cn(
            'rounded-full p-0 border-2 bg-secondary hover:bg-secondary/80 hover:border-primary/50 active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed',
            'max-h-[3.5rem] max-w-[3.5rem] min-h-[2.75rem] min-w-[2.75rem]',
            isLarge ? 'h-14 w-14 sm:h-14 sm:w-14' : 'h-11 w-11 sm:h-11 sm:w-11'
          )}
        >
          <Minus className={isLarge ? 'h-6 w-6' : 'h-5 w-5'} />
        </Button>
      </motion.div>

      <motion.div
        className={cn(
          'flex items-center justify-center rounded-xl bg-secondary font-bold',
          'max-h-16 max-w-16 min-h-12 min-w-12',
          isLarge
            ? 'h-16 w-16 text-3xl sm:h-16 sm:w-16 sm:text-3xl'
            : 'h-12 w-12 text-xl sm:h-12 sm:w-12 sm:text-xl'
        )}
        whileTap={{ scale: 0.95 }}
      >
        {value}
      </motion.div>

      <motion.div whileTap={{ scale: 0.9 }}>
        <Button
          variant="outline"
          size={isLarge ? 'md' : 'sm'}
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className={cn(
            'rounded-full p-0 border-2 bg-secondary hover:bg-secondary/80 hover:border-primary/50 active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed',
            'max-h-[3.5rem] max-w-[3.5rem] min-h-[2.75rem] min-w-[2.75rem]',
            isLarge ? 'h-14 w-14 sm:h-14 sm:w-14' : 'h-11 w-11 sm:h-11 sm:w-11'
          )}
        >
          <Plus className={isLarge ? 'h-6 w-6' : 'h-5 w-5'} />
        </Button>
      </motion.div>
    </div>
  )
}

