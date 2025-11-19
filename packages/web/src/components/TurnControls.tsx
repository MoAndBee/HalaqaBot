import { SplitButton, SessionType } from './SplitButton'

interface TurnControlsProps {
  onComplete: (sessionType: SessionType) => void
  onSkip: () => void
  canSkip: boolean
  disabled?: boolean
}

export function TurnControls({
  onComplete,
  onSkip,
  canSkip,
  disabled = false
}: TurnControlsProps) {
  return (
    <div
      className="sticky top-0 z-20 bg-slate-900 border-b border-slate-700 p-2 sm:p-3"
      dir="rtl"
    >
      <div className="flex gap-2 sm:gap-3 justify-start">
        <SplitButton onComplete={onComplete} disabled={disabled} />

        <button
          onClick={onSkip}
          disabled={disabled || !canSkip}
          className={`
            px-4 py-2 sm:px-6 sm:py-2 rounded-lg font-medium text-white text-sm sm:text-base
            transition-colors duration-200
            ${
              disabled || !canSkip
                ? 'bg-slate-600 cursor-not-allowed opacity-50'
                : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
            }
          `}
        >
          تخطي
        </button>
      </div>
    </div>
  )
}
