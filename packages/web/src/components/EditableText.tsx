import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Input } from './ui/input'
import { Button } from './ui/button'

export function EditableText({
  fieldName,
  value,
  inputClassName,
  inputLabel,
  buttonClassName,
  buttonLabel,
  onChange,
  editState,
}: {
  fieldName: string
  value: string
  inputClassName?: string
  inputLabel: string
  buttonClassName?: string
  buttonLabel: string
  onChange: (value: string) => void
  editState?: [boolean, (value: boolean) => void]
}) {
  const localEditState = useState(false)
  const [edit, setEdit] = editState || localEditState
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  return edit ? (
    <form
      onSubmit={(event) => {
        event.preventDefault()

        onChange(inputRef.current!.value)

        flushSync(() => {
          setEdit(false)
        })

        buttonRef.current?.focus()
      }}
    >
      <Input
        required
        ref={inputRef}
        type="text"
        aria-label={inputLabel}
        name={fieldName}
        defaultValue={value}
        className={inputClassName}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            flushSync(() => {
              setEdit(false)
            })
            buttonRef.current?.focus()
          }
        }}
        onBlur={(_event) => {
          if (
            inputRef.current?.value !== value &&
            inputRef.current?.value.trim() !== ''
          ) {
            onChange(inputRef.current!.value)
          }
          setEdit(false)
        }}
      />
    </form>
  ) : (
    <Button
      aria-label={buttonLabel}
      type="button"
      ref={buttonRef}
      variant="ghost"
      onClick={() => {
        flushSync(() => {
          setEdit(true)
        })
        inputRef.current?.select()
      }}
      className={buttonClassName}
    >
      {value || <span className="text-muted-foreground italic">تعديل</span>}
    </Button>
  )
}
