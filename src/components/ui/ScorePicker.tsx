import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ScorePickerProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  label?: string
}

const ITEM_HEIGHT = 28 // Altura de cada item em pixels (reduzido para números ficarem mais próximos)
const PICKER_HEIGHT = 160 // Altura total do picker (reduzido para economizar espaço)
const SELECTION_AREA_HEIGHT = 40 // Altura da área de seleção (maior que ITEM_HEIGHT para facilitar toque)

const ScorePicker = React.forwardRef<HTMLDivElement, ScorePickerProps>(({ 
  value, 
  onChange, 
  min = 0, 
  max = 10, 
  disabled = false,
  className,
  label
}, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  // Estado local para o valor exibido durante o scroll (evita "piscar")
  const [displayValue, setDisplayValue] = useState(value)
  const lastReportedValue = useRef<number>(value)
  const previousValueRef = useRef<number>(value)
  const previousLabelRef = useRef<string | undefined>(label)
  const isInitialMountRef = useRef<boolean>(true)
  const [isExternalChange, setIsExternalChange] = useState(false)
  const [isButtonChange, setIsButtonChange] = useState(false)
  const skipOnChangeRef = useRef<boolean>(false)

  // Calcular posição do indicador central
  const centerOffset = (PICKER_HEIGHT - ITEM_HEIGHT) / 2
  const indicatorTop = (PICKER_HEIGHT - SELECTION_AREA_HEIGHT) / 2 // Centralizar a área de seleção maior

  // Garantir que min nunca seja negativo
  const safeMin = Math.max(0, min)
  const safeMax = Math.max(safeMin, max)
  
  // Garantir que value está dentro dos limites
  const safeValue = Math.max(safeMin, Math.min(safeMax, value))

  // Gerar array de valores
  const values = Array.from({ length: safeMax - safeMin + 1 }, (_, i) => safeMin + i)
  
  // Detectar mudanças externas de valor e distinguir entre mudança de partida e mudança via botão
  useLayoutEffect(() => {
    if (value !== previousValueRef.current && !isScrolling) {
      // Verificar se é mudança de partida (label mudou) ou mudança via botão (apenas value mudou)
      const isGameChange = label !== previousLabelRef.current
      
      // Marcar que é mudança externa para evitar chamar onChange
      skipOnChangeRef.current = true
      setIsExternalChange(true)
      setIsButtonChange(!isGameChange) // Se não é mudança de partida, é mudança via botão
      
      // Atualizar refs
      lastReportedValue.current = value
      previousValueRef.current = value
      previousLabelRef.current = label
      
      // Para mudança de partida: NÃO atualizar displayValue imediatamente, deixar scroll suave
      // Para mudança via botão: atualizar displayValue imediatamente e usar scroll instantâneo (mais rápido)
      if (isGameChange) {
        // Mudança de partida: scroll suave
        if (scrollRef.current) {
          const index = values.indexOf(value)
          if (index !== -1) {
            const scrollPosition = index * ITEM_HEIGHT
            scrollRef.current.scrollTo({ top: scrollPosition, behavior: 'smooth' })
          }
        }
      } else {
        // Mudança via botão: scroll instantâneo e atualizar displayValue imediatamente
        setDisplayValue(value)
        if (scrollRef.current) {
          const index = values.indexOf(value)
          if (index !== -1) {
            const scrollPosition = index * ITEM_HEIGHT
            scrollRef.current.scrollTo({ top: scrollPosition, behavior: 'instant' })
          }
        }
      }
    } else if (label !== previousLabelRef.current) {
      // Se apenas o label mudou (nova partida), atualizar a ref
      previousLabelRef.current = label
    }
  }, [value, isScrolling, values, label])

  // Resetar flags após mudança externa
  useEffect(() => {
    if (isExternalChange) {
      const timeoutId = setTimeout(() => {
        setIsExternalChange(false)
        setIsButtonChange(false)
        skipOnChangeRef.current = false
      }, isButtonChange ? 50 : 500) // Tempo menor para mudança via botão (instantânea)
      return () => clearTimeout(timeoutId)
    }
  }, [isExternalChange, isButtonChange])

  // Scroll para o valor atual quando o componente monta (apenas na primeira vez)
  useEffect(() => {
    if (!scrollRef.current || isScrolling || !isInitialMountRef.current) return
    
    const index = values.indexOf(safeValue)
    if (index === -1) return

    const scrollPosition = index * ITEM_HEIGHT
    scrollRef.current.scrollTo({ top: scrollPosition, behavior: 'instant' })
    isInitialMountRef.current = false
  }, [safeValue, values, isScrolling])

  // Adicionar listener para prevenir overscroll no iPhone
  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const handleScroll = () => {
      const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
      const minScroll = 0
      
      if (scrollElement.scrollTop < minScroll) {
        scrollElement.scrollTo({ top: minScroll, behavior: 'auto' })
      } else if (scrollElement.scrollTop > maxScroll) {
        scrollElement.scrollTo({ top: maxScroll, behavior: 'auto' })
      }
    }

    scrollElement.addEventListener('scroll', handleScroll, { passive: false })

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [values.length])

  // Detectar quando o scroll para e atualizar o valor
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  
  const handleScroll = () => {
    if (!scrollRef.current || disabled) return
    
    setIsScrolling(true)
    
    if (scrollTimeoutRef.current !== null) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // Cancelar RAF anterior se existir
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    
    // Usar RAF para atualização suave do displayValue
    rafRef.current = requestAnimationFrame(() => {
      const scrollElement = scrollRef.current
      if (!scrollElement) return
      
      const scrollTop = scrollElement.scrollTop
      const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
      const minScroll = 0
      
      if (scrollTop < minScroll) {
        scrollElement.scrollTo({ top: minScroll, behavior: 'auto' })
        setDisplayValue(values[0])
        return
      }
      if (scrollTop > maxScroll) {
        scrollElement.scrollTo({ top: maxScroll, behavior: 'auto' })
        setDisplayValue(values[values.length - 1])
        return
      }
      
      // Calcular índice baseado na posição de scroll
      const index = Math.round(scrollTop / ITEM_HEIGHT)
      const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
      const newDisplayValue = values[clampedIndex]
      
      // Atualizar apenas o displayValue (não chama onChange - evita "piscar")
      // Atualizar durante scroll suave para todas as mudanças externas (partida ou botão)
      if (newDisplayValue !== displayValue) {
        setDisplayValue(newDisplayValue)
      }
    })
    
    scrollTimeoutRef.current = setTimeout(() => {
      handleScrollEnd()
    }, 100)
  }

  const handleScrollEnd = () => {
    if (!scrollRef.current || disabled) return
    
    setIsScrolling(false)
    const scrollElement = scrollRef.current
    const scrollTop = scrollElement.scrollTop
    
    const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight
    const minScroll = 0
    
    let correctedScrollTop = scrollTop
    if (scrollTop < minScroll) {
      correctedScrollTop = minScroll
      scrollElement.scrollTo({ top: minScroll, behavior: 'smooth' })
    } else if (scrollTop > maxScroll) {
      correctedScrollTop = maxScroll
      scrollElement.scrollTo({ top: maxScroll, behavior: 'smooth' })
    }
    
    // Calcular índice final
    const index = Math.round(correctedScrollTop / ITEM_HEIGHT)
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
    const finalValue = values[clampedIndex]
    
    // Garantir que o valor está dentro dos limites
    const correctedValue = Math.max(safeMin, Math.min(safeMax, finalValue))
    const correctedIndex = values.indexOf(correctedValue)
    
    if (correctedIndex !== -1) {
      const snapPosition = correctedIndex * ITEM_HEIGHT
      scrollElement.scrollTo({
        top: snapPosition,
        behavior: 'smooth'
      })
      
      // Só chamar onChange se o valor realmente mudou e não for mudança externa (evita chamadas desnecessárias)
      if (correctedValue !== lastReportedValue.current && !skipOnChangeRef.current) {
        onChange(correctedValue)
        lastReportedValue.current = correctedValue
        setDisplayValue(correctedValue)
      }
    }
  }

  // Prevenir scroll da página quando está tocando no picker
  const touchStartY = useRef<number>(0)
  const touchStartX = useRef<number>(0)
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    touchStartY.current = e.touches[0].clientY
    touchStartX.current = e.touches[0].clientX
    e.stopPropagation()
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !scrollRef.current) return
    e.stopPropagation()
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled) return
    handleScrollEnd()
    e.stopPropagation()
  }

  return (
    <div 
      ref={containerRef}
      data-picker-container
      data-picker-side={label?.includes('home') || label?.toLowerCase().includes('casa') ? 'home' : label?.includes('away') || label?.toLowerCase().includes('visitante') ? 'away' : undefined}
      className={cn('flex flex-col items-center relative', className)}
      style={{ touchAction: 'pan-y', pointerEvents: 'auto', overflowX: 'hidden', overflowY: 'visible' }}
    >
      <div className="relative w-20 h-[160px]" style={{ touchAction: 'pan-y', overflowX: 'hidden', overflowY: 'visible' }}>
        
        {/* Área de toque expandida invisível - cobre toda a área cinza estendida e chama os handlers de touch */}
        <div 
          className="absolute z-15"
          style={{ 
            top: indicatorTop, 
            height: SELECTION_AREA_HEIGHT,
            left: '-200%',
            right: '-200%',
            width: '500%',
            pointerEvents: 'auto',
            touchAction: 'pan-y'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        
        {/* Lista scrollável */}
        <div
          ref={(node) => {
            scrollRef.current = node
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref && typeof ref === 'object' && 'current' in ref) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(ref as any).current = node
            }
          }}
          data-picker-scroll
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseUp={handleScrollEnd}
          className={cn(
            'w-full h-full overflow-y-scroll overflow-x-visible scrollbar-hide relative z-20',
            'scroll-smooth snap-y snap-mandatory',
            disabled && 'opacity-50 pointer-events-none'
          )}
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'none',
          }}
        >
          {/* Padding superior para centralizar o primeiro item */}
          <div style={{ height: centerOffset }} />
          
          {/* Itens */}
          {values.map((val) => {
            const isSelected = val === displayValue
            const distance = Math.abs(val - displayValue)
            
            // Calcular valores intermediários para transição suave
            // Números não selecionados menores e mais transparentes
            const scale = isSelected ? 1 : Math.max(0.6, 1 - (distance * 0.12))
            const opacity = isSelected ? 1 : Math.max(0.25, 1 - (distance * 0.2))
            const fontSize = isSelected ? 1.875 : Math.max(0.75, 1.875 - (distance * 0.3)) // 1.875rem = text-3xl, 0.75rem = menor que text-sm
            
            return (
              <div
                key={val}
                className="flex items-center justify-center snap-center cursor-grab active:cursor-grabbing relative"
                style={{ 
                  height: ITEM_HEIGHT,
                  minHeight: ITEM_HEIGHT,
                }}
              >
                {/* Área de toque invisível maior para o número selecionado */}
                {isSelected && (
                  <div 
                    className="absolute inset-0 -left-8 -right-8 z-0"
                    style={{ pointerEvents: 'auto' }}
                  />
                )}
                <motion.span
                  className={cn(
                    'font-semibold select-none relative z-10',
                    isSelected
                      ? 'font-bold text-foreground text-3xl' 
                      : 'text-muted-foreground text-lg'
                  )}
                  animate={{
                    scale: scale,
                    opacity: opacity,
                  }}
                  transition={{
                    duration: isButtonChange ? 0 : 0.2,
                    ease: 'easeOut',
                  }}
                >
                  {val}
                </motion.span>
              </div>
            )
          })}
          
          {/* Padding inferior para centralizar o último item */}
          <div style={{ height: centerOffset }} />
        </div>
      </div>
    </div>
  )
})

ScorePicker.displayName = 'ScorePicker'

export default ScorePicker
