import { motion } from 'framer-motion'
import { LucideIcon, ChevronRight } from 'lucide-react'
import Card from './Card'

export interface MenuItemCardProps {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
  danger?: boolean
  index?: number
}

export default function MenuItemCard({
  icon: Icon,
  title,
  description,
  onClick,
  danger = false,
  index = 0,
}: MenuItemCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="p-4">
        <button
          onClick={onClick}
          className={`w-full flex items-center gap-4 p-0 hover:bg-secondary/50 rounded-lg transition-colors ${
            danger ? 'text-red-400 hover:bg-red-500/10' : ''
          }`}
        >
          <div className={`p-3 rounded-full ${danger ? 'bg-red-500/10' : 'bg-primary/10'}`}>
            <Icon className={`w-6 h-6 ${danger ? 'text-red-400' : 'text-primary'}`} />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-base">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </Card>
    </motion.div>
  )
}
