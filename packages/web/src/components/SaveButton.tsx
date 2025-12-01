import { forwardRef } from 'react'
import { Button } from './ui/button'

export const SaveButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  return (
    <Button
      ref={ref}
      tabIndex={0}
      {...props}
    />
  )
})
