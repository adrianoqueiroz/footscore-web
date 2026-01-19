import { ReactNode } from 'react'
import Button from './Button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface PageHeaderProps {
  title: string
  description?: string
  onBack?: () => void
  backPath?: string
  action?: ReactNode
}

export default function PageHeader({
  title,
  description,
  onBack,
  backPath,
  action,
}: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backPath) {
      navigate(backPath)
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={handleBack}
        className="rounded-full h-10 w-10 p-0 shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
