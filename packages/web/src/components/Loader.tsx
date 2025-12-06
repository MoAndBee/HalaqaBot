import { Loader2 } from 'lucide-react'

export function Loader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
    </div>
  )
}
