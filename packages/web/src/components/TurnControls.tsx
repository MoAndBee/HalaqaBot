import { SplitButton, SessionType } from './SplitButton'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface TurnControlsProps {
  onComplete: (sessionType: SessionType) => void
  onSkip: () => void
  canSkip: boolean
  disabled?: boolean
  defaultSessionType?: SessionType | null
}

export function TurnControls({
  onComplete,
  onSkip,
  canSkip,
  disabled = false,
  defaultSessionType = null
}: TurnControlsProps) {
  return (
    <div
      className="sticky top-0 z-20 bg-background border-b p-2 sm:p-3"
      dir="rtl"
    >
      <div className="flex gap-2 sm:gap-3 justify-start">
        <SplitButton onComplete={onComplete} disabled={disabled} defaultSessionType={defaultSessionType} />

        <Button
          onClick={onSkip}
          disabled={disabled || !canSkip}
          className={cn(
            'bg-amber-600 hover:bg-amber-700 text-white',
            (disabled || !canSkip) && 'opacity-50'
          )}
        >
          تخطي
        </Button>
      </div>
    </div>
  )
}
