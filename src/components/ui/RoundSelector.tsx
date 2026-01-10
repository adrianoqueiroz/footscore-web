import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from './Button'

interface RoundSelectorProps {
  rounds: number[]
  selectedRound: number | undefined
  onRoundChange: (round: number) => void
  onOpen?: () => void | Promise<void>
  alwaysCallOnOpen?: boolean // Se true, sempre chama onOpen ao abrir, não apenas quando rounds.length === 0
  className?: string
}

export default function RoundSelector({ rounds, selectedRound, onRoundChange, onOpen, alwaysCallOnOpen = false, className }: RoundSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  // Debug: verificar se o array rounds está sendo recebido
  useEffect(() => {
    console.log('[RoundSelector] Props recebidas - rounds.length:', rounds.length, 'rounds:', rounds, 'selectedRound:', selectedRound)
  }, [rounds, selectedRound])

  const handleToggle = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    
    const wasOpen = isOpen
    const newIsOpen = !wasOpen
    
    // Primeiro abrir o dropdown
    setIsOpen(newIsOpen)
    
    // Se está abrindo o dropdown, chamar onOpen se:
    // - alwaysCallOnOpen é true (sempre chamar)
    // - ou não temos rodadas (para carregar inicialmente)
    if (newIsOpen && onOpen && (alwaysCallOnOpen || rounds.length === 0)) {
      // Usar requestAnimationFrame para garantir que o dropdown abra primeiro
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onOpen()
        })
      })
    }
  }
  
  const handleSelect = (round: number) => {
    onRoundChange(round)
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    // Usar um pequeno delay para evitar que o clique que abre o dropdown também o feche
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true)
    }, 0)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [isOpen])

  return (
    <div className={cn('relative w-40', className)} ref={selectorRef}>
      <Button
        variant="outline"
        onClick={handleToggle}
        className="w-full flex items-center justify-between"
        disabled={rounds.length === 0}
      >
        <span>{selectedRound ? `Rodada ${selectedRound}` : 'Selecione'}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </Button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-10 mt-1 w-full bg-background border border-border rounded-md shadow-lg"
          >
            <ul className="py-1 max-h-60 overflow-y-auto">
              {rounds.length === 0 ? (
                <li className="px-4 py-2 text-sm text-muted-foreground">
                  Nenhuma rodada disponível
                </li>
              ) : (
                rounds.map(round => {
                  console.log('[RoundSelector] Renderizando rodada:', round)
                  return (
                    <li
                      key={round}
                      onClick={() => handleSelect(round)}
                      className="px-4 py-2 text-sm cursor-pointer hover:bg-secondary"
                    >
                      Rodada {round}
                    </li>
                  )
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
