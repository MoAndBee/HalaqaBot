import { AlertTriangle } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface RepeatParticipation {
  sessionNumber: number
  teacherName: string
  sessionType: string
}

interface RepeatParticipationIndicatorProps {
  repeats: RepeatParticipation[]
}

export function RepeatParticipationIndicator({ repeats }: RepeatParticipationIndicatorProps) {
  if (!repeats || repeats.length === 0) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="مشاركة متكررة في حلقة أخرى"
          className="inline-flex items-center justify-center rounded-full text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto max-w-xs text-xs"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-medium text-foreground mb-1">
          مشاركة مكررة:
        </div>
        <ul className="space-y-1 text-muted-foreground">
          {repeats.map((r) => (
            <li key={`${r.sessionNumber}-${r.sessionType}`}>
              حلقة {r.sessionNumber.toLocaleString('ar-EG')}
              {r.teacherName ? ` — ${r.teacherName}` : ''}
              {' '}
              <span className="text-foreground/80">({r.sessionType})</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
