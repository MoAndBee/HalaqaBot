import { Button } from '@/components/ui/button'
import { SplitButton, SessionType } from './SplitButton'

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
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t p-3 sm:p-4"
      dir="rtl"
    >
      <div className="flex gap-2 sm:gap-3 w-full max-w-2xl mx-auto">
        <SplitButton onComplete={onComplete} disabled={disabled} defaultSessionType={defaultSessionType} />

        <Button
          onClick={onSkip}
          disabled={disabled || !canSkip}
          variant="secondary"
          className="h-12 px-4 text-base shrink-0 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-muted disabled:text-muted-foreground"
        >
          تخطي
        </Button>
      </div>
    </div>
  )
}
