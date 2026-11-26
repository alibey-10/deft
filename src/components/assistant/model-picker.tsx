import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Logout03Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '#/components/ui/field.tsx'
import { Input } from '#/components/ui/input.tsx'
import { InputGroupButton } from '#/components/ui/input-group.tsx'
import { adminSignOutServerFn } from '#/lib/admin.ts'
import { MODEL_ID_PATTERN, MODEL_PRESETS, modelLabel } from '#/lib/assistant/models.ts'

/** Model switcher in the prompt's footer. Admins can also use any OpenRouter model. */
export function ModelPicker({
  value,
  onValueChange,
  isAdmin,
}: {
  value: string
  onValueChange: (model: string) => void
  isAdmin: boolean
}) {
  const router = useRouter()
  const [customOpen, setCustomOpen] = useState(false)
  const isCustom = !MODEL_PRESETS.some((m) => m.id === value)

  const signOut = async () => {
    await adminSignOutServerFn()
    await router.invalidate()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<InputGroupButton size="xs" aria-label="Choose model" />}>
          {modelLabel(value)}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            data-icon="inline-end"
            className="transition-transform duration-150 group-aria-expanded/button:rotate-180"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" sideOffset={8} align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Model</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={value} onValueChange={(v) => onValueChange(String(v))}>
              {MODEL_PRESETS.map((model) => (
                <DropdownMenuRadioItem key={model.id} value={model.id}>
                  <div className="flex flex-col gap-0.5">
                    <span className="leading-snug font-medium">{model.label}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {model.description}
                    </span>
                  </div>
                </DropdownMenuRadioItem>
              ))}
              {isCustom && (
                <DropdownMenuRadioItem value={value}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-mono text-xs leading-snug">{value}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      Custom OpenRouter model
                    </span>
                  </div>
                </DropdownMenuRadioItem>
              )}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setCustomOpen(true)}>
                  <HugeiconsIcon icon={PencilEdit02Icon} />
                  Other OpenRouter model…
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <HugeiconsIcon icon={Logout03Icon} />
                  Sign out of admin
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <CustomModelDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        initialValue={isCustom ? value : ''}
        onSubmit={(model) => {
          onValueChange(model)
          setCustomOpen(false)
        }}
      />
    </>
  )
}

function CustomModelDialog({
  open,
  onOpenChange,
  initialValue,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValue: string
  onSubmit: (model: string) => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const [touched, setTouched] = useState(false)
  const id = draft.trim()
  const invalid = touched && !MODEL_ID_PATTERN.test(id)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(initialValue)
          setTouched(false)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (MODEL_ID_PATTERN.test(id)) onSubmit(id)
          }}
        >
          <DialogHeader>
            <DialogTitle>Use another model</DialogTitle>
            <DialogDescription>
              Any OpenRouter model id. It needs tool calling to search skills.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="custom-model">Model id</FieldLabel>
              <Input
                id="custom-model"
                autoFocus
                placeholder="anthropic/claude-haiku-5.5"
                value={draft}
                aria-invalid={invalid || undefined}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => setTouched(true)}
              />
              {invalid ? (
                <FieldError>Use the provider/model format, e.g. qwen/qwen3.8-flash.</FieldError>
              ) : (
                <FieldDescription>Find ids at openrouter.ai/models.</FieldDescription>
              )}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit">Use model</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
