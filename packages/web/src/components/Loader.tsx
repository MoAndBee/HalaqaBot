import { Spinner } from './ui/spinner'

export function Loader() {
  return (
    <div className="flex h-full">
      <div className="m-auto">
        <Spinner size="lg" />
      </div>
    </div>
  )
}
