import { forwardRef } from 'react'
import { Button } from './ui/button'

export const CancelButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  return (
    <Button
      ref={ref}
      type="button"
      tabIndex={0}
      variant="ghost"
      {...props}
    />
  )
})
