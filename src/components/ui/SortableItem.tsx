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
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9999 : 'auto',
    position: 'relative' as const,
    touchAction: isReordering ? 'none' : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isReordering ? 'select-none cursor-grab active:cursor-grabbing' : ''}`}
      {...(isReordering ? { ...attributes, ...listeners } : {})}
    >
      {isReordering && (
        <div
          className="absolute left-0 top-0 bottom-0 w-10 z-10 flex items-center justify-center pointer-events-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div className={`relative ${isReordering ? 'pl-10' : ''}`}>
        {children}
      </div>
    </div>
  )
}
