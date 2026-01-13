import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export default function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  const triggerHaptic = useHapticFeedback()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      // Trigger haptic feedback ao alternar o switch
      triggerHaptic('light')
      onCheckedChange(!checked)
    } else {
      console.log('[Switch] Tentativa de clique bloqueada - switch está disabled')
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
        className
      )}
    >
      <motion.span
        layout
        className={cn(
          'pointer-events-none absolute block h-5 w-5 rounded-full bg-background shadow-lg ring-0',
          checked ? 'right-0.5' : 'left-0.5'
        )}
        transition={{ type: 'spring', stiffness: 400, damping: 25, duration: 0.3 }}
      />
    </button>
  )
}

