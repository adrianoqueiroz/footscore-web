import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface SortableItemProps {
  id: string
  children: React.ReactNode
  isReordering: boolean
}

export default function SortableItem({ id, children, isReordering }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: !isReordering,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : { ...transition, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
    position: 'relative' as const,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative"
    >
      {isReordering && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing touch-none"
          style={{
            // Área de toque maior: 48x48px (tamanho mínimo recomendado para toque)
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="p-1 rounded hover:bg-secondary/50 transition-colors">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className={`relative ${isReordering ? 'pl-12' : ''}`} style={isReordering ? { touchAction: 'pan-y' } : undefined}>
        {children}
      </div>
    </div>
  )
}
